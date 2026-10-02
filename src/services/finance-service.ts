import "server-only";

import { Types } from "mongoose";

import { Order } from "@/model/order";
import {
  canInitiateCafePayment,
  canViewCafePayments,
  type CafeMemberIdentity,
} from "@/src/domain/cafe-access";
import {
  deriveOrderPaymentStatus,
  isOrderPayable,
  type AdminFinanceOverviewDTO,
  type AdminPaymentListResult,
  type AdminSettlementCandidateDTO,
  type AdminSettlementListResult,
  type CafeOrderPaymentDTO,
  type CafePaymentAttemptDTO,
  type CreateSettlementResultDTO,
  type SupplierFinanceOverviewDTO,
  type SupplierPayableListResult,
  type SupplierSettlementListResult,
} from "@/src/domain/finance";
import {
  adminPaymentQuerySchema,
  adminSettlementQuerySchema,
  createPaymentAttemptSchema,
  createSettlementSchema,
  financeEntityIdSchema,
  markPaymentFailedInternalSchema,
  markPaymentPaidInternalSchema,
  supplierPayableQuerySchema,
  supplierSettlementQuerySchema,
} from "@/src/domain/schemas/finance";
import {
  canViewSupplierFinancials,
  type SupplierMemberIdentity,
} from "@/src/domain/supplier-access";
import { requireAdmin, type AdminIdentity } from "@/src/lib/admin-helpers";
import {
  getCurrentCafeIdentity,
  getCurrentSupplierIdentity,
} from "@/src/lib/auth-helpers";
import {
  getAdminFinanceOverview as getAdminFinanceOverviewInRepo,
  listPaymentsForAdmin as listPaymentsForAdminInRepo,
} from "@/src/repositories/admin-finance-repository";
import { findOrderByIdForCafe } from "@/src/repositories/order-repository";
import {
  createPaymentAttemptInRepo,
  findPaidPaymentForOrder,
  findPaymentById,
  findPaymentsForOrder,
  markPaymentFailedInRepo,
  markPaymentPaidInRepo,
} from "@/src/repositories/payment-repository";
import {
  createOrUpdatePayableOnPaymentInRepo,
  findEligiblePayablesForSupplier,
  getSupplierFinanceOverview as getSupplierFinanceOverviewInRepo,
  listPayablesForSupplier,
  syncPayableOnDeliveredInRepo,
} from "@/src/repositories/supplier-payable-repository";
import {
  createSettlementWithPayablesInRepo,
  listSettlementsForAdmin as listSettlementsForAdminInRepo,
  listSettlementsForSupplier as listSettlementsForSupplierInRepo,
  SettlementConcurrencyError,
  SettlementValidationError,
} from "@/src/repositories/supplier-settlement-repository";
import { createTransactionInRepo } from "@/src/repositories/transaction-repository";

// ---------------------------------------------------------------------------
// Domain Errors
// ---------------------------------------------------------------------------

export class FinanceAuthError extends Error {
  constructor(message = "دسترسی نامعتبر است؛ لطفاً وارد حساب کاربری خود شوید") {
    super(message);
    this.name = "FinanceAuthError";
  }
}

export class FinancePermissionError extends Error {
  constructor(
    message = "شما دسترسی لازم برای انجام این عملیات مالی را ندارید",
  ) {
    super(message);
    this.name = "FinancePermissionError";
  }
}

export class FinanceNotFoundError extends Error {
  constructor(message = "موجودیت مالی مورد نظر یافت نشد") {
    super(message);
    this.name = "FinanceNotFoundError";
  }
}

export class FinanceInvalidStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinanceInvalidStatusError";
  }
}

export class FinanceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinanceValidationError";
  }
}

export class FinanceConcurrencyError extends Error {
  constructor(
    message = "خطای همزمانی در تراکنش مالی رخ داد؛ لطفاً دوباره تلاش کنید",
  ) {
    super(message);
    this.name = "FinanceConcurrencyError";
  }
}

// ---------------------------------------------------------------------------
// Identity Helpers
// ---------------------------------------------------------------------------

export async function requireCafeFinanceAuth(): Promise<CafeMemberIdentity> {
  const identity = await getCurrentCafeIdentity();
  if (!identity) {
    throw new FinanceAuthError(
      "دسترسی به بخش مالی کافه ممکن نیست؛ لطفاً وارد شوید",
    );
  }
  return identity;
}

