import "server-only";

import { Types } from "mongoose";

import {
  canViewPurchaseRequests,
  type CafeMemberIdentity,
} from "@/src/domain/cafe-access";
import {
  declineSupplierRequestSchema,
  submitSupplierResponseSchema,
  updateSupplierResponseSchema,
  type DeclineSupplierRequestInput,
  type SubmitSupplierResponseInput,
  type UpdateSupplierResponseInput,
} from "@/src/domain/schemas/supplier-response";
import {
  canRespondToSupplierRequests,
  canViewSupplierRequests,
  type SupplierMemberIdentity,
} from "@/src/domain/supplier-access";
import type {
  SupplierRequestDeclineResultDTO,
  SupplierResponseCafeViewDTO,
  SupplierResponseSupplierViewDTO,
} from "@/src/domain/supplier-response";
import dbConnect from "@/lib/mongodb";
import {
  calculateSupplierResponseTotals,
  SupplierResponseCalculationError,
} from "@/src/domain/supplier-response-totals";
import {
  getCurrentCafeIdentity,
  getCurrentSupplierIdentity,
} from "@/src/lib/auth-helpers";
import {
  createSupplierResponse,
  findSupplierResponseForSupplier,
  findSupplierResponsesForCafeRFQ,
  updateSupplierResponse,
} from "@/src/repositories/supplier-response-repository";
import {
  declineSupplierRequestById,
} from "@/src/repositories/supplier-request-repository";
import { PurchaseRequest } from "@/model/purchase-request";
import { SupplierRequest } from "@/model/supplier-request";

// ---------------------------------------------------------------------------
// Domain Errors
// ---------------------------------------------------------------------------

export class SupplierResponseAuthError extends Error {
  constructor(message = "دسترسی نامعتبر است؛ لطفاً وارد شوید") {
    super(message);
    this.name = "SupplierResponseAuthError";
  }
}

export class SupplierResponsePermissionError extends Error {
  constructor(message = "شما دسترسی لازم برای ثبت یا ویرایش پاسخ را ندارید") {
    super(message);
    this.name = "SupplierResponsePermissionError";
  }
}

export class SupplierResponseNotFoundError extends Error {
  constructor(message = "درخواست استعلام قیمت یافت نشد") {
    super(message);
    this.name = "SupplierResponseNotFoundError";
  }
}

export class SupplierResponseInvalidStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupplierResponseInvalidStatusError";
  }
}

export class SupplierResponseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupplierResponseValidationError";
  }
}

// ---------------------------------------------------------------------------
// Authorization Helpers
// ---------------------------------------------------------------------------

export async function requireSupplierResponseAuth(): Promise<SupplierMemberIdentity> {
  const identity = await getCurrentSupplierIdentity();
  if (!identity) {
    throw new SupplierResponseAuthError(
      "دسترسی به پنل تأمین‌کننده ممکن نیست؛ لطفاً وارد شوید",
    );
  }
  return identity;
}

export async function requireCafeResponseAuth(): Promise<CafeMemberIdentity> {
  const identity = await getCurrentCafeIdentity();
  if (!identity) {
    throw new SupplierResponseAuthError(
      "دسترسی به اطلاعات کافه ممکن نیست؛ لطفاً وارد شوید",
    );
  }
  return identity;
}

// ---------------------------------------------------------------------------
// 1. Submit Supplier Response (Quote / Availability)
// ---------------------------------------------------------------------------

