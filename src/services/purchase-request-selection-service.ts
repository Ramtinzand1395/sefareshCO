import "server-only";

import { Types } from "mongoose";

import {
  canCompareSuppliers,
  canViewPurchaseRequests,
  type CafeMemberIdentity,
} from "@/src/domain/cafe-access";
import type {
  PurchaseRequestComparisonDTO,
  PurchaseRequestComparisonItemDTO,
  PurchaseRequestComparisonResponseOptionDTO,
  PurchaseRequestSelectionDTO,
  PurchaseRequestSelectionItemDTO,
  PurchaseRequestSelectionSupplierGroupDTO,
  SavePurchaseRequestSelectionResultDTO,
} from "@/src/domain/purchase-request-selection";
import {
  calculateSelectionTotalsAndGroups,
  PurchaseRequestSelectionCalculationError,
  PurchaseRequestSelectionConflictError,
  PurchaseRequestSelectionInvariantError,
  type SelectionItemCalculationInput,
} from "@/src/domain/purchase-request-selection-totals";
import {
  savePurchaseRequestSelectionSchema,
  type SavePurchaseRequestSelectionInput,
} from "@/src/domain/schemas/purchase-request-selection";
import { getCurrentCafeIdentity } from "@/src/lib/auth-helpers";
import {
  findComparisonDataBatch,
  saveSelectionInRepo,
} from "@/src/repositories/purchase-request-selection-repository";

// ---------------------------------------------------------------------------
// Domain Errors
// ---------------------------------------------------------------------------

export class PurchaseRequestSelectionAuthError extends Error {
  constructor(message = "دسترسی به اطلاعات کافه ممکن نیست؛ لطفاً وارد شوید") {
    super(message);
    this.name = "PurchaseRequestSelectionAuthError";
  }
}

export class PurchaseRequestSelectionPermissionError extends Error {
  constructor(
    message = "شما دسترسی لازم برای انتخاب تأمین‌کنندگان این استعلام قیمت را ندارید",
  ) {
    super(message);
    this.name = "PurchaseRequestSelectionPermissionError";
  }
}

export class PurchaseRequestSelectionNotFoundError extends Error {
  constructor(message = "استعلام قیمت یا انتخاب مورد نظر یافت نشد") {
    super(message);
    this.name = "PurchaseRequestSelectionNotFoundError";
  }
}

export class PurchaseRequestSelectionInvalidStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseRequestSelectionInvalidStatusError";
  }
}

export class PurchaseRequestSelectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseRequestSelectionValidationError";
  }
}

export {
  PurchaseRequestSelectionCalculationError,
  PurchaseRequestSelectionConflictError,
  PurchaseRequestSelectionInvariantError,
};

type ResponseItemLean = {
  purchaseRequestItemId: Types.ObjectId | string;
  status: "quoted" | "unavailable";
  unitPrice?: number | null;
  confirmedQuantity?: number;
  itemSubtotal?: number;
};

// ---------------------------------------------------------------------------
// Guard: Session-based Cafe Member Access
// ---------------------------------------------------------------------------

export async function requireCafeMemberAccess(): Promise<CafeMemberIdentity> {
  const identity = await getCurrentCafeIdentity();
  if (!identity) {
    throw new PurchaseRequestSelectionAuthError();
  }
  return identity;
}

// ---------------------------------------------------------------------------
// 1. Get Purchase Request Comparison DTO (Batch read, zero N+1)
// ---------------------------------------------------------------------------