export async function requireSupplierFinanceAuth(): Promise<SupplierMemberIdentity> {
  const identity = await getCurrentSupplierIdentity();
  if (!identity) {
    throw new FinanceAuthError(
      "دسترسی به بخش مالی تأمین‌کننده ممکن نیست؛ لطفاً وارد شوید",
    );
  }
  return identity;
}

// ---------------------------------------------------------------------------
// 1. Cafe Payment Operations
// ---------------------------------------------------------------------------

/**
 * Initiates an idempotent payment attempt for an order.
 * - Enforces cafe tenant isolation and role permissions.
 * - Amount is authoritatively derived from Order.totalAmount (client cannot supply amount).
 * - Enforces lifecycle policy: Only confirmed, preparing, shipped, or delivered orders can be paid.
 * - Prevents multiple successful payments for the same order.
 */
export async function createOrderPaymentAttempt(
  rawInput: unknown,
  providedIdentity?: CafeMemberIdentity,
): Promise<CafePaymentAttemptDTO> {
  const identity = providedIdentity || (await requireCafeFinanceAuth());

  if (!canInitiateCafePayment(identity)) {
    throw new FinancePermissionError(
      "شما دسترسی لازم برای شروع پرداخت سفارش را ندارید",
    );
  }

  const parsed = createPaymentAttemptSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new FinanceValidationError(
      parsed.error.issues[0]?.message || "داده‌های ورودی شروع پرداخت نامعتبر است",
    );
  }

  const { orderId, idempotencyKey } = parsed.data;

  // Tenant-scoped order load
  const order = await findOrderByIdForCafe(identity.cafeId, orderId);
  if (!order) {
    throw new FinanceNotFoundError("سفارش مورد نظر در کافه شما یافت نشد");
  }

  // Precondition: Order status policy
  if (order.status === "placed") {
    throw new FinanceInvalidStatusError(
      "سفارش هنوز توسط تأمین‌کننده تأیید نشده است؛ پرداخت فقط پس از تأیید سفارش امکان‌پذیر است",
    );
  }
  if (order.status === "cancelled" || order.status === "rejected") {
    throw new FinanceInvalidStatusError(
      "امکان پرداخت برای سفارش لغو یا رد شده وجود ندارد",
    );
  }
  if (!isOrderPayable(order.status)) {
    throw new FinanceInvalidStatusError(
      `وضعیت سفارش "${order.status}" برای پرداخت مجاز نیست`,
    );
  }

  // Invariant: One successful payment per Order
  const existingPaid = await findPaidPaymentForOrder(order.id);
  if (existingPaid) {
    throw new FinanceInvalidStatusError("این سفارش قبلاً با موفقیت پرداخت شده است");
  }

  // Authoritative amount from Order.totalAmount
  const authoritativeAmount = order.financials.totalAmount;
  if (
    typeof authoritativeAmount !== "number" ||
    !Number.isInteger(authoritativeAmount) ||
    authoritativeAmount <= 0 ||
    !Number.isSafeInteger(authoritativeAmount)
  ) {
    throw new FinanceValidationError("مبلغ کل سفارش نامعتبر است");
  }

  const { payment } = await createPaymentAttemptInRepo({
    cafeId: identity.cafeId,
    orderId: order.id,
    amount: authoritativeAmount,
    initiatedByUserId: identity.userId,
    idempotencyKey,
    method: "online",
    provider: "mock",
  });

  return {
    id: payment._id.toString(),
    paymentReference: payment.paymentReference,
    amount: payment.amount,
    status: payment.status,
    method: payment.method,
    createdAt: payment.createdAt.toISOString(),
  };
}

/**
 * Returns the payment status and history read model for a cafe's order.
 * Derived status: paid, pending, failed, or unpaid.
 */
