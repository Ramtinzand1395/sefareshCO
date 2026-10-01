import "server-only";

import { Types } from "mongoose";

import {
  canCreatePurchaseRequest,
  canViewPurchaseRequests,
  type CafeMemberIdentity,
} from "@/src/domain/cafe-access";
import {
  matchPurchaseRequestSchema,
  supplierRequestIdSchema,
  supplierRequestQuerySchema,
  type MatchPurchaseRequestInput,
} from "@/src/domain/schemas/supplier-request";
import { canViewSupplierRequests } from "@/src/domain/supplier-access";
import type {
  SupplierMatchingResultDTO,
  SupplierMatchingUnmatchedItemDTO,
  SupplierRequestCafeViewDTO,
  SupplierRequestProductSnapshot,
  SupplierRequestSupplierViewDTO,
} from "@/src/domain/supplier-request";
import {
  getCurrentCafeIdentity,
  getCurrentSupplierIdentity,
} from "@/src/lib/auth-helpers";
import {
  cancelSupplierRequestsByPurchaseRequest,
  createSupplierRequestsIdempotently,
  findBatchMatchingDataForProductIds,
  findExistingSupplierRequestsByPurchaseRequest,
  findSupplierRequestByIdForSupplier,
  findSupplierRequestsForCafeRFQ,
  findSupplierRequestsForSupplierInbox,
  type CreateSupplierRequestRepoInput,
} from "@/src/repositories/supplier-request-repository";
import { PurchaseRequest } from "@/model/purchase-request";

// ---------------------------------------------------------------------------
// Domain Errors
// ---------------------------------------------------------------------------

export class SupplierMatchingAuthError extends Error {
  constructor(message = "دسترسی نامعتبر است؛ لطفاً وارد شوید") {
    super(message);
    this.name = "SupplierMatchingAuthError";
  }
}

export class SupplierMatchingPermissionError extends Error {
  constructor(message = "شما دسترسی لازم برای این عملیات را ندارید") {
    super(message);
    this.name = "SupplierMatchingPermissionError";
  }
}

export class SupplierMatchingNotFoundError extends Error {
  constructor(message = "استعلام قیمت یا درخواست مورد نظر یافت نشد") {
    super(message);
    this.name = "SupplierMatchingNotFoundError";
  }
}

export class SupplierMatchingInvalidStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupplierMatchingInvalidStatusError";
  }
}

export class SupplierMatchingValidationError extends Error {
  constructor(message = "اطلاعات ورودی تطبیق استعلام قیمت معتبر نیست") {
    super(message);
    this.name = "SupplierMatchingValidationError";
  }
}

// ---------------------------------------------------------------------------
// Authorization Guards
// ---------------------------------------------------------------------------

export async function requireCafeMemberAccess() {
  const identity = await getCurrentCafeIdentity();
  if (!identity) {
    throw new SupplierMatchingAuthError(
      "دسترسی به اطلاعات کافه ممکن نیست؛ لطفاً وارد شوید",
    );
  }
  return identity;
}

export async function requireSupplierMemberAccess() {
  const identity = await getCurrentSupplierIdentity();
  if (!identity) {
    throw new SupplierMatchingAuthError(
      "دسترسی به پنل تأمین‌کننده ممکن نیست؛ لطفاً وارد شوید",
    );
  }
  if (!canViewSupplierRequests(identity)) {
    throw new SupplierMatchingPermissionError(
      "دسترسی لازم برای مشاهده درخواست‌های استعلام را ندارید",
    );
  }
  return identity;
}

// ---------------------------------------------------------------------------
// 1. Core Supplier Matching Engine: PurchaseRequest -> Eligible SupplierRequests
// ---------------------------------------------------------------------------