export async function getPurchaseRequestComparison(
  purchaseRequestId: string,
  providedIdentity?: CafeMemberIdentity,
): Promise<PurchaseRequestComparisonDTO> {
  const identity = providedIdentity || (await requireCafeMemberAccess());

  if (!canViewPurchaseRequests(identity)) {
    throw new PurchaseRequestSelectionPermissionError(
      "شما دسترسی لازم برای مشاهده استعلام‌های قیمت کافه را ندارید",
    );
  }

  if (!purchaseRequestId || !Types.ObjectId.isValid(purchaseRequestId)) {
    throw new PurchaseRequestSelectionValidationError(
      "شناسه استعلام قیمت معتبر نیست",
    );
  }

  const batchData = await findComparisonDataBatch(
    identity.cafeId,
    purchaseRequestId,
  );

  if (!batchData) {
    throw new PurchaseRequestSelectionNotFoundError();
  }

  const {
    rfqDoc,
    supplierRequests,
    supplierResponses,
    existingSelection,
    supplierNameMap,
    selectedByUserName,
  } = batchData;

  // Map SupplierRequests by ID
  const supplierRequestMap = new Map(
    supplierRequests.map((sr) => [sr._id.toString(), sr]),
  );

  // Map selections by purchaseRequestItemId if an active selection exists
  type SelectionItemRaw = {
    purchaseRequestItemId: Types.ObjectId;
    supplierRequestId: Types.ObjectId;
    supplierResponseId: Types.ObjectId;
    supplierId: Types.ObjectId;
    supplierName: string;
    selectedQuantity: number;
    unitPrice: number;
    itemSubtotal: number;
    supplierResponseUpdatedAt: Date;
  };

  const selectedItemsByRfqItemId = new Map<string, SelectionItemRaw[]>();
  if (existingSelection?.items) {
    for (const item of existingSelection.items as SelectionItemRaw[]) {
      const key = item.purchaseRequestItemId.toString();
      const existingArr = selectedItemsByRfqItemId.get(key) || [];
      existingArr.push(item);
      selectedItemsByRfqItemId.set(key, existingArr);
    }
  }

  // Map latest responses by ID for fast lookup and change detection
  const responseMap = new Map(
    supplierResponses.map((r) => [r._id.toString(), r]),
  );

  // Build item comparison views
  const comparisonItems: PurchaseRequestComparisonItemDTO[] = [];

  for (const rfqItem of rfqDoc.items) {
    const rfqItemIdStr = rfqItem._id.toString();
    const title =
      rfqItem.itemType === "catalog"
        ? rfqItem.productSnapshot?.name || "کالای کاتالوگ"
        : rfqItem.customTitle || "کالای سفارشی";
    const unit =
      rfqItem.itemType === "catalog"
        ? rfqItem.productSnapshot?.unit || ""
        : rfqItem.customUnit || "";

    const itemSelections = selectedItemsByRfqItemId.get(rfqItemIdStr) || [];
    const itemSelectedQuantity = itemSelections.reduce(
      (sum, s) => sum + s.selectedQuantity,
      0,
    );
    const itemRemainingQuantity = Math.max(
      0,
      rfqItem.quantity - itemSelectedQuantity,
    );

    // Find all responses that addressed this item
    const options: PurchaseRequestComparisonResponseOptionDTO[] = [];
    let lowestUnitPrice: number | undefined;

    for (const resp of supplierResponses) {
      const respItems = resp.items as unknown as ResponseItemLean[];
      const matchedRespItem = respItems.find(
        (it) => it.purchaseRequestItemId.toString() === rfqItemIdStr,
      );

      if (!matchedRespItem) continue;

      const parentReq = supplierRequestMap.get(resp.supplierRequestId.toString());
      const supplierName =
        supplierNameMap.get(resp.supplierId.toString()) || "تأمین‌کننده ناشناس";

      // Selectable invariant: response item is quoted, parent request is responded, confirmedQuantity > 0
      const isSelectable =
        matchedRespItem.status === "quoted" &&
        parentReq?.status === "responded" &&
        (matchedRespItem.confirmedQuantity || 0) > 0;

      // Detect if supplier modified this response after cafe made its selection
      let isModifiedAfterSelection = false;
      const matchedSelection = itemSelections.find(
        (s) => s.supplierResponseId.toString() === resp._id.toString(),
      );
      if (matchedSelection && resp.updatedAt) {
        const respUpdatedTime = new Date(resp.updatedAt).getTime();
        const snapshotTime = new Date(
          matchedSelection.supplierResponseUpdatedAt,
        ).getTime();
        if (respUpdatedTime > snapshotTime) {
          isModifiedAfterSelection = true;
        }
      }

      if (isSelectable && matchedRespItem.unitPrice) {
        if (
          lowestUnitPrice === undefined ||
          matchedRespItem.unitPrice < lowestUnitPrice
        ) {
          lowestUnitPrice = matchedRespItem.unitPrice;
        }
      }

      options.push({
        supplierId: resp.supplierId.toString(),
        supplierName,
        supplierRequestId: resp.supplierRequestId.toString(),
        supplierResponseId: resp._id.toString(),
        status: matchedRespItem.status,
        unitPrice:
          matchedRespItem.status === "quoted"
            ? matchedRespItem.unitPrice ?? undefined
            : undefined,
        confirmedQuantity: matchedRespItem.confirmedQuantity || 0,
        itemSubtotal: matchedRespItem.itemSubtotal || 0,
        deliveryDays: resp.deliveryDays,
        shippingCost: resp.shippingCost,
        respondedAt: (resp.respondedAt || new Date()).toISOString(),
        isSelectable,
        isModifiedAfterSelection,
      });
    }

    comparisonItems.push({
      purchaseRequestItemId: rfqItemIdStr,
      itemType: rfqItem.itemType,
      title,
      unit,
      requestedQuantity: rfqItem.quantity,
      selectedQuantity: itemSelectedQuantity,
      remainingQuantity: itemRemainingQuantity,
      lowestUnitPrice,
      responses: options,
    });
  }

  // Format existing selection DTO if available
  let currentSelectionDTO: PurchaseRequestSelectionDTO | null = null;
  if (existingSelection) {
    currentSelectionDTO = formatSelectionDTO(
      existingSelection,
      rfqDoc.items,
      responseMap,
      selectedByUserName,
    );
  }

  return {
    purchaseRequestId: rfqDoc._id.toString(),
    referenceNumber: rfqDoc.referenceNumber,
    cafeId: rfqDoc.cafeId.toString(),
    rfqStatus: rfqDoc.status,
    neededByDate: rfqDoc.neededByDate
      ? rfqDoc.neededByDate.toISOString()
      : undefined,
    totalRfqItems: rfqDoc.items.length,
    items: comparisonItems,
    currentSelection: currentSelectionDTO,
  };
}

