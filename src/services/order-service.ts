import "server-only";

import { Types } from "mongoose";

import {
  canCancelCafeOrder,
  canCreateOrder,
  canViewCafeOrders,
  type CafeMemberIdentity,
} from "@/src/domain/cafe-access";
import {
  canManageSupplierOrders,
  canViewSupplierOrders,
  type SupplierMemberIdentity,
} from "@/src/domain/supplier-access";
import {
  calculateOrderTotals,
  canTransitionOrderStatus,
  OrderCalculationError,
  type CafeOrderDetailDTO,
  type CafeOrderListResult,
  type CreateOrdersFromSelectionResultDTO,
  type CreatedOrderSummaryDTO,
  type OrderItemType,
  type OrderStatus,
  type SupplierOrderDetailDTO,
  type SupplierOrderListResult,
} from "@/src/domain/order";
import {
  cancelCafeOrderSchema,
  createOrdersFromSelectionSchema,
  markSupplierOrderShippedSchema,
  orderQuerySchema,
  rejectSupplierOrderSchema,
} from "@/src/domain/schemas/order";
import {
  getCurrentCafeIdentity,
  getCurrentSupplierIdentity,
} from "@/src/lib/auth-helpers";
import {
  createOrderInRepo,
  decrementOfferStock,
  findOfferBySupplierAndProduct,
  findOfferStock,
  findOrderByIdForCafe,
  findOrderByIdForSupplier,
  findOrdersBySelectionId,
  incrementOfferStock,
  listOrdersForCafe,
  listOrdersForSupplier,
  transitionOrderStatusInRepo,
  type CreateOrderRepoItemInput,
} from "@/src/repositories/order-repository";
import {
  findComparisonDataBatch,
  finalizeSelectionInRepo,
} from "@/src/repositories/purchase-request-selection-repository";

// ---------------------------------------------------------------------------
// Domain Errors
// ---------------------------------------------------------------------------

export class OrderAuthError extends Error {
  constructor(message = "دسترسی نامعتبر است؛ لطفاً وارد حساب کاربری خود شوید") {
    super(message);
    this.name = "OrderAuthError";
  }
}

export class OrderPermissionError extends Error {
  constructor(message = "شما دسترسی لازم برای انجام این عملیات روی سفارش را ندارید") {
    super(message);
    this.name = "OrderPermissionError";
  }
}

export class OrderNotFoundError extends Error {
  constructor(message = "سفارش یا استعلام قیمت مورد نظر یافت نشد") {
    super(message);
    this.name = "OrderNotFoundError";
  }
}

export class OrderInvalidStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderInvalidStatusError";
  }
}

export class OrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderValidationError";
  }
}

export class OrderStaleResponseError extends Error {
  constructor(
    message = "پیشنهاد تأمین‌کننده پس از ثبت انتخاب تغییر یافته است؛ لطفاً ابتدا صفحه مقایسه را باز کرده و انتخاب را مجدداً بررسی و تأیید نمایید",
  ) {
    super(message);
    this.name = "OrderStaleResponseError";
  }
}

export class OrderInsufficientStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderInsufficientStockError";
  }
}

export { OrderCalculationError };

// ---------------------------------------------------------------------------
// Identity Helpers
// ---------------------------------------------------------------------------

export async function requireCafeOrderAuth(): Promise<CafeMemberIdentity> {
  const identity = await getCurrentCafeIdentity();
  if (!identity) {
    throw new OrderAuthError("دسترسی به پنل کافه ممکن نیست؛ لطفاً وارد شوید");
  }
  return identity;
}

export async function requireSupplierOrderAuth(): Promise<SupplierMemberIdentity> {
  const identity = await getCurrentSupplierIdentity();
  if (!identity) {
    throw new OrderAuthError("دسترسی به پنل تأمین‌کننده ممکن نیست؛ لطفاً وارد شوید");
  }
  return identity;
}

// ---------------------------------------------------------------------------
// 1. Create Orders from PurchaseRequestSelection (Authoritative, Idempotent, Stock-Safe)
// ---------------------------------------------------------------------------