export async function matchPurchaseRequestToSuppliers(
  rawInput: unknown,
  providedIdentity?: CafeMemberIdentity,
): Promise<SupplierMatchingResultDTO> {
  const identity = providedIdentity || (await requireCafeMemberAccess());

  if (!canCreatePurchaseRequest(identity)) {
    throw new SupplierMatchingPermissionError(
      "شما دسترسی لازم برای تطبیق و ارسال استعلام قیمت به تأمین‌کنندگان را ندارید",
    );
  }

  const parsed = matchPurchaseRequestSchema.safeParse(
    typeof rawInput === "string" ? { requestId: rawInput } : rawInput,
  );
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    throw new SupplierMatchingValidationError(
      firstIssue || "شناسه استعلام قیمت معتبر نیست",
    );
  }

  const input: MatchPurchaseRequestInput = parsed.data;

  if (!Types.ObjectId.isValid(input.requestId)) {
    throw new SupplierMatchingValidationError("شناسه استعلام قیمت نامعتبر است");
  }

  // 1. Fetch PurchaseRequest with tenant scoping
  type RFQItemLean = {
    _id: Types.ObjectId;
    itemType: "catalog" | "custom";
    productId?: Types.ObjectId | null;
    customTitle?: string | null;
    customUnit?: string | null;
    quantity: number;
    note?: string | null;
    productSnapshot?: SupplierRequestProductSnapshot | null;
  };

  type RFQLean = {
    _id: Types.ObjectId;
    cafeId: Types.ObjectId;
    referenceNumber: string;
    status: string;
    items: RFQItemLean[];
  };

  const rfq = (await PurchaseRequest.findOne({
    _id: new Types.ObjectId(input.requestId),
    cafeId: new Types.ObjectId(identity.cafeId),
  }).lean()) as unknown as RFQLean | null;

  if (!rfq) {
    throw new SupplierMatchingNotFoundError("استعلام قیمت مورد نظر یافت نشد");
  }

  // 2. Validate RFQ status: ONLY "submitted" can be matched
  if (rfq.status === "draft") {
    throw new SupplierMatchingInvalidStatusError(
      "امکان تطبیق و ارسال برای پیش‌نویس استعلام قیمت وجود ندارد؛ ابتدا استعلام را نهایی و ارسال کنید",
    );
  }

  if (rfq.status === "cancelled") {
    throw new SupplierMatchingInvalidStatusError(
      "امکان تطبیق برای استعلام قیمت لغوشده وجود ندارد",
    );
  }

  if (rfq.status !== "submitted") {
    throw new SupplierMatchingInvalidStatusError(
      `وضعیت استعلام قیمت "${rfq.status}" برای تطبیق مجاز نیست`,
    );
  }

  // 3. Separate catalog and custom items
  const catalogItems = rfq.items.filter(
    (i) => i.itemType === "catalog" && i.productId,
  );
  const customItems = rfq.items.filter((i) => i.itemType === "custom");

  const unmatchedItems: SupplierMatchingUnmatchedItemDTO[] = [];

  // Custom items have no catalog productId and cannot match SupplierOffers
  for (const c of customItems) {
    unmatchedItems.push({
      purchaseRequestItemId: c._id.toString(),
      itemType: "custom",
      title: c.customTitle || "کالای سفارشی",
      quantity: c.quantity,
      reason: "custom_item",
    });
  }

  const matchedCatalogItemIds = new Set<string>();
  // Grouping structure: Map<supplierId, Array<SupplierRequestItem>>
  const supplierEligibleItems = new Map<
    string,
    Array<{
      purchaseRequestItemId: string;
      productId: string;
      matchedSupplierOfferId: string;
      quantity: number;
      productSnapshot: SupplierRequestProductSnapshot;
      note?: string | null;
    }>
  >();

  // 4. Batch lookup catalog products, offers, and verified suppliers (No N+1 queries)
  if (catalogItems.length > 0) {
    const productIds = Array.from(
      new Set(catalogItems.map((i) => i.productId!.toString())),
    );

    const { productMap, offers, supplierMap } =
      await findBatchMatchingDataForProductIds(productIds);

    // Index offers by productId
    const offersByProduct = new Map<
      string,
      typeof offers
    >();
    for (const o of offers) {
      const list = offersByProduct.get(o.productId) ?? [];
      list.push(o);
      offersByProduct.set(o.productId, list);
    }

    // 5. Evaluate eligibility for each catalog item in memory
    for (const item of catalogItems) {
      const pId = item.productId!.toString();
      const itemId = item._id.toString();
      const productInfo = productMap.get(pId);

      // Check product validity & active category branch
      if (!productInfo || !productInfo.isEligible) {
        unmatchedItems.push({
          purchaseRequestItemId: itemId,
          itemType: "catalog",
          productId: pId,
          title: item.productSnapshot?.name || "کالای کاتالوگ",
          quantity: item.quantity,
          reason: "no_active_offer",
        });
        continue;
      }

      const productOffers = offersByProduct.get(pId) ?? [];

      if (productOffers.length === 0) {
        unmatchedItems.push({
          purchaseRequestItemId: itemId,
          itemType: "catalog",
          productId: pId,
          title: item.productSnapshot?.name || productInfo.name,
          quantity: item.quantity,
          reason: "no_active_offer",
        });
        continue;
      }

      const activeOffers = productOffers.filter((o) => o.status === "active");
      if (activeOffers.length === 0) {
        unmatchedItems.push({
          purchaseRequestItemId: itemId,
          itemType: "catalog",
          productId: pId,
          title: item.productSnapshot?.name || productInfo.name,
          quantity: item.quantity,
          reason: "no_active_offer",
        });
        continue;
      }

      // Check stock sufficiency
      const offersWithStock = activeOffers.filter(
        (o) => o.stock >= item.quantity,
      );
      if (offersWithStock.length === 0) {
        unmatchedItems.push({
          purchaseRequestItemId: itemId,
          itemType: "catalog",
          productId: pId,
          title: item.productSnapshot?.name || productInfo.name,
          quantity: item.quantity,
          reason: "insufficient_stock",
        });
        continue;
      }

      // Check MOQ compliance (RFQ quantity >= minOrderQuantity)
      const offersMeetingMoq = offersWithStock.filter(
        (o) => item.quantity >= o.minOrderQuantity,
      );
      if (offersMeetingMoq.length === 0) {
        unmatchedItems.push({
          purchaseRequestItemId: itemId,
          itemType: "catalog",
          productId: pId,
          title: item.productSnapshot?.name || productInfo.name,
          quantity: item.quantity,
          reason: "below_moq",
        });
        continue;
      }

      // Check Supplier eligibility (exists, status=active, isVerified=true, deletedAt=null)
      const eligibleOffers = offersMeetingMoq.filter((o) => {
        const s = supplierMap.get(o.supplierId);
        return s && s.isEligible;
      });

      if (eligibleOffers.length === 0) {
        unmatchedItems.push({
          purchaseRequestItemId: itemId,
          itemType: "catalog",
          productId: pId,
          title: item.productSnapshot?.name || productInfo.name,
          quantity: item.quantity,
          reason: "no_verified_supplier",
        });
        continue;
      }

      // Item is matched!
      matchedCatalogItemIds.add(itemId);

      // Snapshot from RFQ item preserves historical representation
      const snapshot: SupplierRequestProductSnapshot = item.productSnapshot || {
        name: productInfo.name,
        unit: productInfo.unit,
        brand: productInfo.brand,
      };

      // Group each eligible offer under its corresponding supplier
      for (const off of eligibleOffers) {
        const currentList = supplierEligibleItems.get(off.supplierId) ?? [];
        currentList.push({
          purchaseRequestItemId: itemId,
          productId: pId,
          matchedSupplierOfferId: off.id,
          quantity: item.quantity,
          productSnapshot: snapshot,
          note: item.note || null,
        });
        supplierEligibleItems.set(off.supplierId, currentList);
      }
    }
  }

  // 6. Check existing SupplierRequests for idempotency and re-run semantics
  const existingRequests =
    await findExistingSupplierRequestsByPurchaseRequest(rfq._id.toString());
  const existingSupplierIdSet = new Set(
    existingRequests.map((r) => r.supplierId),
  );

  let skippedCount = 0;
  const requestsToCreate: CreateSupplierRequestRepoInput[] = [];

  for (const [supplierId, items] of supplierEligibleItems.entries()) {
    if (existingSupplierIdSet.has(supplierId)) {
      // Existing request is treated as immutable snapshot -> skip without duplicating
      skippedCount++;
    } else {
      requestsToCreate.push({
        purchaseRequestId: rfq._id.toString(),
        supplierId,
        cafeId: rfq.cafeId.toString(),
        items,
      });
    }
  }

  // 7. Bulk create new SupplierRequests idempotently
  const repoResult =
    await createSupplierRequestsIdempotently(requestsToCreate);

  const totalSkipped = skippedCount + repoResult.skippedCount;

  return {
    purchaseRequestId: rfq._id.toString(),
    catalogItemCount: catalogItems.length,
    customItemCount: customItems.length,
    matchedItemCount: matchedCatalogItemIds.size,
    unmatchedItemCount: unmatchedItems.length,
    eligibleSupplierCount: supplierEligibleItems.size,
    supplierRequestsCreated: repoResult.createdCount,
    supplierRequestsSkipped: totalSkipped,
    unmatchedItems,
  };
}