// ---------------------------------------------------------------------------
// 2. Get Single Purchase Request Selection DTO
// ---------------------------------------------------------------------------

export async function getPurchaseRequestSelection(
  purchaseRequestId: string,
  providedIdentity?: CafeMemberIdentity,
): Promise<PurchaseRequestSelectionDTO | null> {
  const identity = providedIdentity || (await requireCafeMemberAccess());

  if (!canViewPurchaseRequests(identity)) {
    throw new PurchaseRequestSelectionPermissionError(
      "شما دسترسی لازم برای مشاهده انتخاب‌های استعلام قیمت کافه را ندارید",
    );
  }

  if (!purchaseRequestId || !Types.ObjectId.isValid(purchaseRequestId)) {
    throw new PurchaseRequestSelectionValidationError(
      "شناسه استعلام قیمت معتبر نیست",
    );
  }

  const batchData = await findComparisonDataBatch(
    identity.cafeId,
    purchaseRequestId,
  );

  if (!batchData || !batchData.existingSelection) {
    return null;
  }

  const responseMap = new Map(
    batchData.supplierResponses.map((r) => [r._id.toString(), r]),
  );

  return formatSelectionDTO(
    batchData.existingSelection,
    batchData.rfqDoc.items,
    responseMap,
    batchData.selectedByUserName,
  );
}