export async function createOrdersFromPurchaseRequestSelection(
  rawInput: unknown,
  providedIdentity?: CafeMemberIdentity,
): Promise<CreateOrdersFromSelectionResultDTO> {
  const identity = providedIdentity || (await requireCafeOrderAuth());

  // 1. Enforce Cafe Role / Permissions
  if (!canCreateOrder(identity)) {
    throw new OrderPermissionError(
      "شما دسترسی لازم برای تأیید خرید و ثبت سفارش را ندارید",
    );
  }

  // 2. Validate input schema
  const parsed = createOrdersFromSelectionSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new OrderValidationError(
      parsed.error.issues[0]?.message || "شناسه استعلام قیمت نامعتبر است",
    );
  }
  const { purchaseRequestId } = parsed.data;

  // 3. Load authoritative RFQ, SupplierRequests, SupplierResponses, Selection batch
  const batchData = await findComparisonDataBatch(
    identity.cafeId,
    purchaseRequestId,
  );

  if (!batchData) {
    throw new OrderNotFoundError("استعلام قیمت مورد نظر یافت نشد");
  }

  const {
    rfqDoc,
    supplierRequests,
    supplierResponses,
    existingSelection,
    supplierNameMap,
  } = batchData;

  // 4. Enforce RFQ lifecycle preconditions
  if (rfqDoc.status === "cancelled") {
    throw new OrderInvalidStatusError(
      "امکان صدور سفارش برای استعلام قیمت لغوشده وجود ندارد",
    );
  }
  if (rfqDoc.status === "draft") {
    throw new OrderInvalidStatusError(
      "امکان صدور سفارش برای پیش‌نویس استعلام قیمت وجود ندارد؛ استعلام باید ابتدا ارسال شود",
    );
  }
  if (rfqDoc.status !== "submitted") {
    throw new OrderInvalidStatusError(
      `وضعیت استعلام قیمت "${rfqDoc.status}" برای ثبت سفارش مجاز نیست`,
    );
  }

  // 5. Validate Selection existence and non-emptiness
  if (!existingSelection) {
    throw new OrderValidationError(
      "هیچ انتخابی برای این استعلام قیمت ثبت نشده است",
    );
  }

  const selectionItems = existingSelection.items || [];
  if (selectionItems.length === 0) {
    throw new OrderValidationError(
      "انتخاب اقلام خالی است؛ امکان صدور سفارش برای انتخاب خالی وجود ندارد",
    );
  }

  const selectionIdStr = existingSelection._id.toString();

  // 6. Idempotency Check: if selection already finalized, return existing orders
  if (existingSelection.isFinalized) {
    const existingOrders = await findOrdersBySelectionId(selectionIdStr);
    if (existingOrders.length > 0) {
      const summaryList: CreatedOrderSummaryDTO[] = existingOrders.map((ord) => ({
        orderId: ord._id.toString(),
        orderNumber: ord.orderNumber,
        supplierId: ord.supplierId.toString(),
        supplierName:
          supplierNameMap.get(ord.supplierId.toString()) || "تأمین‌کننده ناشناس",
        itemCount: ord.items.length,
        totalAmount: ord.totalAmount,
        deliveryDays: ord.deliveryDays,
        status: ord.status,
      }));

      return {
        purchaseRequestId: rfqDoc._id.toString(),
        purchaseRequestSelectionId: selectionIdStr,
        orderCount: summaryList.length,
        orders: summaryList,
      };
    }
  }

  // 7. Validate SupplierRequests and SupplierResponses status & freshness
  const supplierRequestMap = new Map(
    supplierRequests.map((sr) => [sr._id.toString(), sr]),
  );
  const supplierResponseMap = new Map(
    supplierResponses.map((r) => [r._id.toString(), r]),
  );

  // Index RFQ items
  type RfqItemLean = {
    _id: Types.ObjectId;
    itemType: OrderItemType;
    quantity: number;
    productId?: Types.ObjectId | null;
    customTitle?: string | null;
    customUnit?: string | null;
    productSnapshot?: {
      name: string;
      unit: string;
      brand?: string | null;
    } | null;
  };

  const rfqItemMap = new Map<string, RfqItemLean>();
  for (const it of rfqDoc.items as unknown as RfqItemLean[]) {
    rfqItemMap.set(it._id.toString(), it);
  }

  // Index SupplierRequestItems to find matchedSupplierOfferId
  type SrItemLean = {
    purchaseRequestItemId: Types.ObjectId;
    productId: Types.ObjectId;
    matchedSupplierOfferId?: Types.ObjectId | null;
  };
  const srItemOfferMap = new Map<string, Types.ObjectId | null>();
  for (const sr of supplierRequests) {
    for (const sritem of (sr.items || []) as unknown as SrItemLean[]) {
      const key = `${sr._id.toString()}:${sritem.purchaseRequestItemId.toString()}`;
      srItemOfferMap.set(key, sritem.matchedSupplierOfferId ?? null);
    }
  }

  // Validate Stale Response & Request Status for every selected item
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const it of selectionItems as any[]) {
    const parentReq = supplierRequestMap.get(it.supplierRequestId.toString());
    if (!parentReq || parentReq.status !== "responded") {
      throw new OrderInvalidStatusError(
        "درخواست استعلام برای یکی از تأمین‌کنندگان انتخاب‌شده لغو، رد، یا در انتظار پاسخ است؛ امکان ثبت سفارش وجود ندارد",
      );
    }

    const parentResp = supplierResponseMap.get(it.supplierResponseId.toString());
    if (!parentResp) {
      throw new OrderValidationError(
        "پاسخ تأمین‌کننده برای یکی از اقلام انتخاب‌شده یافت نشد",
      );
    }

    // Response change check (Section 18)
    if (parentResp.updatedAt && it.supplierResponseUpdatedAt) {
      const respTime = new Date(parentResp.updatedAt).getTime();
      const snapTime = new Date(it.supplierResponseUpdatedAt).getTime();
      if (respTime > snapTime) {
        const suppName =
          supplierNameMap.get(it.supplierId.toString()) || "تأمین‌کننده";
        throw new OrderStaleResponseError(
          `پیشنهاد تأمین‌کننده "${suppName}" پس از ثبت انتخاب تغییر یافته است؛ لطفاً ابتدا صفحه مقایسه را باز کرده و انتخاب را مجدداً ذخیره و تأیید نمایید`,
        );
      }
    }
  }

  // 8. Group items by supplier for order segregation (Granularity Invariant: 1 Order per Supplier)
  type GroupData = {
    supplierId: string;
    supplierName: string;
    supplierResponseId: string;
    deliveryDays: number;
    shippingCost: number;
    items: CreateOrderRepoItemInput[];
  };

  const groupMap = new Map<string, GroupData>();

  // Use authoritative supplierGroups metadata from Selection snapshot
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const sg of (existingSelection.supplierGroups || []) as any[]) {
    groupMap.set(sg.supplierId.toString(), {
      supplierId: sg.supplierId.toString(),
      supplierName: sg.supplierName,
      supplierResponseId: sg.supplierResponseId.toString(),
      deliveryDays: sg.deliveryDays,
      shippingCost: sg.shippingCost,
      items: [],
    });
  }

  // Map items to their respective supplier groups
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const it of selectionItems as any[]) {
    const suppIdStr = it.supplierId.toString();
    const group = groupMap.get(suppIdStr);
    if (!group) continue;

    const rfqItem = rfqItemMap.get(it.purchaseRequestItemId.toString());
    const srKey = `${it.supplierRequestId.toString()}:${it.purchaseRequestItemId.toString()}`;
    const matchedOfferId = srItemOfferMap.get(srKey);

    const title =
      rfqItem?.itemType === "catalog"
        ? rfqItem.productSnapshot?.name || "کالای کاتالوگ"
        : rfqItem?.customTitle || "کالای سفارشی";

    const unit =
      rfqItem?.itemType === "catalog"
        ? rfqItem.productSnapshot?.unit || ""
        : rfqItem?.customUnit || "";

    const brand =
      rfqItem?.itemType === "catalog"
        ? rfqItem.productSnapshot?.brand || null
        : null;

    const subtotal = it.selectedQuantity * it.unitPrice;

    group.items.push({
      purchaseRequestItemId: it.purchaseRequestItemId.toString(),
      supplierRequestId: it.supplierRequestId.toString(),
      supplierResponseId: it.supplierResponseId.toString(),
      productId: rfqItem?.productId ? rfqItem.productId.toString() : null,
      matchedSupplierOfferId: matchedOfferId ? matchedOfferId.toString() : null,
      itemType: (rfqItem?.itemType || "custom") as OrderItemType,
      title,
      unit,
      brand,
      quantity: it.selectedQuantity,
      unitPrice: it.unitPrice,
      subtotal,
    });
  }

  // 9. Stock Validation Pre-check across all catalog items (Sections 31, 33, 34)
  type StockCheckItem = {
    offerId: Types.ObjectId;
    productTitle: string;
    supplierName: string;
    requestedQuantity: number;
  };

  const stockCheckList: StockCheckItem[] = [];

  for (const group of groupMap.values()) {
    for (const item of group.items) {
      if (item.itemType === "catalog" && item.productId) {
        let offerInfo: { _id: Types.ObjectId; stock: number; status: string } | null = null;

        if (item.matchedSupplierOfferId) {
          const directOffer = await findOfferStock(item.matchedSupplierOfferId);
          if (directOffer) {
            offerInfo = {
              _id: new Types.ObjectId(item.matchedSupplierOfferId),
              stock: directOffer.stock,
              status: directOffer.status,
            };
          }
        }

        if (!offerInfo) {
          offerInfo = await findOfferBySupplierAndProduct(
            group.supplierId,
            item.productId,
          );
        }

        if (!offerInfo || offerInfo.status !== "active") {
          throw new OrderInsufficientStockError(
            `پیشنهاد کالای "${item.title}" نزد تأمین‌کننده "${group.supplierName}" غیرفعال است یا یافت نشد`,
          );
        }

        if (offerInfo.stock < item.quantity) {
          throw new OrderInsufficientStockError(
            `موجودی کالای "${item.title}" نزد تأمین‌کننده "${group.supplierName}" کافی نیست. موجودی فعلی: ${offerInfo.stock}، تعداد درخواستی: ${item.quantity}`,
          );
        }

        stockCheckList.push({
          offerId: offerInfo._id,
          productTitle: item.title,
          supplierName: group.supplierName,
          requestedQuantity: item.quantity,
        });
      }
    }
  }

  // 10. Atomic Stock Decrement with Compensating Rollback (Section 32, 33)
  const appliedDecrements: Array<{ offerId: Types.ObjectId; quantity: number }> =
    [];

  try {
    for (const stockItem of stockCheckList) {
      const decremented = await decrementOfferStock(
        stockItem.offerId,
        stockItem.requestedQuantity,
      );

      if (!decremented) {
        throw new OrderInsufficientStockError(
          `موجودی کالای "${stockItem.productTitle}" نزد تأمین‌کننده "${stockItem.supplierName}" به دلیل تغییر همزمان کافی نیست`,
        );
      }

      appliedDecrements.push({
        offerId: stockItem.offerId,
        quantity: stockItem.requestedQuantity,
      });
    }
  } catch (stockErr) {
    // Rollback any stock already decremented in this run
    for (const applied of appliedDecrements) {
      await incrementOfferStock(applied.offerId, applied.quantity);
    }
    throw stockErr;
  }

  // 11. Create Order per Supplier (Granularity: 1 Cafe, 1 Supplier)
  const createdSummaries: CreatedOrderSummaryDTO[] = [];

  try {
    for (const group of groupMap.values()) {
      if (group.items.length === 0) continue;

      // Safe integer totals calculation
      const totals = calculateOrderTotals(
        group.items.map((i) => ({
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        group.shippingCost,
      );

      const { order, isExisting } = await createOrderInRepo({
        cafeId: identity.cafeId,
        supplierId: group.supplierId,
        purchaseRequestId: rfqDoc._id.toString(),
        purchaseRequestSelectionId: selectionIdStr,
        items: group.items,
        itemsSubtotal: totals.itemsSubtotal,
        shippingCost: totals.shippingCost,
        totalAmount: totals.totalAmount,
        deliveryDays: group.deliveryDays,
        createdByUserId: identity.userId,
      });

      // If the order already existed (e.g. concurrent race won by another call),
      // we rollback the stock that was just decremented for this specific group's items
      if (isExisting) {
        for (const item of group.items) {
          if (item.itemType === "catalog") {
            const stockItem = stockCheckList.find(
              (s) => s.productTitle === item.title && s.supplierName === group.supplierName,
            );
            if (stockItem) {
              await incrementOfferStock(stockItem.offerId, item.quantity);
            }
          }
        }
      }

      createdSummaries.push({
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        supplierId: order.supplierId.toString(),
        supplierName: group.supplierName,
        itemCount: order.items.length,
        totalAmount: order.totalAmount,
        deliveryDays: order.deliveryDays,
        status: order.status,
      });
    }

    // 12. Finalize Selection atomically (Lock Selection against edits)
    await finalizeSelectionInRepo(selectionIdStr, identity.userId);

    return {
      purchaseRequestId: rfqDoc._id.toString(),
      purchaseRequestSelectionId: selectionIdStr,
      orderCount: createdSummaries.length,
      orders: createdSummaries,
    };
  } catch (creationErr) {
    // In case of fatal creation error, restore all decremented stock
    for (const applied of appliedDecrements) {
      await incrementOfferStock(applied.offerId, applied.quantity);
    }
    throw creationErr;
  }
}

// ---------------------------------------------------------------------------
// 2. Cafe Orders Operations (Read & Cancel)
// ---------------------------------------------------------------------------

export async function getCafeOrder(
  orderId: string,
  providedIdentity?: CafeMemberIdentity,
): Promise<CafeOrderDetailDTO> {
  const identity = providedIdentity || (await requireCafeOrderAuth());

  if (!canViewCafeOrders(identity)) {
    throw new OrderPermissionError(
      "شما دسترسی لازم برای مشاهده سفارش‌های کافه را ندارید",
    );
  }

  if (!orderId || !Types.ObjectId.isValid(orderId)) {
    throw new OrderValidationError("شناسه سفارش معتبر نیست");
  }

  const order = await findOrderByIdForCafe(identity.cafeId, orderId);
  if (!order) {
    throw new OrderNotFoundError("سفارش مورد نظر یافت نشد");
  }

  return order;
}

export async function listCafeOrders(
  rawQuery: unknown,
  providedIdentity?: CafeMemberIdentity,
): Promise<CafeOrderListResult> {
  const identity = providedIdentity || (await requireCafeOrderAuth());

  if (!canViewCafeOrders(identity)) {
    throw new OrderPermissionError(
      "شما دسترسی لازم برای مشاهده لیست سفارش‌های کافه را ندارید",
    );
  }

  const parsed = orderQuerySchema.safeParse(rawQuery || {});
  const query = parsed.success
    ? parsed.data
    : { page: 1, pageSize: 20, status: undefined };

  return listOrdersForCafe(identity.cafeId, {
    page: query.page,
    pageSize: query.pageSize,
    status: query.status as OrderStatus | undefined,
  });
}

export async function cancelCafeOrder(
  rawInput: unknown,
  providedIdentity?: CafeMemberIdentity,
): Promise<CafeOrderDetailDTO> {
  const identity = providedIdentity || (await requireCafeOrderAuth());

  const parsed = cancelCafeOrderSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new OrderValidationError(
      parsed.error.issues[0]?.message || "داده‌های ورودی لغو سفارش نامعتبر است",
    );
  }

  const { orderId, cancelReason } = parsed.data;

  // Tenant-scoped load
  const currentOrder = await findOrderByIdForCafe(identity.cafeId, orderId);
  if (!currentOrder) {
    throw new OrderNotFoundError("سفارش مورد نظر یافت نشد");
  }

  // Permission check
  const hasPermission = canCancelCafeOrder(identity, {
    createdByUserId: currentOrder.createdByUserId,
  });

  if (!hasPermission) {
    throw new OrderPermissionError(
      "شما دسترسی لازم برای لغو این سفارش را ندارید",
    );
  }

  // Transition lifecycle guard: Cafe can ONLY cancel placed orders
  if (!canTransitionOrderStatus(currentOrder.status, "cancelled", "cafe")) {
    throw new OrderInvalidStatusError(
      "فقط سفارش‌های در انتظار تأیید تأمین‌کننده (placed) توسط کافه قابل لغو هستند",
    );
  }

  const updatedDoc = await transitionOrderStatusInRepo({
    orderId,
    currentStatus: "placed",
    newStatus: "cancelled",
    tenantFilter: { cafeId: identity.cafeId },
    updateFields: {
      cancelledAt: new Date(),
      cancelledByUserId: new Types.ObjectId(identity.userId),
      cancelReason: cancelReason || null,
    },
  });

  if (!updatedDoc) {
    throw new OrderInvalidStatusError(
      "وضعیت سفارش تغییر کرده است و دیگر امکان لغو آن وجود ندارد",
    );
  }

  // Restore stock for cancelled order items
  for (const it of updatedDoc.items) {
    if (it.itemType === "catalog" && it.matchedSupplierOfferId) {
      await incrementOfferStock(it.matchedSupplierOfferId.toString(), it.quantity);
    }
  }

  const refreshed = await findOrderByIdForCafe(identity.cafeId, orderId);
  return refreshed!;
}

// ---------------------------------------------------------------------------
// 3. Supplier Orders Operations (Read & Status Transitions)
// ---------------------------------------------------------------------------

export async function getSupplierOrder(
  orderId: string,
  providedIdentity?: SupplierMemberIdentity,
): Promise<SupplierOrderDetailDTO> {
  const identity = providedIdentity || (await requireSupplierOrderAuth());

  if (!canViewSupplierOrders(identity)) {
    throw new OrderPermissionError(
      "شما دسترسی لازم برای مشاهده سفارش‌های تأمین‌کننده را ندارید",
    );
  }

  if (!orderId || !Types.ObjectId.isValid(orderId)) {
    throw new OrderValidationError("شناسه سفارش معتبر نیست");
  }

  const order = await findOrderByIdForSupplier(identity.supplierId, orderId);
  if (!order) {
    throw new OrderNotFoundError("سفارش مورد نظر یافت نشد");
  }

  return order;
}

export async function listSupplierOrders(
  rawQuery: unknown,
  providedIdentity?: SupplierMemberIdentity,
): Promise<SupplierOrderListResult> {
  const identity = providedIdentity || (await requireSupplierOrderAuth());

  if (!canViewSupplierOrders(identity)) {
    throw new OrderPermissionError(
      "شما دسترسی لازم برای مشاهده لیست سفارش‌های تأمین‌کننده را ندارید",
    );
  }

  const parsed = orderQuerySchema.safeParse(rawQuery || {});
  const query = parsed.success
    ? parsed.data
    : { page: 1, pageSize: 20, status: undefined };

  return listOrdersForSupplier(identity.supplierId, {
    page: query.page,
    pageSize: query.pageSize,
    status: query.status as OrderStatus | undefined,
  });
}

export async function confirmSupplierOrder(
  orderId: string,
  providedIdentity?: SupplierMemberIdentity,
): Promise<SupplierOrderDetailDTO> {
  const identity = providedIdentity || (await requireSupplierOrderAuth());

  if (!canManageSupplierOrders(identity)) {
    throw new OrderPermissionError(
      "شما دسترسی لازم برای تأیید سفارش را ندارید",
    );
  }

  if (!orderId || !Types.ObjectId.isValid(orderId)) {
    throw new OrderValidationError("شناسه سفارش معتبر نیست");
  }

  const currentOrder = await findOrderByIdForSupplier(identity.supplierId, orderId);
  if (!currentOrder) {
    throw new OrderNotFoundError("سفارش مورد نظر یافت نشد");
  }

  if (!canTransitionOrderStatus(currentOrder.status, "confirmed", "supplier")) {
    throw new OrderInvalidStatusError(
      `امکان تأیید سفارش در وضعیت "${currentOrder.status}" وجود ندارد`,
    );
  }

  const updatedDoc = await transitionOrderStatusInRepo({
    orderId,
    currentStatus: "placed",
    newStatus: "confirmed",
    tenantFilter: { supplierId: identity.supplierId },
    updateFields: {
      confirmedAt: new Date(),
    },
  });

  if (!updatedDoc) {
    throw new OrderInvalidStatusError(
      "وضعیت سفارش تغییر یافته و امکان تأیید وجود ندارد",
    );
  }

  const refreshed = await findOrderByIdForSupplier(identity.supplierId, orderId);
  return refreshed!;
}

export async function rejectSupplierOrder(
  rawInput: unknown,
  providedIdentity?: SupplierMemberIdentity,
): Promise<SupplierOrderDetailDTO> {
  const identity = providedIdentity || (await requireSupplierOrderAuth());

  if (!canManageSupplierOrders(identity)) {
    throw new OrderPermissionError(
      "شما دسترسی لازم برای رد سفارش را ندارید",
    );
  }

  const parsed = rejectSupplierOrderSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new OrderValidationError(
      parsed.error.issues[0]?.message || "داده‌های ورودی رد سفارش نامعتبر است",
    );
  }

  const { orderId, rejectReason } = parsed.data;

  const currentOrder = await findOrderByIdForSupplier(identity.supplierId, orderId);
  if (!currentOrder) {
    throw new OrderNotFoundError("سفارش مورد نظر یافت نشد");
  }

  if (!canTransitionOrderStatus(currentOrder.status, "rejected", "supplier")) {
    throw new OrderInvalidStatusError(
      `امکان رد سفارش در وضعیت "${currentOrder.status}" وجود ندارد`,
    );
  }

  const updatedDoc = await transitionOrderStatusInRepo({
    orderId,
    currentStatus: "placed",
    newStatus: "rejected",
    tenantFilter: { supplierId: identity.supplierId },
    updateFields: {
      rejectedAt: new Date(),
      rejectedByUserId: new Types.ObjectId(identity.userId),
      rejectReason: rejectReason || null,
    },
  });

  if (!updatedDoc) {
    throw new OrderInvalidStatusError(
      "وضعیت سفارش تغییر یافته و امکان رد آن وجود ندارد",
    );
  }

  // Restore stock when order is rejected
  for (const it of updatedDoc.items) {
    if (it.itemType === "catalog" && it.matchedSupplierOfferId) {
      await incrementOfferStock(it.matchedSupplierOfferId.toString(), it.quantity);
    }
  }

  const refreshed = await findOrderByIdForSupplier(identity.supplierId, orderId);
  return refreshed!;
}

