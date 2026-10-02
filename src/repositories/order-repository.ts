import { Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { Cafe } from "@/model/cafe";
import {
  Order,
  type OrderItemType,
  type OrderStatus,
} from "@/model/order";
import { SupplierOffer } from "@/model/supplier-offer";
import { Supplier } from "@/model/supplier";
import { normalizeAdminPagination } from "@/src/lib/admin-query";
import {
  generateOrderNumber,
  type CafeOrderDetailDTO,
  type CafeOrderListItemDTO,
  type CafeOrderListResult,
  type OrderFinancialSummaryDTO,
  type OrderItemSnapshotDTO,
  type SupplierOrderDetailDTO,
  type SupplierOrderListItemDTO,
  type SupplierOrderListResult,
  getCafeOrderAllowedActions,
  getSupplierOrderAllowedActions,
} from "@/src/domain/order";

// ---------------------------------------------------------------------------
// Internal Lean Types
// ---------------------------------------------------------------------------

export type OrderItemLean = {
  _id: Types.ObjectId | { toString(): string };
  purchaseRequestItemId: Types.ObjectId | { toString(): string };
  supplierRequestId: Types.ObjectId | { toString(): string };
  supplierResponseId: Types.ObjectId | { toString(): string };
  productId?: Types.ObjectId | { toString(): string } | null;
  matchedSupplierOfferId?: Types.ObjectId | { toString(): string } | null;
  itemType: OrderItemType;
  title: string;
  unit: string;
  brand?: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type OrderLean = {
  _id: Types.ObjectId | { toString(): string };
  orderNumber: string;
  cafeId: Types.ObjectId | { toString(): string };
  supplierId: Types.ObjectId | { toString(): string };
  purchaseRequestId: Types.ObjectId | { toString(): string };
  purchaseRequestSelectionId: Types.ObjectId | { toString(): string };
  status: OrderStatus;
  items: OrderItemLean[];
  itemsSubtotal: number;
  shippingCost: number;
  totalAmount: number;
  deliveryDays: number;
  createdByUserId: Types.ObjectId | { toString(): string };
  shippingNote?: string | null;
  cancelReason?: string | null;
  cancelledByUserId?: Types.ObjectId | { toString(): string } | null;
  cancelledAt?: Date | null;
  rejectReason?: string | null;
  rejectedByUserId?: Types.ObjectId | { toString(): string } | null;
  rejectedAt?: Date | null;
  placedAt: Date;
  confirmedAt?: Date | null;
  preparingAt?: Date | null;
  shippedAt?: Date | null;
  deliveredAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type CreateOrderRepoItemInput = {
  purchaseRequestItemId: string;
  supplierRequestId: string;
  supplierResponseId: string;
  productId?: string | null;
  matchedSupplierOfferId?: string | null;
  itemType: OrderItemType;
  title: string;
  unit: string;
  brand?: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type CreateOrderRepoInput = {
  cafeId: string;
  supplierId: string;
  purchaseRequestId: string;
  purchaseRequestSelectionId: string;
  items: CreateOrderRepoItemInput[];
  itemsSubtotal: number;
  shippingCost: number;
  totalAmount: number;
  deliveryDays: number;
  createdByUserId: string;
};

// ---------------------------------------------------------------------------
// 1. Stock Validation and Mutation Helpers (Safe & Atomic)
// ---------------------------------------------------------------------------

export async function findOfferStock(
  offerId: string,
): Promise<{ stock: number; status: string } | null> {
  if (!Types.ObjectId.isValid(offerId)) return null;
  await dbConnect();
  const doc = (await SupplierOffer.findById(offerId)
    .select("stock status")
    .lean()) as { stock: number; status: string } | null;
  return doc;
}

export async function findOfferBySupplierAndProduct(
  supplierId: string,
  productId: string,
): Promise<{ _id: Types.ObjectId; stock: number; status: string } | null> {
  if (!Types.ObjectId.isValid(supplierId) || !Types.ObjectId.isValid(productId)) {
    return null;
  }
  await dbConnect();
  const doc = (await SupplierOffer.findOne({
    supplierId: new Types.ObjectId(supplierId),
    productId: new Types.ObjectId(productId),
  })
    .select("_id stock status")
    .lean()) as { _id: Types.ObjectId; stock: number; status: string } | null;
  return doc;
}

export async function decrementOfferStock(
  offerId: string | Types.ObjectId,
  quantity: number,
): Promise<boolean> {
  await dbConnect();
  const res = await SupplierOffer.updateOne(
    {
      _id: new Types.ObjectId(offerId),
      stock: { $gte: quantity },
    },
    {
      $inc: { stock: -quantity },
    },
  );
  return res.modifiedCount > 0;
}

export async function incrementOfferStock(
  offerId: string | Types.ObjectId,
  quantity: number,
): Promise<void> {
  await dbConnect();
  await SupplierOffer.updateOne(
    { _id: new Types.ObjectId(offerId) },
    { $inc: { stock: quantity } },
  );
}

// ---------------------------------------------------------------------------
// 2. Idempotent Order Creation with Reference Collision Retry
// ---------------------------------------------------------------------------

export async function createOrderInRepo(
  input: CreateOrderRepoInput,
): Promise<{ order: OrderLean; isExisting: boolean }> {
  await dbConnect();

  const cafeObjId = new Types.ObjectId(input.cafeId);
  const supplierObjId = new Types.ObjectId(input.supplierId);
  const rfqObjId = new Types.ObjectId(input.purchaseRequestId);
  const selectionObjId = new Types.ObjectId(input.purchaseRequestSelectionId);
  const userObjId = new Types.ObjectId(input.createdByUserId);

  // Check if order already exists for this selection + supplier (idempotency fast-path)
  const existingOrder = (await Order.findOne({
    purchaseRequestSelectionId: selectionObjId,
    supplierId: supplierObjId,
  }).lean()) as OrderLean | null;

  if (existingOrder) {
    return { order: existingOrder, isExisting: true };
  }

  const dbItems = input.items.map((i) => ({
    _id: new Types.ObjectId(),
    purchaseRequestItemId: new Types.ObjectId(i.purchaseRequestItemId),
    supplierRequestId: new Types.ObjectId(i.supplierRequestId),
    supplierResponseId: new Types.ObjectId(i.supplierResponseId),
    productId: i.productId ? new Types.ObjectId(i.productId) : null,
    matchedSupplierOfferId: i.matchedSupplierOfferId
      ? new Types.ObjectId(i.matchedSupplierOfferId)
      : null,
    itemType: i.itemType,
    title: i.title,
    unit: i.unit,
    brand: i.brand ?? null,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    subtotal: i.subtotal,
  }));

  const now = new Date();

  // Retry loop for unique orderNumber collision resistance
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const orderNumber = generateOrderNumber();

    try {
      const created = (await Order.create({
        orderNumber,
        cafeId: cafeObjId,
        supplierId: supplierObjId,
        purchaseRequestId: rfqObjId,
        purchaseRequestSelectionId: selectionObjId,
        status: "placed",
        items: dbItems,
        itemsSubtotal: input.itemsSubtotal,
        shippingCost: input.shippingCost,
        totalAmount: input.totalAmount,
        deliveryDays: input.deliveryDays,
        createdByUserId: userObjId,
        placedAt: now,
      })) as unknown as { toObject(): OrderLean };

      const leanCreated =
        typeof created.toObject === "function" ? created.toObject() : (created as unknown as OrderLean);

      return { order: leanCreated, isExisting: false };
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mongoError = err as any;
      if (mongoError?.code === 11000) {
        // If collision on orderNumber, retry generating new reference
        if (mongoError?.keyPattern?.orderNumber) {
          continue;
        }

        // If duplicate on selectionId + supplierId, another concurrent call created it!
        if (
          mongoError?.keyPattern?.purchaseRequestSelectionId &&
          mongoError?.keyPattern?.supplierId
        ) {
          const concurrentOrder = (await Order.findOne({
            purchaseRequestSelectionId: selectionObjId,
            supplierId: supplierObjId,
          }).lean()) as OrderLean | null;

          if (concurrentOrder) {
            return { order: concurrentOrder, isExisting: true };
          }
        }
      }
      throw err;
    }
  }

  throw new Error("تولید شماره پیگیری سفارش با خطا مواجه شد؛ لطفاً دوباره تلاش کنید");
}

// ---------------------------------------------------------------------------
// 3. Find Orders by Selection ID
// ---------------------------------------------------------------------------

export async function findOrdersBySelectionId(
  selectionId: string,
): Promise<OrderLean[]> {
  if (!Types.ObjectId.isValid(selectionId)) return [];
  await dbConnect();
  return Order.find({
    purchaseRequestSelectionId: new Types.ObjectId(selectionId),
  }).lean() as Promise<OrderLean[]>;
}

// ---------------------------------------------------------------------------
// 4. Cafe Orders (Tenant-Scoped)
// ---------------------------------------------------------------------------

export async function findOrderByIdForCafe(
  cafeId: string,
  orderId: string,
): Promise<CafeOrderDetailDTO | null> {
  if (!Types.ObjectId.isValid(cafeId) || !Types.ObjectId.isValid(orderId)) {
    return null;
  }
  await dbConnect();

  const doc = (await Order.findOne({
    _id: new Types.ObjectId(orderId),
    cafeId: new Types.ObjectId(cafeId),
  }).lean()) as OrderLean | null;

  if (!doc) return null;

  const supplierDoc = (await Supplier.findById(doc.supplierId)
    .select("businessName")
    .lean()) as { businessName?: string } | null;

  const supplierName = supplierDoc?.businessName || "تأمین‌کننده ناشناس";

  return mapToCafeOrderDetailDTO(doc, supplierName);
}

export async function listOrdersForCafe(
  cafeId: string,
  options: { page: number; pageSize: number; status?: OrderStatus },
): Promise<CafeOrderListResult> {
  if (!Types.ObjectId.isValid(cafeId)) {
    return { items: [], total: 0 };
  }
  await dbConnect();

  const { pageSize, skip } = normalizeAdminPagination(
    options.page,
    options.pageSize,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {
    cafeId: new Types.ObjectId(cafeId),
  };

  if (options.status) {
    filter.status = options.status;
  }

  const [rawDocs, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean() as Promise<OrderLean[]>,
    Order.countDocuments(filter),
  ]);

  const supplierIds = Array.from(
    new Set(rawDocs.map((d) => d.supplierId.toString())),
  );
  const supplierMap = new Map<string, string>();
  if (supplierIds.length > 0) {
    const suppliers = await Supplier.find({
      _id: { $in: supplierIds.map((id) => new Types.ObjectId(id)) },
    })
      .select("businessName")
      .lean();
    for (const s of suppliers) {
      supplierMap.set(s._id.toString(), s.businessName);
    }
  }

  const items: CafeOrderListItemDTO[] = rawDocs.map((doc) => ({
    id: doc._id.toString(),
    orderNumber: doc.orderNumber,
    purchaseRequestId: doc.purchaseRequestId.toString(),
    supplierId: doc.supplierId.toString(),
    supplierName:
      supplierMap.get(doc.supplierId.toString()) || "تأمین‌کننده ناشناس",
    status: doc.status,
    itemCount: doc.items.length,
    totalAmount: doc.totalAmount,
    deliveryDays: doc.deliveryDays,
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : "",
    placedAt: doc.placedAt ? doc.placedAt.toISOString() : "",
  }));

  return { items, total };
}

// ---------------------------------------------------------------------------
// 5. Supplier Orders (Tenant-Scoped)
// ---------------------------------------------------------------------------

export async function findOrderByIdForSupplier(
  supplierId: string,
  orderId: string,
): Promise<SupplierOrderDetailDTO | null> {
  if (!Types.ObjectId.isValid(supplierId) || !Types.ObjectId.isValid(orderId)) {
    return null;
  }
  await dbConnect();

  const doc = (await Order.findOne({
    _id: new Types.ObjectId(orderId),
    supplierId: new Types.ObjectId(supplierId),
  }).lean()) as OrderLean | null;

  if (!doc) return null;

  const cafeDoc = (await Cafe.findById(doc.cafeId)
    .select("name")
    .lean()) as { name?: string } | null;

  const cafeName = cafeDoc?.name || "کافه ناشناس";

  return mapToSupplierOrderDetailDTO(doc, cafeName);
}

export async function listOrdersForSupplier(
  supplierId: string,
  options: { page: number; pageSize: number; status?: OrderStatus },
): Promise<SupplierOrderListResult> {
  if (!Types.ObjectId.isValid(supplierId)) {
    return { items: [], total: 0 };
  }
  await dbConnect();

  const { pageSize, skip } = normalizeAdminPagination(
    options.page,
    options.pageSize,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {
    supplierId: new Types.ObjectId(supplierId),
  };

  if (options.status) {
    filter.status = options.status;
  }

  const [rawDocs, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean() as Promise<OrderLean[]>,
    Order.countDocuments(filter),
  ]);

  const cafeIds = Array.from(new Set(rawDocs.map((d) => d.cafeId.toString())));
  const cafeMap = new Map<string, string>();
  if (cafeIds.length > 0) {
    const cafes = await Cafe.find({
      _id: { $in: cafeIds.map((id) => new Types.ObjectId(id)) },
    })
      .select("name")
      .lean();
    for (const c of cafes) {
      cafeMap.set(c._id.toString(), c.name);
    }
  }

  const items: SupplierOrderListItemDTO[] = rawDocs.map((doc) => ({
    id: doc._id.toString(),
    orderNumber: doc.orderNumber,
    purchaseRequestId: doc.purchaseRequestId.toString(),
    cafeId: doc.cafeId.toString(),
    cafeName: cafeMap.get(doc.cafeId.toString()) || "کافه ناشناس",
    status: doc.status,
    itemCount: doc.items.length,
    totalAmount: doc.totalAmount,
    deliveryDays: doc.deliveryDays,
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : "",
    placedAt: doc.placedAt ? doc.placedAt.toISOString() : "",
  }));

  return { items, total };
}

// ---------------------------------------------------------------------------
// 6. Atomic Order Status Transition
// ---------------------------------------------------------------------------

export type TransitionOrderRepoInput = {
  orderId: string;
  currentStatus: OrderStatus;
  newStatus: OrderStatus;
  tenantFilter: { cafeId?: string; supplierId?: string };
  updateFields: Partial<OrderLean>;
};

export async function transitionOrderStatusInRepo(
  input: TransitionOrderRepoInput,
): Promise<OrderLean | null> {
  if (!Types.ObjectId.isValid(input.orderId)) {
    return null;
  }
  await dbConnect();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {
    _id: new Types.ObjectId(input.orderId),
    status: input.currentStatus,
  };

  if (input.tenantFilter.cafeId) {
    query.cafeId = new Types.ObjectId(input.tenantFilter.cafeId);
  }
  if (input.tenantFilter.supplierId) {
    query.supplierId = new Types.ObjectId(input.tenantFilter.supplierId);
  }

  const updatedDoc = (await Order.findOneAndUpdate(
    query,
    {
      $set: {
        status: input.newStatus,
        ...input.updateFields,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  ).lean()) as OrderLean | null;

  return updatedDoc;
}

// ---------------------------------------------------------------------------
// Internal DTO Mappers
// ---------------------------------------------------------------------------

function mapToCafeOrderDetailDTO(
  doc: OrderLean,
  supplierName: string,
): CafeOrderDetailDTO {
  const items: OrderItemSnapshotDTO[] = doc.items.map((i) => ({
    id: i._id.toString(),
    purchaseRequestItemId: i.purchaseRequestItemId.toString(),
    supplierRequestId: i.supplierRequestId.toString(),
    supplierResponseId: i.supplierResponseId.toString(),
    productId: i.productId ? i.productId.toString() : null,
    matchedSupplierOfferId: i.matchedSupplierOfferId
      ? i.matchedSupplierOfferId.toString()
      : null,
    itemType: i.itemType,
    title: i.title,
    unit: i.unit,
    brand: i.brand ?? null,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    subtotal: i.subtotal,
  }));

  const financials: OrderFinancialSummaryDTO = {
    itemsSubtotal: doc.itemsSubtotal,
    shippingCost: doc.shippingCost,
    totalAmount: doc.totalAmount,
  };

  return {
    id: doc._id.toString(),
    orderNumber: doc.orderNumber,
    cafeId: doc.cafeId.toString(),
    createdByUserId: doc.createdByUserId.toString(),
    purchaseRequestId: doc.purchaseRequestId.toString(),
    purchaseRequestSelectionId: doc.purchaseRequestSelectionId.toString(),
    supplier: {
      id: doc.supplierId.toString(),
      businessName: supplierName,
    },
    status: doc.status,
    items,
    financials,
    delivery: {
      deliveryDays: doc.deliveryDays,
      shippingNote: doc.shippingNote ?? null,
    },
    timeline: {
      placedAt: doc.placedAt ? doc.placedAt.toISOString() : "",
      confirmedAt: doc.confirmedAt ? doc.confirmedAt.toISOString() : null,
      preparingAt: doc.preparingAt ? doc.preparingAt.toISOString() : null,
      shippedAt: doc.shippedAt ? doc.shippedAt.toISOString() : null,
      deliveredAt: doc.deliveredAt ? doc.deliveredAt.toISOString() : null,
      cancelledAt: doc.cancelledAt ? doc.cancelledAt.toISOString() : null,
      rejectedAt: doc.rejectedAt ? doc.rejectedAt.toISOString() : null,
    },
    cancellation: doc.cancelledAt
      ? {
          cancelledAt: doc.cancelledAt.toISOString(),
          cancelReason: doc.cancelReason ?? null,
        }
      : null,
    rejection: doc.rejectedAt
      ? {
          rejectedAt: doc.rejectedAt.toISOString(),
          rejectReason: doc.rejectReason ?? null,
        }
      : null,
    allowedActions: getCafeOrderAllowedActions(doc.status),
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : "",
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : "",
  };
}

function mapToSupplierOrderDetailDTO(
  doc: OrderLean,
  cafeName: string,
): SupplierOrderDetailDTO {
  const items: OrderItemSnapshotDTO[] = doc.items.map((i) => ({
    id: i._id.toString(),
    purchaseRequestItemId: i.purchaseRequestItemId.toString(),
    supplierRequestId: i.supplierRequestId.toString(),
    supplierResponseId: i.supplierResponseId.toString(),
    productId: i.productId ? i.productId.toString() : null,
    matchedSupplierOfferId: i.matchedSupplierOfferId
      ? i.matchedSupplierOfferId.toString()
      : null,
    itemType: i.itemType,
    title: i.title,
    unit: i.unit,
    brand: i.brand ?? null,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    subtotal: i.subtotal,
  }));

  const financials: OrderFinancialSummaryDTO = {
    itemsSubtotal: doc.itemsSubtotal,
    shippingCost: doc.shippingCost,
    totalAmount: doc.totalAmount,
  };

  return {
    id: doc._id.toString(),
    orderNumber: doc.orderNumber,
    supplierId: doc.supplierId.toString(),
    purchaseRequestId: doc.purchaseRequestId.toString(),
    purchaseRequestSelectionId: doc.purchaseRequestSelectionId.toString(),
    cafe: {
      id: doc.cafeId.toString(),
      businessName: cafeName,
    },
    status: doc.status,
    items,
    financials,
    delivery: {
      deliveryDays: doc.deliveryDays,
      shippingNote: doc.shippingNote ?? null,
    },
    timeline: {
      placedAt: doc.placedAt ? doc.placedAt.toISOString() : "",
      confirmedAt: doc.confirmedAt ? doc.confirmedAt.toISOString() : null,
      preparingAt: doc.preparingAt ? doc.preparingAt.toISOString() : null,
      shippedAt: doc.shippedAt ? doc.shippedAt.toISOString() : null,
      deliveredAt: doc.deliveredAt ? doc.deliveredAt.toISOString() : null,
      cancelledAt: doc.cancelledAt ? doc.cancelledAt.toISOString() : null,
      rejectedAt: doc.rejectedAt ? doc.rejectedAt.toISOString() : null,
    },
    cancellation: doc.cancelledAt
      ? {
          cancelledAt: doc.cancelledAt.toISOString(),
          cancelReason: doc.cancelReason ?? null,
        }
      : null,
    rejection: doc.rejectedAt
      ? {
          rejectedAt: doc.rejectedAt.toISOString(),
          rejectReason: doc.rejectReason ?? null,
        }
      : null,
    allowedActions: getSupplierOrderAllowedActions(doc.status),
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : "",
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : "",
  };
}