export async function getCafeOrderPayment(
  orderId: string,
  providedIdentity?: CafeMemberIdentity,
): Promise<CafeOrderPaymentDTO> {
  const identity = providedIdentity || (await requireCafeFinanceAuth());

  if (!canViewCafePayments(identity)) {
    throw new FinancePermissionError(
      "شما دسترسی لازم برای مشاهده وضعیت پرداخت سفارش را ندارید",
    );
  }

  const validIdRes = financeEntityIdSchema.safeParse(orderId);
  if (!validIdRes.success) {
    throw new FinanceValidationError("شناسه سفارش نامعتبر است");
  }

  const order = await findOrderByIdForCafe(identity.cafeId, orderId);
  if (!order) {
    throw new FinanceNotFoundError("سفارش مورد نظر یافت نشد");
  }

  const payments = await findPaymentsForOrder(order.id);
  const paymentStatus = deriveOrderPaymentStatus(payments);

  const latest = payments[0] || null;
  const paidPayment = payments.find((p) => p.status === "paid");

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalAmount: order.financials.totalAmount,
    paymentStatus,
    paidAt: paidPayment?.paidAt ? paidPayment.paidAt.toISOString() : null,
    latestPayment: latest
      ? {
          id: latest._id.toString(),
          paymentReference: latest.paymentReference,
          amount: latest.amount,
          status: latest.status,
          method: latest.method,
          createdAt: latest.createdAt.toISOString(),
          paidAt: latest.paidAt ? latest.paidAt.toISOString() : null,
          failureMessage: latest.failureMessage || null,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// 2. Internal / Trusted Gateway Webhook Simulation
// (Never directly exposed to public Cafe client actions)
// ---------------------------------------------------------------------------

export async function markPaymentPaidInternal(rawInput: unknown): Promise<{
  paymentId: string;
  status: "paid";
  paidAt: string;
}> {
  const parsed = markPaymentPaidInternalSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new FinanceValidationError(
      parsed.error.issues[0]?.message || "شناسه پرداخت نامعتبر است",
    );
  }

  const { paymentId, providerReference } = parsed.data;

  const payment = await findPaymentById(paymentId);
  if (!payment) {
    throw new FinanceNotFoundError("پرداخت مورد نظر یافت نشد");
  }

  // Idempotent return if already paid
  if (payment.status === "paid") {
    return {
      paymentId: payment._id.toString(),
      status: "paid",
      paidAt: payment.paidAt
        ? payment.paidAt.toISOString()
        : new Date().toISOString(),
    };
  }

  if (payment.status !== "pending") {
    throw new FinanceInvalidStatusError(
      `امکان ثبت موفقیت برای پرداختی با وضعیت "${payment.status}" وجود ندارد`,
    );
  }

  // Invariant check: Verify no other payment is already paid for this order
  const existingPaid = await findPaidPaymentForOrder(
    payment.orderId.toString(),
  );
  if (existingPaid && existingPaid._id.toString() !== paymentId) {
    throw new FinanceInvalidStatusError(
      "پرداخت موفق دیگری قبلاً برای این سفارش ثبت شده است",
    );
  }

  // 1. Atomically mark payment paid
  const updatedPayment = await markPaymentPaidInRepo(
    paymentId,
    providerReference,
  );
  if (!updatedPayment) {
    throw new FinanceInvalidStatusError(
      "وضعیت پرداخت تغییر یافته و امکان ثبت موفقیت وجود ندارد",
    );
  }

  // 2. Fetch authoritative order to link supplier and delivery state
  const order = await Order.findById(payment.orderId)
    .lean<{
      _id: Types.ObjectId;
      orderNumber: string;
      cafeId: Types.ObjectId;
      supplierId: Types.ObjectId;
      status: string;
      totalAmount: number;
    } | null>()
    .exec();

  if (!order) {
    throw new FinanceNotFoundError("سفارش متصل به پرداخت یافت نشد");
  }

  // 3. Append immutable Transaction Ledger: payment_received
  try {
    await createTransactionInRepo({
      cafeId: order.cafeId.toString(),
      supplierId: order.supplierId.toString(),
      orderId: order._id.toString(),
      paymentId: updatedPayment._id.toString(),
      type: "payment_received",
      amount: updatedPayment.amount,
      direction: "credit",
      referenceNumber: updatedPayment.paymentReference,
      description: `دریافت وجه پرداخت سفارش ${order.orderNumber}`,
    });
  } catch (err) {
    console.error("Ledger transaction error (payment_received):", err);
  }

  // 4. Create or update SupplierPayable (pending if not delivered; eligible if already delivered)
  const isDelivered = order.status === "delivered";
  try {
    const payable = await createOrUpdatePayableOnPaymentInRepo({
      orderId: order._id.toString(),
      supplierId: order.supplierId.toString(),
      cafeId: order.cafeId.toString(),
      paymentId: updatedPayment._id.toString(),
      grossAmount: order.totalAmount,
      isDelivered,
    });

    // 5. Append immutable Transaction Ledger: supplier_payable_created
    await createTransactionInRepo({
      cafeId: order.cafeId.toString(),
      supplierId: order.supplierId.toString(),
      orderId: order._id.toString(),
      payableId: payable._id.toString(),
      type: "supplier_payable_created",
      amount: payable.netAmount,
      direction: "credit",
      referenceNumber: order.orderNumber,
      description: `ایجاد طلب پرداختنی تأمین‌کننده برای سفارش ${order.orderNumber}`,
    });
  } catch (payableErr) {
    console.error("Payable creation/ledger error:", payableErr);
  }

  return {
    paymentId: updatedPayment._id.toString(),
    status: "paid",
    paidAt: updatedPayment.paidAt!.toISOString(),
  };
}

export async function markPaymentFailedInternal(rawInput: unknown): Promise<{
  paymentId: string;
  status: "failed";
  failedAt: string;
}> {
  const parsed = markPaymentFailedInternalSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new FinanceValidationError(
      parsed.error.issues[0]?.message || "اطلاعات خطای پرداخت نامعتبر است",
    );
  }

  const { paymentId, failureCode, failureMessage } = parsed.data;

  const payment = await findPaymentById(paymentId);
  if (!payment) {
    throw new FinanceNotFoundError("پرداخت مورد نظر یافت نشد");
  }

  if (payment.status === "paid") {
    throw new FinanceInvalidStatusError(
      "امکان تغییر وضعیت پرداخت موفق به ناموفق وجود ندارد",
    );
  }

  const updated = await markPaymentFailedInRepo(
    paymentId,
    failureCode,
    failureMessage,
  );
  if (!updated) {
    throw new FinanceInvalidStatusError("وضعیت پرداخت تغییر یافته است");
  }

  return {
    paymentId: updated._id.toString(),
    status: "failed",
    failedAt: updated.failedAt
      ? updated.failedAt.toISOString()
      : new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 3. Order Integration: Order Delivered Event Handler
// ---------------------------------------------------------------------------

/**
 * Idempotently called when an order transitions to 'delivered'.
 * If a payable exists for this order in 'pending' status, it transitions to 'eligible'.
 * Isolated and safe: errors are captured so order delivery is never aborted.
 */
export async function syncPayableOnOrderDelivered(
  orderId: string,
): Promise<void> {
  if (!orderId || !Types.ObjectId.isValid(orderId)) return;

  try {
    await syncPayableOnDeliveredInRepo(orderId);
  } catch (err) {
    console.error("Failed to sync payable eligibility on order delivered:", err);
  }
}

// ---------------------------------------------------------------------------
// 4. Supplier Finance Operations
// ---------------------------------------------------------------------------

export async function getSupplierFinanceOverview(
  providedIdentity?: SupplierMemberIdentity,
): Promise<SupplierFinanceOverviewDTO> {
  const identity = providedIdentity || (await requireSupplierFinanceAuth());

  if (!canViewSupplierFinancials(identity)) {
    throw new FinancePermissionError(
      "شما دسترسی لازم برای مشاهده اطلاعات مالی تأمین‌کننده را ندارید",
    );
  }

  return getSupplierFinanceOverviewInRepo(identity.supplierId);
}

export async function listSupplierPayables(
  rawQuery: unknown,
  providedIdentity?: SupplierMemberIdentity,
): Promise<SupplierPayableListResult> {
  const identity = providedIdentity || (await requireSupplierFinanceAuth());

  if (!canViewSupplierFinancials(identity)) {
    throw new FinancePermissionError(
      "شما دسترسی لازم برای مشاهده اقلام پرداختنی تأمین‌کننده را ندارید",
    );
  }

  const parsed = supplierPayableQuerySchema.safeParse(rawQuery || {});
  const query = parsed.success
    ? parsed.data
    : { page: 1, pageSize: 20, status: undefined };

  return listPayablesForSupplier(identity.supplierId, query);
}

export async function listSupplierSettlements(
  rawQuery: unknown,
  providedIdentity?: SupplierMemberIdentity,
): Promise<SupplierSettlementListResult> {
  const identity = providedIdentity || (await requireSupplierFinanceAuth());

  if (!canViewSupplierFinancials(identity)) {
    throw new FinancePermissionError(
      "شما دسترسی لازم برای مشاهده تسویه‌حساب‌های تأمین‌کننده را ندارید",
    );
  }

  const parsed = supplierSettlementQuerySchema.safeParse(rawQuery || {});
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 20 };

  return listSettlementsForSupplierInRepo(identity.supplierId, query);
}

// ---------------------------------------------------------------------------
// 5. Admin Finance Operations
// ---------------------------------------------------------------------------

export async function getAdminFinanceOverview(
  providedAdmin?: AdminIdentity | null,
): Promise<AdminFinanceOverviewDTO> {
  const admin =
    providedAdmin !== undefined ? providedAdmin : await requireAdmin();
  if (!admin?.userId) {
    throw new FinanceAuthError("دسترسی فقط برای مدیران سامانه مجاز است");
  }

  return getAdminFinanceOverviewInRepo();
}

export async function listAdminPayments(
  rawQuery: unknown,
  providedAdmin?: AdminIdentity | null,
): Promise<AdminPaymentListResult> {
  const admin =
    providedAdmin !== undefined ? providedAdmin : await requireAdmin();
  if (!admin?.userId) {
    throw new FinanceAuthError("دسترسی فقط برای مدیران سامانه مجاز است");
  }

  const parsed = adminPaymentQuerySchema.safeParse(rawQuery || {});
  const query = parsed.success
    ? parsed.data
    : { page: 1, pageSize: 20, status: undefined };

  return listPaymentsForAdminInRepo(query);
}

export async function listAdminSettlements(
  rawQuery: unknown,
  providedAdmin?: AdminIdentity | null,
): Promise<AdminSettlementListResult> {
  const admin =
    providedAdmin !== undefined ? providedAdmin : await requireAdmin();
  if (!admin?.userId) {
    throw new FinanceAuthError("دسترسی فقط برای مدیران سامانه مجاز است");
  }

  const parsed = adminSettlementQuerySchema.safeParse(rawQuery || {});
  const query = parsed.success
    ? parsed.data
    : { page: 1, pageSize: 20, supplierId: undefined };

  return listSettlementsForAdminInRepo(query);
}

export async function getAdminSettlementCandidates(
  supplierId: string,
  providedAdmin?: AdminIdentity | null,
): Promise<AdminSettlementCandidateDTO[]> {
  const admin =
    providedAdmin !== undefined ? providedAdmin : await requireAdmin();
  if (!admin?.userId) {
    throw new FinanceAuthError("دسترسی فقط برای مدیران سامانه مجاز است");
  }

  const validId = financeEntityIdSchema.safeParse(supplierId);
  if (!validId.success) {
    throw new FinanceValidationError("شناسه تأمین‌کننده نامعتبر است");
  }

  return findEligiblePayablesForSupplier(supplierId);
}

export async function createSupplierSettlement(
  rawInput: unknown,
  providedAdmin?: AdminIdentity | null,
): Promise<CreateSettlementResultDTO> {
  const admin =
    providedAdmin !== undefined ? providedAdmin : await requireAdmin();
  if (!admin?.userId) {
    throw new FinanceAuthError("دسترسی فقط برای مدیران سامانه مجاز است");
  }

  const parsed = createSettlementSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new FinanceValidationError(
      parsed.error.issues[0]?.message || "داده‌های ورودی ثبت تسویه نامعتبر است",
    );
  }

  const { supplierId, payableIds, note } = parsed.data;

  try {
    const result = await createSettlementWithPayablesInRepo({
      supplierId,
      payableIds,
      adminUserId: admin.userId,
      note,
    });

    return result;
  } catch (err: unknown) {
    if (err instanceof SettlementValidationError) {
      throw new FinanceValidationError(err.message);
    }
    if (err instanceof SettlementConcurrencyError) {
      throw new FinanceConcurrencyError(err.message);
    }
    throw err;
  }
}