export async function markSupplierOrderPreparing(
  orderId: string,
  providedIdentity?: SupplierMemberIdentity,
): Promise<SupplierOrderDetailDTO> {
  const identity = providedIdentity || (await requireSupplierOrderAuth());

  if (!canManageSupplierOrders(identity)) {
    throw new OrderPermissionError(
      "شما دسترسی لازم برای تغییر وضعیت سفارش را ندارید",
    );
  }

  if (!orderId || !Types.ObjectId.isValid(orderId)) {
    throw new OrderValidationError("شناسه سفارش معتبر نیست");
  }

  const currentOrder = await findOrderByIdForSupplier(identity.supplierId, orderId);
  if (!currentOrder) {
    throw new OrderNotFoundError("سفارش مورد نظر یافت نشد");
  }

  if (!canTransitionOrderStatus(currentOrder.status, "preparing", "supplier")) {
    throw new OrderInvalidStatusError(
      `امکان تغییر وضعیت به در حال آماده‌سازی در وضعیت فعلی "${currentOrder.status}" وجود ندارد`,
    );
  }

  const updatedDoc = await transitionOrderStatusInRepo({
    orderId,
    currentStatus: "confirmed",
    newStatus: "preparing",
    tenantFilter: { supplierId: identity.supplierId },
    updateFields: {
      preparingAt: new Date(),
    },
  });

  if (!updatedDoc) {
    throw new OrderInvalidStatusError(
      "وضعیت سفارش تغییر یافته و امکان انجام عملیات وجود ندارد",
    );
  }

  const refreshed = await findOrderByIdForSupplier(identity.supplierId, orderId);
  return refreshed!;
}