// ---------------------------------------------------------------------------
// 2. Cafe-side Inspection of Generated SupplierRequests for an RFQ
// ---------------------------------------------------------------------------

export async function getSupplierRequestsForCafeRFQ(
  purchaseRequestId: string,
): Promise<SupplierRequestCafeViewDTO[]> {
  const identity = await requireCafeMemberAccess();

  if (!canViewPurchaseRequests(identity)) {
    throw new SupplierMatchingPermissionError(
      "دسترسی لازم برای مشاهده درخواست‌های استعلام کافه را ندارید",
    );
  }

  if (!purchaseRequestId || !Types.ObjectId.isValid(purchaseRequestId)) {
    throw new SupplierMatchingValidationError("شناسه استعلام قیمت نامعتبر است");
  }

  return findSupplierRequestsForCafeRFQ(identity.cafeId, purchaseRequestId);
}

// ---------------------------------------------------------------------------
// 3. Supplier-side Single SupplierRequest Detail (Strictly isolated)
// ---------------------------------------------------------------------------

export async function getSupplierRequestForSupplier(
  requestId: string,
): Promise<SupplierRequestSupplierViewDTO> {
  const identity = await requireSupplierMemberAccess();

  const parsed = supplierRequestIdSchema.safeParse({ id: requestId });
  if (!parsed.success) {
    throw new SupplierMatchingValidationError("شناسه درخواست نامعتبر است");
  }

  const req = await findSupplierRequestByIdForSupplier(
    identity.supplierId,
    parsed.data.id,
  );

  if (!req) {
    throw new SupplierMatchingNotFoundError("درخواست استعلام قیمت یافت نشد");
  }

  return req;
}

// ---------------------------------------------------------------------------
// 4. Supplier-side Inbox / List (Strictly isolated)
// ---------------------------------------------------------------------------

export async function listSupplierRequestsForSupplier(
  rawQuery: unknown,
): Promise<{
  items: SupplierRequestSupplierViewDTO[];
  total: number;
}> {
  const identity = await requireSupplierMemberAccess();

  const parsed = supplierRequestQuerySchema.safeParse(rawQuery ?? {});
  if (!parsed.success) {
    throw new SupplierMatchingValidationError(
      "پارامترهای جستجوی درخواست‌ها نامعتبر است",
    );
  }

  return findSupplierRequestsForSupplierInbox(
    identity.supplierId,
    parsed.data,
  );
}

// ---------------------------------------------------------------------------
// 5. Cancellation Propagation Helper
// ---------------------------------------------------------------------------

export async function propagateCancellationToSupplierRequests(
  purchaseRequestId: string,
): Promise<number> {
  return cancelSupplierRequestsByPurchaseRequest(purchaseRequestId);
}
