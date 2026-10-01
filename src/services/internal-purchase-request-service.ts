import "server-only";

import { Types } from "mongoose";

import { Product } from "@/model/product";
import {
  canCreateInternalRequest,
  canReviewInternalRequest,
} from "@/src/domain/cafe-access";
import {
  deriveItemReviewStatus,
  deriveParentRequestStatus,
} from "@/src/domain/internal-purchase-request";
import {
  cancelInternalPurchaseRequestSchema,
  createInternalPurchaseRequestSchema,
  internalPurchaseRequestQuerySchema,
  internalRequestEntityIdSchema,
  reviewInternalPurchaseRequestSchema,
  type CreateInternalPurchaseRequestInput,
  type InternalPurchaseRequestQueryInput,
  type ReviewInternalPurchaseRequestInput,
} from "@/src/domain/schemas/internal-purchase-request";
import { createPaginationMeta, type AdminPaginationMeta } from "@/src/lib/admin-query";
import { getCurrentCafeIdentity } from "@/src/lib/auth-helpers";
import {
  atomicCancelInternalPurchaseRequest,
  atomicReviewInternalPurchaseRequest,
  createInternalPurchaseRequest as repoCreateRequest,
  findInternalPurchaseRequestById,
  findInternalPurchaseRequestsByCafe,
  type InternalPurchaseRequestDetailDTO,
  type InternalPurchaseRequestListItemDTO,
} from "@/src/repositories/internal-purchase-request-repository";

// ---------------------------------------------------------------------------
// Custom Domain Errors
// ---------------------------------------------------------------------------

export class InternalRequestAuthError extends Error {
  constructor(message = "دسترسی به اطلاعات کافه ممکن نیست؛ لطفاً وارد شوید") {
    super(message);
    this.name = "InternalRequestAuthError";
  }
}

export class InternalRequestPermissionError extends Error {
  constructor(message = "دسترسی لازم برای این عملیات را ندارید") {
    super(message);
    this.name = "InternalRequestPermissionError";
  }
}

export class InternalRequestNotFoundError extends Error {
  constructor(message = "درخواست خرید داخلی مورد نظر یافت نشد") {
    super(message);
    this.name = "InternalRequestNotFoundError";
  }
}

export class InternalRequestValidationError extends Error {
  constructor(message = "اطلاعات ورودی درخواست معتبر نیست") {
    super(message);
    this.name = "InternalRequestValidationError";
  }
}

export class InvalidCatalogProductError extends Error {
  constructor(message = "کالای انتخابی در کاتالوگ موجود یا فعال نیست") {
    super(message);
    this.name = "InvalidCatalogProductError";
  }
}

export class InvalidRequestStateTransitionError extends Error {
  constructor(
    message = "امکان تغییر وضعیت درخواست وجود ندارد؛ درخواست قبلاً بررسی یا لغو شده است",
  ) {
    super(message);
    this.name = "InvalidRequestStateTransitionError";
  }
}

// ---------------------------------------------------------------------------
// Authorization Guard: identity resolved server-side from active session
// ---------------------------------------------------------------------------

export async function requireCafeMemberAccess() {
  const identity = await getCurrentCafeIdentity();
  if (!identity) {
    throw new InternalRequestAuthError();
  }
  return identity;
}

// ---------------------------------------------------------------------------
// 1. Create Internal Purchase Request
// ---------------------------------------------------------------------------