export async function submitSupplierResponse(
  rawInput: unknown,
  providedIdentity?: SupplierMemberIdentity,
): Promise<SupplierResponseSupplierViewDTO> {
  const identity = providedIdentity || (await requireSupplierResponseAuth());

  if (!canRespondToSupplierRequests(identity)) {
    throw new SupplierResponsePermissionError(
      "شما دسترسی لازم برای ثبت پاسخ به استعلام قیمت را ندارید",
    );
  }

  const parsed = submitSupplierResponseSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    throw new SupplierResponseValidationError(
      firstIssue || "اطلاعات ورودی پاسخ استعلام نامعتبر است",
    );
  }

  const input: SubmitSupplierResponseInput = parsed.data;

  await dbConnect();

  // 1. Fetch SupplierRequest with tenant & ownership scoping
  type ReqItemLean = {
    _id: Types.ObjectId;
    purchaseRequestItemId: Types.ObjectId;
    productId: Types.ObjectId;
    quantity: number;
    productSnapshot?: {
      name: string;
      unit: string;
    };
  };

  type ReqLean = {
    _id: Types.ObjectId;
    purchaseRequestId: Types.ObjectId;
    supplierId: Types.ObjectId;
    cafeId: Types.ObjectId;
    status: string;
    items: ReqItemLean[];
  };

  const req = (await SupplierRequest.findOne({
    _id: new Types.ObjectId(input.supplierRequestId),
    supplierId: new Types.ObjectId(identity.supplierId), // Supplier ownership strictly enforced
  }).lean()) as unknown as ReqLean | null;

  if (!req) {
    throw new SupplierResponseNotFoundError("درخواست استعلام قیمت یافت نشد");
  }

  // 2. Lifecycle checks on SupplierRequest status
  if (req.status === "cancelled") {
    throw new SupplierResponseInvalidStatusError(
      "امکان ثبت پاسخ برای درخواست لغوشده وجود ندارد",
    );
  }

  if (req.status === "declined") {
    throw new SupplierResponseInvalidStatusError(
      "امکان ثبت پاسخ برای درخواستی که قبلاً رد شده است وجود ندارد",
    );
  }

  if (req.status === "responded") {
    // Idempotency: response already exists. Check if response document exists
    const existing = await findSupplierResponseForSupplier(
      identity.supplierId,
      input.supplierRequestId,
    );
    if (existing) {
      return existing;
    }
  }

  if (req.status !== "pending") {
    throw new SupplierResponseInvalidStatusError(
      `وضعیت درخواست "${req.status}" برای ثبت پاسخ مجاز نیست`,
    );
  }

  // 3. Parent PurchaseRequest checks
  type RFQLean = {
    _id: Types.ObjectId;
    status: string;
  };

  const parentRfq = (await PurchaseRequest.findById(req.purchaseRequestId)
    .select("status")
    .lean()) as unknown as RFQLean | null;

  if (!parentRfq) {
    throw new SupplierResponseNotFoundError("استعلام قیمت والد یافت نشد");
  }

  if (parentRfq.status === "cancelled") {
    throw new SupplierResponseInvalidStatusError(
      "امکان ثبت پاسخ وجود ندارد؛ استعلام قیمت والد توسط کافه لغو شده است",
    );
  }

  if (parentRfq.status !== "submitted") {
    throw new SupplierResponseInvalidStatusError(
      "امکان ثبت پاسخ وجود ندارد؛ استعلام قیمت والد در وضعیت مجاز برای پاسخ نیست",
    );
  }

  // 4. Completeness check: all items in request must have a single decision
  const reqItemMap = new Map<string, ReqItemLean>();
  for (const it of req.items) {
    reqItemMap.set(it.purchaseRequestItemId.toString(), it);
  }

  const seenDecisionItemIds = new Set<string>();
  for (const itemDecision of input.items) {
    if (seenDecisionItemIds.has(itemDecision.purchaseRequestItemId)) {
      throw new SupplierResponseValidationError(
        "برای یک قلم نمی‌توان بیش از یک تصمیم ثبت کرد",
      );
    }
    seenDecisionItemIds.add(itemDecision.purchaseRequestItemId);

    if (!reqItemMap.has(itemDecision.purchaseRequestItemId)) {
      throw new SupplierResponseValidationError(
        "قلم ارسالی در درخواست استعلام قیمت وجود ندارد",
      );
    }
  }

  if (seenDecisionItemIds.size !== req.items.length) {
    throw new SupplierResponseValidationError(
      "پاسخ ناقص است؛ برای تمام اقلام درخواست باید تصمیم (قیمت‌گذاری یا عدم موجودی) مشخص شود",
    );
  }

  // 5. Invariant check on each item decision
  let hasQuotedItem = false;
  for (const itemDecision of input.items) {
    const originalItem = reqItemMap.get(itemDecision.purchaseRequestItemId)!;

    if (itemDecision.status === "quoted") {
      hasQuotedItem = true;

      if (itemDecision.confirmedQuantity > originalItem.quantity) {
        throw new SupplierResponseValidationError(
          `تعداد تأییدشده نمی‌تواند بیشتر از تعداد درخواستی (${originalItem.quantity}) باشد`,
        );
      }
    } else if (itemDecision.status === "unavailable") {
      if (
        itemDecision.unitPrice !== undefined &&
        itemDecision.unitPrice !== null
      ) {
        throw new SupplierResponseValidationError(
          "برای قلم ناموجود نباید قیمت واحد ثبت شود",
        );
      }
    }
  }

  if (!hasQuotedItem) {
    throw new SupplierResponseValidationError(
      "حداقل یک قلم باید قیمت‌گذاری شود؛ در صورت عدم امکان تأمین کلیه اقلام، کل درخواست را رد کنید",
    );
  }

  // 6. Authoritative total calculation helper
  let totals;
  try {
    totals = calculateSupplierResponseTotals(input.items, input.shippingCost);
  } catch (err: unknown) {
    if (err instanceof SupplierResponseCalculationError) {
      throw new SupplierResponseValidationError(err.message);
    }
    throw err;
  }

  // 7. Persist SupplierResponse idempotently & atomically
  const repoItems = totals.items.map((calcItem) => {
    const original = reqItemMap.get(calcItem.purchaseRequestItemId)!;
    const rawDecision = input.items.find(
      (d) => d.purchaseRequestItemId === calcItem.purchaseRequestItemId,
    );

    return {
      purchaseRequestItemId: calcItem.purchaseRequestItemId,
      productId: original.productId.toString(),
      status: calcItem.status,
      unitPrice: calcItem.unitPrice,
      confirmedQuantity: calcItem.confirmedQuantity,
      itemSubtotal: calcItem.itemSubtotal,
      note: rawDecision?.note,
    };
  });

  await createSupplierResponse({
    supplierRequestId: req._id.toString(),
    purchaseRequestId: req.purchaseRequestId.toString(),
    supplierId: req.supplierId.toString(),
    cafeId: req.cafeId.toString(),
    respondedByUserId: identity.userId,
    deliveryDays: input.deliveryDays,
    shippingCost: totals.shippingCost,
    itemSubtotal: totals.itemSubtotal,
    estimatedTotal: totals.estimatedTotal,
    items: repoItems,
    note: input.note,
  });

  const responseDTO = await findSupplierResponseForSupplier(
    identity.supplierId,
    req._id.toString(),
  );

  if (!responseDTO) {
    throw new SupplierResponseNotFoundError("پاسخ ثبت‌شده یافت نشد");
  }

  return responseDTO;
}

