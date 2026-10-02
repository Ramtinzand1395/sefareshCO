import crypto from "crypto";

import type { OrderStatus } from "@/model/order";
import {
  paymentMethodValues,
  paymentProviderValues,
  paymentStatusValues,
  type PaymentMethod,
  type PaymentProvider,
  type PaymentStatus,
} from "@/model/payment";
import {
  supplierPayableStatusValues,
  type SupplierPayableStatus,
} from "@/model/supplier-payable";
import {
  supplierSettlementStatusValues,
  type SupplierSettlementStatus,
} from "@/model/supplier-settlement";
import {
  transactionDirectionValues,
  transactionTypeValues,
  type TransactionDirection,
  type TransactionType,
} from "@/model/transaction";

export {
  paymentMethodValues,
  paymentProviderValues,
  paymentStatusValues,
  supplierPayableStatusValues,
  supplierSettlementStatusValues,
  transactionDirectionValues,
  transactionTypeValues,
};

export type {
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  SupplierPayableStatus,
  SupplierSettlementStatus,
  TransactionDirection,
  TransactionType,
};

// ---------------------------------------------------------------------------
// 1. Domain Constants & Lifecycle Rules
// ---------------------------------------------------------------------------

/**
 * Business Rule: Which Order statuses are eligible for payment.
 * Placed: not payable (prevents financial dead-end since supplier hasn't confirmed yet).
 * Cancelled / Rejected: not payable.
 * Confirmed / Preparing / Shipped / Delivered: payable.
 */
export const PAYABLE_ORDER_STATUSES: readonly OrderStatus[] = [
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
] as const;

export function isOrderPayable(status: OrderStatus): boolean {
  return (PAYABLE_ORDER_STATUSES as readonly string[]).includes(status);
}

// ---------------------------------------------------------------------------
// 2. Derived Order Payment Status
// Order does NOT store paymentStatus. It is derived purely from payments.
// ---------------------------------------------------------------------------

export type OrderPaymentDerivedStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "failed";

export function deriveOrderPaymentStatus(
  payments: Array<{ status: PaymentStatus }>,
): OrderPaymentDerivedStatus {
  if (!payments || payments.length === 0) {
    return "unpaid";
  }

  // 1. Any successful payment makes the order paid
  if (payments.some((p) => p.status === "paid")) {
    return "paid";
  }

  // 2. If an active pending payment attempt exists
  if (payments.some((p) => p.status === "pending")) {
    return "pending";
  }

  // 3. If there are failed attempts and none are paid or pending
  if (payments.some((p) => p.status === "failed")) {
    return "failed";
  }

  return "unpaid";
}

// ---------------------------------------------------------------------------
// 3. Human-Readable Reference Number Generators
// Format:
// Payment: PAY-YYMM-XXXXX (e.g. PAY-2610-K8P9W)
// Transaction: TXN-YYMM-XXXXX (e.g. TXN-2610-K8P9W)
// Settlement: STL-YYMM-XXXXX (e.g. STL-2610-K8P9W)
// ---------------------------------------------------------------------------

const REFERENCE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function generatePrefixedReference(prefix: string): string {
  const now = new Date();
  const year = (now.getFullYear() % 100).toString().padStart(2, "0");
  const month = (now.getMonth() + 1).toString().padStart(2, "0");

  const randomBytes = crypto.randomBytes(5);
  let code = "";
  for (let i = 0; i < 5; i++) {
    const index = randomBytes[i] % REFERENCE_CHARS.length;
    code += REFERENCE_CHARS[index];
  }

  return `${prefix}-${year}${month}-${code}`;
}

export function generatePaymentReference(): string {
  return generatePrefixedReference("PAY");
}

export function generateTransactionNumber(): string {
  return generatePrefixedReference("TXN");
}

export function generateSettlementNumber(): string {
  return generatePrefixedReference("STL");
}

// ---------------------------------------------------------------------------
// 4. Cafe Views DTOs
// Strict Privacy: Only cafe's own orders, no supplier settlement or internal data.
// ---------------------------------------------------------------------------

export type CafePaymentAttemptDTO = {
  id: string;
  paymentReference: string;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod;
  createdAt: string;
};

export type CafeOrderPaymentDTO = {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  paymentStatus: OrderPaymentDerivedStatus;
  paidAt: string | null;
  latestPayment: {
    id: string;
    paymentReference: string;
    amount: number;
    status: PaymentStatus;
    method: PaymentMethod;
    createdAt: string;
    paidAt: string | null;
    failureMessage: string | null;
  } | null;
};

// ---------------------------------------------------------------------------
// 5. Supplier Views DTOs
// Strict Privacy: Only supplier's own payables and settlements.
// ---------------------------------------------------------------------------

export type SupplierFinanceOverviewDTO = {
  pendingPayableAmount: number;
  eligibleSettlementAmount: number;
  settledAmount: number;
  totalPayableCount: number;
};

export type SupplierPayableListItemDTO = {
  id: string;
  orderId: string;
  orderNumber: string;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  status: SupplierPayableStatus;
  createdAt: string;
  eligibleAt: string | null;
  settledAt: string | null;
  settlementNumber: string | null;
};

export type SupplierPayableListResult = {
  items: SupplierPayableListItemDTO[];
  total: number;
};

export type SupplierSettlementListItemDTO = {
  id: string;
  settlementNumber: string;
  payableCount: number;
  totalAmount: number;
  settledAt: string;
  note: string | null;
};

export type SupplierSettlementListResult = {
  items: SupplierSettlementListItemDTO[];
  total: number;
};

// ---------------------------------------------------------------------------
// 6. Admin Views DTOs
// Full platform oversight, auditability, and settlement processing.
// ---------------------------------------------------------------------------

export type AdminFinanceOverviewDTO = {
  totalSuccessfulPayments: number;
  totalReceivedAmount: number;
  pendingSupplierPayableAmount: number;
  eligibleSettlementAmount: number;
  settledAmount: number;
};

export type AdminPaymentListItemDTO = {
  id: string;
  paymentReference: string;
  orderId: string;
  orderNumber: string;
  cafeId: string;
  cafeName: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod;
  provider: PaymentProvider;
  createdAt: string;
  paidAt: string | null;
  failureMessage: string | null;
};

export type AdminPaymentListResult = {
  items: AdminPaymentListItemDTO[];
  total: number;
};

export type AdminSettlementListItemDTO = {
  id: string;
  settlementNumber: string;
  supplierId: string;
  supplierName: string;
  payableCount: number;
  totalAmount: number;
  settledAt: string;
  settledByAdminUserId: string;
  note: string | null;
};

export type AdminSettlementListResult = {
  items: AdminSettlementListItemDTO[];
  total: number;
};

export type AdminSettlementCandidateDTO = {
  id: string;
  orderId: string;
  orderNumber: string;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  status: "eligible";
  eligibleAt: string | null;
  createdAt: string;
};

export type CreateSettlementResultDTO = {
  settlementId: string;
  settlementNumber: string;
  supplierId: string;
  supplierName: string;
  payableCount: number;
  totalAmount: number;
  settledAt: string;
};