export async function createInternalPurchaseRequest(
  rawInput: unknown,
): Promise<string> {
  const identity = await requireCafeMemberAccess();

  // Permission check
  if (!canCreateInternalRequest(identity)) {
    throw new InternalRequestPermissionError(
      "شما دسترسی لازم برای ثبت درخواست خرید داخلی (canCreatePurchaseRequest) را ندارید",
    );
  }

  const parsed = createInternalPurchaseRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    throw new InternalRequestValidationError(firstIssue || "داده‌های ورودی نامعتبر است");
  }

  const input: CreateInternalPurchaseRequestInput = parsed.data;

  // Validate items catalog products
  const catalogProductIds: string[] = [];
  for (const item of input.items) {
    if (item.itemType === "catalog") {
      catalogProductIds.push(item.productId);
    }
  }

  if (catalogProductIds.length > 0) {
    const objectIds = catalogProductIds.map((id) => new Types.ObjectId(id));
    const activeProducts = await Product.find({
      _id: { $in: objectIds },
      status: "active",
      deletedAt: null,
    })
      .select("_id")
      .lean();

    const activeSet = new Set(activeProducts.map((p) => p._id.toString()));
    for (const pid of catalogProductIds) {
      if (!activeSet.has(pid)) {
        throw new InvalidCatalogProductError(
          `محصول با شناسه ${pid} در کاتالوگ فعال نیست یا حذف شده است`,
        );
      }
    }
  }

  // Repository call
  return repoCreateRequest({
    cafeId: identity.cafeId,
    requestedByUserId: identity.userId,
    title: input.title,
    description: input.description,
    items: input.items.map((item) => ({
      itemType: item.itemType,
      productId: item.itemType === "catalog" ? item.productId : undefined,
      customTitle: item.itemType === "custom" ? item.customTitle : undefined,
      customUnit: item.itemType === "custom" ? item.customUnit : undefined,
      requestedQuantity: item.requestedQuantity,
      note: item.note,
    })),
  });
}

// ---------------------------------------------------------------------------
// 2. List Internal Purchase Requests for Current Cafe
// ---------------------------------------------------------------------------

export type InternalPurchaseRequestListResultDTO = {
  items: InternalPurchaseRequestListItemDTO[];
  pagination: AdminPaginationMeta;
};

export async function getInternalPurchaseRequestsList(
  rawQuery: unknown,
): Promise<InternalPurchaseRequestListResultDTO> {
  const identity = await requireCafeMemberAccess();

  const parsed = internalPurchaseRequestQuerySchema.safeParse(rawQuery ?? {});
  if (!parsed.success) {
    throw new InternalRequestValidationError("پارامترهای فیلتر یا صفحه‌بندی نامعتبر است");
  }

  const query: InternalPurchaseRequestQueryInput = parsed.data;

  const result = await findInternalPurchaseRequestsByCafe(identity.cafeId, {
    page: query.page,
    pageSize: query.pageSize,
    status: query.status,
  });

  const pagination = createPaginationMeta(query.page, query.pageSize, result.total);

  return {
    items: result.items,
    pagination,
  };
}

// ---------------------------------------------------------------------------
// 3. Get Internal Purchase Request Detail
// ---------------------------------------------------------------------------

export async function getInternalPurchaseRequestDetail(
  requestId: string,
): Promise<InternalPurchaseRequestDetailDTO> {
  const identity = await requireCafeMemberAccess();

  const parsedId = internalRequestEntityIdSchema.safeParse(requestId);
  if (!parsedId.success) {
    throw new InternalRequestValidationError("شناسه درخواست نامعتبر است");
  }

  const request = await findInternalPurchaseRequestById(
    identity.cafeId,
    parsedId.data,
  );

  if (!request) {
    throw new InternalRequestNotFoundError();
  }

  return request;
}

// ---------------------------------------------------------------------------
// 4. Review Internal Purchase Request
// ---------------------------------------------------------------------------