export async function markSupplierOrderShipped(
  rawInput: unknown,
  providedIdentity?: SupplierMemberIdentity,
): Promise<SupplierOrderDetailDTO> {
  const identity = providedIdentity || (await requireSupplierOrderAuth());

  if (!canManageSupplierOrders(identity)) {
    throw new OrderPermissionError(
      "شما دسترسی لازم برای تغییر وضعیت سفارش را ندارید",
    );
  }

  const parsed = markSupplierOrderShippedSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new OrderValidationError(
      parsed.error.issues[0]?.message || "داده‌های ورودی نامعتبر است",
    );
  }

  const { orderId, shippingNote } = parsed.data;

  const currentOrder = await findOrderByIdForSupplier(identity.supplierId, orderId);
  if (!currentOrder) {
    throw new OrderNotFoundError("سفارش مورد نظر یافت نشد");
  }

  if (!canTransitionOrderStatus(currentOrder.status, "shipped", "supplier")) {
    throw new OrderInvalidStatusError(
      `امکان تغییر وضعیت به ارسال‌شده در وضعیت فعلی "${currentOrder.status}" وجود ندارد`,
    );
  }

  const updatedDoc = await transitionOrderStatusInRepo({
    orderId,
    currentStatus: "preparing",
    newStatus: "shipped",
    tenantFilter: { supplierId: identity.supplierId },
    updateFields: {
      shippedAt: new Date(),
      shippingNote: shippingNote || null,
    },
  });

  if (!updatedDoc) {
    throw new OrderInvalidStatusError(
      "وضعیت سفارش تغییر یافته و امکان انجام عملیات وجود ندارد",
    );
  }

  const refreshed = await findOrderByIdForSupplier(identity.supplierId, orderId);
  return refreshed!;
}