// ---------------------------------------------------------------------------
// 2. Update Existing Supplier Response (Edit Quote)
// ---------------------------------------------------------------------------

export async function updateSupplierResponseService(
  rawInput: unknown,
  providedIdentity?: SupplierMemberIdentity,
): Promise<SupplierResponseSupplierViewDTO> {
  const identity = providedIdentity || (await requireSupplierResponseAuth());

  if (!canRespondToSupplierRequests(identity)) {
    throw new SupplierResponsePermissionError(
      "شما دسترسی لازم برای ویرایش پاسخ را ندارید",
    );
  }

  const parsed = updateSupplierResponseSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    throw new SupplierResponseValidationError(
      firstIssue || "اطلاعات ورودی ویرایش پاسخ نامعتبر است",
    );
  }

  const input: UpdateSupplierResponseInput = parsed.data;

  await dbConnect();

  // 1. Fetch SupplierRequest with tenant & ownership scoping
  type ReqItemLean = {
    _id: Types.ObjectId;
    purchaseRequestItemId: Types.ObjectId;
    productId: Types.ObjectId;
    quantity: number;
    productSnapshot?: {
      name: string;
      unit: string;
    };
  };

  type ReqLean = {
    _id: Types.ObjectId;
    purchaseRequestId: Types.ObjectId;
    supplierId: Types.ObjectId;
    cafeId: Types.ObjectId;
    status: string;
    items: ReqItemLean[];
  };

  const req = (await SupplierRequest.findOne({
    _id: new Types.ObjectId(input.supplierRequestId),
    supplierId: new Types.ObjectId(identity.supplierId),
  }).lean()) as unknown as ReqLean | null;

  if (!req) {
    throw new SupplierResponseNotFoundError("درخواست استعلام قیمت یافت نشد");
  }

  // 2. Status checks: ONLY responded can be edited
  if (req.status === "cancelled") {
    throw new SupplierResponseInvalidStatusError(
      "امکان ویرایش پاسخ برای درخواست لغوشده وجود ندارد",
    );
  }

  if (req.status === "declined") {
    throw new SupplierResponseInvalidStatusError(
      "امکان ویرایش پاسخ برای درخواست ردشده وجود ندارد",
    );
  }

  if (req.status !== "responded") {
    throw new SupplierResponseInvalidStatusError(
      "تنها درخواست‌های پاسخ‌داده‌شده قابل ویرایش هستند",
    );
  }

  // 3. Parent PurchaseRequest checks
  type RFQLean = {
    _id: Types.ObjectId;
    status: string;
  };

  const parentRfq = (await PurchaseRequest.findById(req.purchaseRequestId)
    .select("status")
    .lean()) as unknown as RFQLean | null;

  if (!parentRfq) {
    throw new SupplierResponseNotFoundError("استعلام قیمت والد یافت نشد");
  }

  if (parentRfq.status === "cancelled") {
    throw new SupplierResponseInvalidStatusError(
      "امکان ویرایش پاسخ وجود ندارد؛ استعلام قیمت والد توسط کافه لغو شده است",
    );
  }

  if (parentRfq.status !== "submitted") {
    throw new SupplierResponseInvalidStatusError(
      "امکان ویرایش پاسخ وجود ندارد؛ استعلام قیمت والد در وضعیت مجاز نیست",
    );
  }

  // 4. Completeness check
  const reqItemMap = new Map<string, ReqItemLean>();
  for (const it of req.items) {
    reqItemMap.set(it.purchaseRequestItemId.toString(), it);
  }

  const seenDecisionItemIds = new Set<string>();
  for (const itemDecision of input.items) {
    if (seenDecisionItemIds.has(itemDecision.purchaseRequestItemId)) {
      throw new SupplierResponseValidationError(
        "برای یک قلم نمی‌توان بیش از یک تصمیم ثبت کرد",
      );
    }
    seenDecisionItemIds.add(itemDecision.purchaseRequestItemId);

    if (!reqItemMap.has(itemDecision.purchaseRequestItemId)) {
      throw new SupplierResponseValidationError(
        "قلم ارسالی در درخواست استعلام قیمت وجود ندارد",
      );
    }
  }

  if (seenDecisionItemIds.size !== req.items.length) {
    throw new SupplierResponseValidationError(
      "پاسخ ناقص است؛ برای تمام اقلام درخواست باید تصمیم مشخص شود",
    );
  }

  // 5. Invariant check on each item decision
  let hasQuotedItem = false;
  for (const itemDecision of input.items) {
    const originalItem = reqItemMap.get(itemDecision.purchaseRequestItemId)!;

    if (itemDecision.status === "quoted") {
      hasQuotedItem = true;

      if (itemDecision.confirmedQuantity > originalItem.quantity) {
        throw new SupplierResponseValidationError(
          `تعداد تأییدشده نمی‌تواند بیشتر از تعداد درخواستی (${originalItem.quantity}) باشد`,
        );
      }
    } else if (itemDecision.status === "unavailable") {
      if (
        itemDecision.unitPrice !== undefined &&
        itemDecision.unitPrice !== null
      ) {
        throw new SupplierResponseValidationError(
          "برای قلم ناموجود نباید قیمت واحد ثبت شود",
        );
      }
    }
  }

  if (!hasQuotedItem) {
    throw new SupplierResponseValidationError(
      "حداقل یک قلم باید قیمت‌گذاری شود",
    );
  }

  // 6. Authoritative total calculation helper
  let totals;
  try {
    totals = calculateSupplierResponseTotals(input.items, input.shippingCost);
  } catch (err: unknown) {
    if (err instanceof SupplierResponseCalculationError) {
      throw new SupplierResponseValidationError(err.message);
    }
    throw err;
  }

  // 7. Persist update
  const repoItems = totals.items.map((calcItem) => {
    const original = reqItemMap.get(calcItem.purchaseRequestItemId)!;
    const rawDecision = input.items.find(
      (d) => d.purchaseRequestItemId === calcItem.purchaseRequestItemId,
    );

    return {
      purchaseRequestItemId: calcItem.purchaseRequestItemId,
      productId: original.productId.toString(),
      status: calcItem.status,
      unitPrice: calcItem.unitPrice,
      confirmedQuantity: calcItem.confirmedQuantity,
      itemSubtotal: calcItem.itemSubtotal,
      note: rawDecision?.note,
    };
  });

  const updateResult = await updateSupplierResponse(
    req._id.toString(),
    identity.supplierId,
    {
      deliveryDays: input.deliveryDays,
      shippingCost: totals.shippingCost,
      itemSubtotal: totals.itemSubtotal,
      estimatedTotal: totals.estimatedTotal,
      items: repoItems,
      note: input.note,
    },
  );

  if (!updateResult.success) {
    throw new SupplierResponseNotFoundError("پاسخ قبلی برای ویرایش یافت نشد");
  }

  const updatedDTO = await findSupplierResponseForSupplier(
    identity.supplierId,
    req._id.toString(),
  );

  if (!updatedDTO) {
    throw new SupplierResponseNotFoundError("پاسخ به‌روزرسانی‌شده یافت نشد");
  }

  return updatedDTO;
}