export async function reviewInternalPurchaseRequest(
  rawInput: unknown,
): Promise<{ ok: boolean; status: string }> {
  const identity = await requireCafeMemberAccess();

  // Review permission check: management roles only
  if (!canReviewInternalRequest(identity)) {
    throw new InternalRequestPermissionError(
      "شما دسترسی لازم برای بررسی و تأیید درخواست (canApprovePurchaseRequest) را ندارید",
    );
  }

  const parsed = reviewInternalPurchaseRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    throw new InternalRequestValidationError(firstIssue || "داده‌های بررسی نامعتبر است");
  }

  const input: ReviewInternalPurchaseRequestInput = parsed.data;

  // Retrieve current request (strictly scoped to cafeId)
  const existing = await findInternalPurchaseRequestById(
    identity.cafeId,
    input.requestId,
  );

  if (!existing) {
    throw new InternalRequestNotFoundError();
  }

  if (existing.status !== "pending") {
    throw new InvalidRequestStateTransitionError(
      "این درخواست در وضعیت انتظار نیست و قبلاً بررسی یا لغو شده است",
    );
  }

  // Validate item reviews
  const existingItemMap = new Map(existing.items.map((i) => [i.id, i]));

  if (input.items.length !== existing.items.length) {
    throw new InternalRequestValidationError(
      "تمامی اقلام موجود در درخواست باید تعیین وضعیت شوند",
    );
  }

  const evaluatedItems: Array<{
    id: string;
    approvedQuantity: number;
    status: "approved" | "partially_approved" | "rejected";
    note?: string;
  }> = [];

  for (const reviewItem of input.items) {
    const orig = existingItemMap.get(reviewItem.itemId);
    if (!orig) {
      throw new InternalRequestValidationError(
        `قلم با شناسه ${reviewItem.itemId} در این درخواست وجود ندارد`,
      );
    }

    if (reviewItem.approvedQuantity > orig.requestedQuantity) {
      throw new InternalRequestValidationError(
        `تعداد تأییدشده برای قلم ${orig.productName || orig.customTitle || reviewItem.itemId} نمی‌تواند بیش از تعداد درخواستی (${orig.requestedQuantity}) باشد`,
      );
    }

    const itemStatus = deriveItemReviewStatus(
      orig.requestedQuantity,
      reviewItem.approvedQuantity,
    );

    evaluatedItems.push({
      id: reviewItem.itemId,
      approvedQuantity: reviewItem.approvedQuantity,
      status: itemStatus,
      note: reviewItem.note,
    });
  }

  // Compute derived parent status
  const derivedParentStatus = deriveParentRequestStatus(
    evaluatedItems.map((e) => {
      const orig = existingItemMap.get(e.id)!;
      return {
        requestedQuantity: orig.requestedQuantity,
        approvedQuantity: e.approvedQuantity,
      };
    }),
  );

  // Perform atomic update with status precondition
  const success = await atomicReviewInternalPurchaseRequest({
    cafeId: identity.cafeId,
    requestId: input.requestId,
    reviewerUserId: identity.userId,
    derivedStatus: derivedParentStatus,
    reviewNotes: input.reviewNotes,
    reviewedItems: evaluatedItems,
  });

  if (!success) {
    throw new InvalidRequestStateTransitionError(
      "بروزرسانی انجام نشد؛ ممکن است وضعیت درخواست همزمان توسط مدیر دیگری تغییر کرده باشد",
    );
  }

  return { ok: true, status: derivedParentStatus };
}

// ---------------------------------------------------------------------------
// 5. Cancel Internal Purchase Request
// ---------------------------------------------------------------------------

export async function cancelInternalPurchaseRequest(
  rawInput: unknown,
): Promise<{ ok: boolean }> {
  const identity = await requireCafeMemberAccess();

  const parsed = cancelInternalPurchaseRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    throw new InternalRequestValidationError(firstIssue || "داده‌های لغو نامعتبر است");
  }

  const input = parsed.data;

  // Retrieve current request (strictly scoped to cafeId)
  const existing = await findInternalPurchaseRequestById(
    identity.cafeId,
    input.requestId,
  );

  if (!existing) {
    throw new InternalRequestNotFoundError();
  }

  if (existing.status !== "pending") {
    throw new InvalidRequestStateTransitionError(
      "فقط درخواست‌های در وضعیت انتظار قابل لغو هستند",
    );
  }

  // Cancellation authorization:
  // User must be the original requester OR have manager review privileges
  const isRequester = existing.requestedByUserId === identity.userId;
  const isManager = canReviewInternalRequest(identity);

  if (!isRequester && !isManager) {
    throw new InternalRequestPermissionError(
      "شما تنها مجاز به لغو درخواست‌های ثبت‌شده توسط خودتان هستید",
    );
  }

  const success = await atomicCancelInternalPurchaseRequest({
    cafeId: identity.cafeId,
    requestId: input.requestId,
    cancelledByUserId: identity.userId,
    cancelReason: input.cancelReason,
  });

  if (!success) {
    throw new InvalidRequestStateTransitionError(
      "لغو درخواست انجام نشد؛ ممکن است وضعیت درخواست همزمان تغییر کرده باشد",
    );
  }

  return { ok: true };
}