export async function markSupplierOrderDelivered(
  orderId: string,
  providedIdentity?: SupplierMemberIdentity,
): Promise<SupplierOrderDetailDTO> {
  const identity = providedIdentity || (await requireSupplierOrderAuth());

  if (!canManageSupplierOrders(identity)) {
    throw new OrderPermissionError(
      "شما دسترسی لازم برای تغییر وضعیت سفارش را ندارید",
    );
  }

  if (!orderId || !Types.ObjectId.isValid(orderId)) {
    throw new OrderValidationError("شناسه سفارش معتبر نیست");
  }

  const currentOrder = await findOrderByIdForSupplier(identity.supplierId, orderId);
  if (!currentOrder) {
    throw new OrderNotFoundError("سفارش مورد نظر یافت نشد");
  }

  if (!canTransitionOrderStatus(currentOrder.status, "delivered", "supplier")) {
    throw new OrderInvalidStatusError(
      `امکان تغییر وضعیت به تحویل‌شده در وضعیت فعلی "${currentOrder.status}" وجود ندارد`,
    );
  }

  const updatedDoc = await transitionOrderStatusInRepo({
    orderId,
    currentStatus: "shipped",
    newStatus: "delivered",
    tenantFilter: { supplierId: identity.supplierId },
    updateFields: {
      deliveredAt: new Date(),
    },
  });

  if (!updatedDoc) {
    throw new OrderInvalidStatusError(
      "وضعیت سفارش تغییر یافته و امکان انجام عملیات وجود ندارد",
    );
  }

  const refreshed = await findOrderByIdForSupplier(identity.supplierId, orderId);
  return refreshed!;
}