// ---------------------------------------------------------------------------
// 3. Decline Entire SupplierRequest
// ---------------------------------------------------------------------------

export async function declineSupplierRequest(
  rawInput: unknown,
  providedIdentity?: SupplierMemberIdentity,
): Promise<SupplierRequestDeclineResultDTO> {
  const identity = providedIdentity || (await requireSupplierResponseAuth());

  if (!canRespondToSupplierRequests(identity)) {
    throw new SupplierResponsePermissionError(
      "شما دسترسی لازم برای رد درخواست استعلام قیمت را ندارید",
    );
  }

  const parsed = declineSupplierRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    throw new SupplierResponseValidationError(
      firstIssue || "شناسه درخواست نامعتبر است",
    );
  }

  const input: DeclineSupplierRequestInput = parsed.data;

  await dbConnect();

  // 1. Fetch SupplierRequest with tenant & ownership scoping
  type ReqLean = {
    _id: Types.ObjectId;
    purchaseRequestId: Types.ObjectId;
    supplierId: Types.ObjectId;
    status: string;
  };

  const req = (await SupplierRequest.findOne({
    _id: new Types.ObjectId(input.supplierRequestId),
    supplierId: new Types.ObjectId(identity.supplierId),
  }).lean()) as unknown as ReqLean | null;

  if (!req) {
    throw new SupplierResponseNotFoundError("درخواست استعلام قیمت یافت نشد");
  }

  // 2. Status checks
  if (req.status === "cancelled") {
    throw new SupplierResponseInvalidStatusError(
      "امکان رد درخواست لغوشده وجود ندارد",
    );
  }

  if (req.status === "declined") {
    throw new SupplierResponseInvalidStatusError(
      "این درخواست قبلاً رد شده است",
    );
  }

  if (req.status === "responded") {
    throw new SupplierResponseInvalidStatusError(
      "این درخواست قبلاً پاسخ داده شده است و امکان رد آن وجود ندارد",
    );
  }

  if (req.status !== "pending") {
    throw new SupplierResponseInvalidStatusError(
      `وضعیت درخواست "${req.status}" برای رد مجاز نیست`,
    );
  }

  // 3. Parent RFQ check
  type RFQLean = {
    _id: Types.ObjectId;
    status: string;
  };

  const parentRfq = (await PurchaseRequest.findById(req.purchaseRequestId)
    .select("status")
    .lean()) as unknown as RFQLean | null;

  if (parentRfq?.status === "cancelled") {
    throw new SupplierResponseInvalidStatusError(
      "استعلام قیمت والد توسط کافه لغو شده است",
    );
  }

  // 4. Atomically decline
  const result = await declineSupplierRequestById(
    identity.supplierId,
    req._id.toString(),
    identity.userId,
    input.reason,
  );

  if (!result.success) {
    throw new SupplierResponseInvalidStatusError(
      "عملیات رد درخواست با شکست مواجه شد",
    );
  }

  return {
    supplierRequestId: req._id.toString(),
    status: "declined",
    declinedAt: new Date().toISOString(),
    reason: input.reason || undefined,
  };
}