// ---------------------------------------------------------------------------
// 3. Save Purchase Request Selection (Item-level, Split Quantity, Authoritative Prices)
// ---------------------------------------------------------------------------

export async function savePurchaseRequestSelection(
  rawInput: unknown,
  providedIdentity?: CafeMemberIdentity,
): Promise<SavePurchaseRequestSelectionResultDTO> {
  const identity = providedIdentity || (await requireCafeMemberAccess());

  // Strict role / explicit permission enforcement
  if (!canCompareSuppliers(identity)) {
    throw new PurchaseRequestSelectionPermissionError();
  }

  const parsed = savePurchaseRequestSelectionSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    throw new PurchaseRequestSelectionValidationError(
      firstIssue || "داده‌های ورودی انتخاب تأمین‌کنندگان نامعتبر است",
    );
  }

  const input: SavePurchaseRequestSelectionInput = parsed.data;

  // 1. Batch load RFQ and related responses for current Cafe tenant
  const batchData = await findComparisonDataBatch(
    identity.cafeId,
    input.purchaseRequestId,
  );

  if (!batchData) {
    throw new PurchaseRequestSelectionNotFoundError();
  }

  const { rfqDoc, supplierRequests, supplierResponses, supplierNameMap } =
    batchData;

  // 2. Enforce PurchaseRequest lifecycle preconditions
  if (rfqDoc.status === "cancelled") {
    throw new PurchaseRequestSelectionInvalidStatusError(
      "امکان ثبت یا تغییر انتخاب برای استعلام قیمت لغوشده وجود ندارد",
    );
  }

  if (rfqDoc.status === "draft") {
    throw new PurchaseRequestSelectionInvalidStatusError(
      "امکان انتخاب تأمین‌کننده برای پیش‌نویس استعلام قیمت وجود ندارد؛ استعلام باید ابتدا ارسال شود",
    );
  }

  if (rfqDoc.status !== "submitted") {
    throw new PurchaseRequestSelectionInvalidStatusError(
      `وضعیت استعلام قیمت "${rfqDoc.status}" برای انتخاب مجاز نیست`,
    );
  }

  // 3. Index RFQ items
  type RfqItemLean = {
    _id: Types.ObjectId;
    itemType: string;
    quantity: number;
    customTitle?: string | null;
    productSnapshot?: { name: string } | null;
  };

  const rfqItemMap = new Map<string, RfqItemLean>();
  for (const it of rfqDoc.items as unknown as RfqItemLean[]) {
    rfqItemMap.set(it._id.toString(), it);
  }

  // Map of SupplierRequests for status check
  const supplierRequestMap = new Map(
    supplierRequests.map((sr) => [sr._id.toString(), sr]),
  );

  // Map of SupplierResponses for authoritative data
  const responseMap = new Map(
    supplierResponses.map((r) => [r._id.toString(), r]),
  );

  // 4. Handle Empty Selection (clearing selection state)
  if (input.items.length === 0) {
    const calcResult = calculateSelectionTotalsAndGroups(
      [],
      rfqDoc.items.length,
      0,
      0,
    );

    const saveResult = await saveSelectionInRepo({
      purchaseRequestId: rfqDoc._id.toString(),
      cafeId: identity.cafeId,
      selectedByUserId: identity.userId,
      expectedVersion: input.expectedVersion,
      items: calcResult.items,
      supplierGroups: calcResult.supplierGroups,
      totals: calcResult.totals,
    });

    if (saveResult.conflict) {
      throw new PurchaseRequestSelectionConflictError();
    }

    return {
      selectionId: saveResult.id!,
      version: saveResult.version!,
      selectedItemCount: 0,
      fullySelectedItemCount: 0,
      partiallySelectedItemCount: 0,
      unselectedItemCount: rfqDoc.items.length,
      estimatedItemsTotal: 0,
      shippingTotal: 0,
      estimatedTotal: 0,
    };
  }

  // 5. Verify every selection item and check for duplicate item-offer pairs
  const seenPairKey = new Set<string>();
  const selectedQuantityByRfqItemId = new Map<string, number>();
  const preparedInputs: SelectionItemCalculationInput[] = [];

  for (const itemInput of input.items) {
    // Prevent duplicate selection of same response for same RFQ item
    const pairKey = `${itemInput.purchaseRequestItemId}:${itemInput.supplierResponseId}`;
    if (seenPairKey.has(pairKey)) {
      throw new PurchaseRequestSelectionValidationError(
        "نمی‌توان یک پیشنهاد را برای یک قلم بیش از یک بار در یک انتخاب ارسال کرد",
      );
    }
    seenPairKey.add(pairKey);

    // Verify RFQ item exists
    const rfqItem = rfqItemMap.get(itemInput.purchaseRequestItemId);
    if (!rfqItem) {
      throw new PurchaseRequestSelectionValidationError(
        "قلم استعلام قیمت انتخابی در این استعلام قیمت یافت نشد",
      );
    }

    // Verify response exists and belongs to this RFQ and Cafe
    const response = responseMap.get(itemInput.supplierResponseId);
    if (!response) {
      throw new PurchaseRequestSelectionValidationError(
        "پاسخ تأمین‌کننده انتخابی یافت نشد یا به این استعلام قیمت تعلق ندارد",
      );
    }

    // Verify parent request status is responded
    const parentReq = supplierRequestMap.get(response.supplierRequestId.toString());
    if (!parentReq || parentReq.status !== "responded") {
      throw new PurchaseRequestSelectionValidationError(
        "امکان انتخاب از درخواست‌های لغوشده، ردشده یا در انتظار پاسخ وجود ندارد",
      );
    }

    // Verify response item exists
    const respItems = response.items as unknown as ResponseItemLean[];
    const respItem = respItems.find(
      (it) =>
        it.purchaseRequestItemId.toString() === itemInput.purchaseRequestItemId,
    );

    if (!respItem) {
      throw new PurchaseRequestSelectionValidationError(
        "قلم مورد نظر در پاسخ تأمین‌کننده یافت نشد",
      );
    }

    // Verify status is quoted (unavailable is strictly rejected)
    if (respItem.status !== "quoted") {
      throw new PurchaseRequestSelectionValidationError(
        "امکان انتخاب قلم ناموجود اعلام‌شده توسط تأمین‌کننده وجود ندارد",
      );
    }

    // Verify selectedQuantity <= confirmedQuantity
    const confirmedQty = respItem.confirmedQuantity ?? 0;
    if (itemInput.selectedQuantity > confirmedQty) {
      throw new PurchaseRequestSelectionInvariantError(
        `تعداد انتخابی (${itemInput.selectedQuantity}) نمی‌تواند بیشتر از تعداد تأییدشده توسط تأمین‌کننده (${confirmedQty}) باشد`,
      );
    }

    // Track total selected per RFQ item
    const currentTotal =
      selectedQuantityByRfqItemId.get(itemInput.purchaseRequestItemId) || 0;
    const newTotal = currentTotal + itemInput.selectedQuantity;
    selectedQuantityByRfqItemId.set(itemInput.purchaseRequestItemId, newTotal);

    // Check item-level invariant: sum(selectedQuantity) <= requestedQuantity
    if (newTotal > rfqItem.quantity) {
      throw new PurchaseRequestSelectionInvariantError(
        `مجموع تعداد انتخابی برای قلم (${newTotal}) نمی‌تواند بیشتر از تعداد درخواستی در استعلام (${rfqItem.quantity}) باشد`,
      );
    }

    const supplierName =
      supplierNameMap.get(response.supplierId.toString()) ||
      "تأمین‌کننده ناشناس";

    // Authoritative prices, delivery, and response timestamps strictly from DB
    preparedInputs.push({
      purchaseRequestItemId: itemInput.purchaseRequestItemId,
      supplierRequestId: response.supplierRequestId.toString(),
      supplierResponseId: response._id.toString(),
      supplierId: response.supplierId.toString(),
      supplierName,
      selectedQuantity: itemInput.selectedQuantity,
      unitPrice: respItem.unitPrice!,
      deliveryDays: response.deliveryDays,
      shippingCost: response.shippingCost,
      supplierResponseUpdatedAt: response.updatedAt || response.respondedAt || new Date(),
    });
  }

  // 6. Calculate item completeness counts
  let fullySelectedCount = 0;
  let partiallySelectedCount = 0;

  for (const [rfqItemId, totalSelected] of selectedQuantityByRfqItemId.entries()) {
    const rfqItem = rfqItemMap.get(rfqItemId)!;
    if (totalSelected === rfqItem.quantity) {
      fullySelectedCount++;
    } else if (totalSelected > 0) {
      partiallySelectedCount++;
    }
  }

  // 7. Calculate authoritative totals and groups with safe integer math
  let calcResult;
  try {
    calcResult = calculateSelectionTotalsAndGroups(
      preparedInputs,
      rfqDoc.items.length,
      fullySelectedCount,
      partiallySelectedCount,
    );
  } catch (calcErr) {
    if (calcErr instanceof PurchaseRequestSelectionCalculationError) {
      throw new PurchaseRequestSelectionValidationError(calcErr.message);
    }
    throw calcErr;
  }

  // 8. Atomically persist with optimistic concurrency and replace semantics
  const saveResult = await saveSelectionInRepo({
    purchaseRequestId: rfqDoc._id.toString(),
    cafeId: identity.cafeId,
    selectedByUserId: identity.userId,
    expectedVersion: input.expectedVersion,
    items: calcResult.items,
    supplierGroups: calcResult.supplierGroups,
    totals: calcResult.totals,
  });

  if (saveResult.conflict) {
    throw new PurchaseRequestSelectionConflictError();
  }

  return {
    selectionId: saveResult.id!,
    version: saveResult.version!,
    selectedItemCount: calcResult.totals.selectedItemCount,
    fullySelectedItemCount: calcResult.totals.fullySelectedItemCount,
    partiallySelectedItemCount: calcResult.totals.partiallySelectedItemCount,
    unselectedItemCount: calcResult.totals.unselectedItemCount,
    estimatedItemsTotal: calcResult.totals.estimatedItemsTotal,
    shippingTotal: calcResult.totals.shippingTotal,
    estimatedTotal: calcResult.totals.estimatedTotal,
  };
}

// ---------------------------------------------------------------------------
// Internal Helper: Format Selection Document to Serializable DTO
// ---------------------------------------------------------------------------

function formatSelectionDTO(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectionDoc: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rfqItems: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  responseMap: Map<string, any>,
  selectedByUserName?: string,
): PurchaseRequestSelectionDTO {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemsByRfqId = new Map<string, any[]>();
  for (const it of selectionDoc.items || []) {
    const key = it.purchaseRequestItemId.toString();
    const arr = itemsByRfqId.get(key) || [];
    arr.push(it);
    itemsByRfqId.set(key, arr);
  }

  const formattedItems: PurchaseRequestSelectionItemDTO[] = rfqItems.map(
    (rfqItem) => {
      const rfqItemIdStr = rfqItem._id.toString();
      const title =
        rfqItem.itemType === "catalog"
          ? rfqItem.productSnapshot?.name || "کالای کاتالوگ"
          : rfqItem.customTitle || "کالای سفارشی";
      const unit =
        rfqItem.itemType === "catalog"
          ? rfqItem.productSnapshot?.unit || ""
          : rfqItem.customUnit || "";

      const rawSelections = itemsByRfqId.get(rfqItemIdStr) || [];
      const itemSelectedQuantity = rawSelections.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sum: number, s: any) => sum + s.selectedQuantity,
        0,
      );
      const remainingQuantity = Math.max(
        0,
        rfqItem.quantity - itemSelectedQuantity,
      );

      return {
        purchaseRequestItemId: rfqItemIdStr,
        itemType: rfqItem.itemType,
        title,
        unit,
        requestedQuantity: rfqItem.quantity,
        selectedQuantity: itemSelectedQuantity,
        remainingQuantity,
        isFullySelected: itemSelectedQuantity === rfqItem.quantity,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        selections: rawSelections.map((sel: any) => {
          const resp = responseMap.get(sel.supplierResponseId.toString());
          let responseModifiedAfterSelection = false;
          if (resp?.updatedAt && sel.supplierResponseUpdatedAt) {
            const respTime = new Date(resp.updatedAt).getTime();
            const snapTime = new Date(sel.supplierResponseUpdatedAt).getTime();
            if (respTime > snapTime) {
              responseModifiedAfterSelection = true;
            }
          }

          return {
            supplierId: sel.supplierId.toString(),
            supplierName: sel.supplierName,
            supplierRequestId: sel.supplierRequestId.toString(),
            supplierResponseId: sel.supplierResponseId.toString(),
            selectedQuantity: sel.selectedQuantity,
            unitPrice: sel.unitPrice,
            itemSubtotal: sel.itemSubtotal,
            responseModifiedAfterSelection,
          };
        }),
      };
    },
  );

  const formattedSupplierGroups: PurchaseRequestSelectionSupplierGroupDTO[] = (
    selectionDoc.supplierGroups || []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ).map((grp: any) => {
    const resp = responseMap.get(grp.supplierResponseId.toString());
    let responseModifiedAfterSelection = false;
    if (resp?.updatedAt) {
      // Check if any item in this group has an older snapshot
      const groupItems = (selectionDoc.items || []).filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (it: any) =>
          it.supplierResponseId.toString() === grp.supplierResponseId.toString(),
      );
      for (const it of groupItems) {
        if (it.supplierResponseUpdatedAt) {
          const respTime = new Date(resp.updatedAt).getTime();
          const snapTime = new Date(it.supplierResponseUpdatedAt).getTime();
          if (respTime > snapTime) {
            responseModifiedAfterSelection = true;
            break;
          }
        }
      }
    }

    const itemCount = (selectionDoc.items || []).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (it: any) =>
        it.supplierResponseId.toString() === grp.supplierResponseId.toString(),
    ).length;

    return {
      supplierId: grp.supplierId.toString(),
      supplierName: grp.supplierName,
      supplierResponseId: grp.supplierResponseId.toString(),
      deliveryDays: grp.deliveryDays,
      shippingCost: grp.shippingCost,
      itemsSubtotal: grp.itemsSubtotal,
      supplierTotal: grp.supplierTotal,
      itemCount,
      responseModifiedAfterSelection,
    };
  });

  return {
    id: selectionDoc._id.toString(),
    purchaseRequestId: selectionDoc.purchaseRequestId.toString(),
    cafeId: selectionDoc.cafeId.toString(),
    version: selectionDoc.version,
    selectedByUserId: selectionDoc.selectedByUserId.toString(),
    selectedByUserName,
    items: formattedItems,
    supplierGroups: formattedSupplierGroups,
    totals: {
      selectedItemCount: selectionDoc.totals.selectedItemCount,
      fullySelectedItemCount: selectionDoc.totals.fullySelectedItemCount,
      partiallySelectedItemCount:
        selectionDoc.totals.partiallySelectedItemCount,
      unselectedItemCount: selectionDoc.totals.unselectedItemCount,
      estimatedItemsTotal: selectionDoc.totals.estimatedItemsTotal,
      shippingTotal: selectionDoc.totals.shippingTotal,
      estimatedTotal: selectionDoc.totals.estimatedTotal,
    },
    createdAt: (selectionDoc.createdAt || new Date()).toISOString(),
    updatedAt: (selectionDoc.updatedAt || new Date()).toISOString(),
  };
}