// ---------------------------------------------------------------------------
// 4. Get Single Supplier Response For Supplier (Own response detail)
// ---------------------------------------------------------------------------

export async function getSupplierResponseForSupplier(
  supplierRequestId: string,
  providedIdentity?: SupplierMemberIdentity,
): Promise<SupplierResponseSupplierViewDTO> {
  const identity = providedIdentity || (await requireSupplierResponseAuth());

  if (!canViewSupplierRequests(identity)) {
    throw new SupplierResponsePermissionError(
      "شما دسترسی لازم برای مشاهده پاسخ‌ها را ندارید",
    );
  }

  if (!supplierRequestId || !Types.ObjectId.isValid(supplierRequestId)) {
    throw new SupplierResponseValidationError("شناسه درخواست نامعتبر است");
  }

  const responseDTO = await findSupplierResponseForSupplier(
    identity.supplierId,
    supplierRequestId,
  );

  if (!responseDTO) {
    throw new SupplierResponseNotFoundError("پاسخ مورد نظر یافت نشد");
  }

  return responseDTO;
}

// ---------------------------------------------------------------------------
// 5. Get All Supplier Responses for Cafe RFQ (Cafe-scoped inspection)
// ---------------------------------------------------------------------------

export async function getSupplierResponsesForCafeRFQ(
  purchaseRequestId: string,
  providedIdentity?: CafeMemberIdentity,
): Promise<SupplierResponseCafeViewDTO[]> {
  const identity = providedIdentity || (await requireCafeResponseAuth());

  if (!canViewPurchaseRequests(identity)) {
    throw new SupplierResponsePermissionError(
      "دسترسی لازم برای مشاهده پاسخ‌های استعلام قیمت کافه را ندارید",
    );
  }

  if (!purchaseRequestId || !Types.ObjectId.isValid(purchaseRequestId)) {
    throw new SupplierResponseValidationError("شناسه استعلام قیمت نامعتبر است");
  }

  return findSupplierResponsesForCafeRFQ(identity.cafeId, purchaseRequestId);
}
