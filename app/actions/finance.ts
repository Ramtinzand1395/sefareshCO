"use server";

import { revalidatePath } from "next/cache";

import type {
  AdminFinanceOverviewDTO,
  AdminPaymentListResult,
  AdminSettlementCandidateDTO,
  AdminSettlementListResult,
  CafeOrderPaymentDTO,
  CafePaymentAttemptDTO,
  CreateSettlementResultDTO,
  SupplierFinanceOverviewDTO,
  SupplierPayableListResult,
  SupplierSettlementListResult,
} from "@/src/domain/finance";
import {
  createOrderPaymentAttempt,
  createSupplierSettlement,
  FinanceAuthError,
  FinanceConcurrencyError,
  FinanceInvalidStatusError,
  FinanceNotFoundError,
  FinancePermissionError,
  FinanceValidationError,
  getAdminFinanceOverview,
  getAdminSettlementCandidates,
  getCafeOrderPayment,
  getSupplierFinanceOverview,
  listAdminPayments,
  listAdminSettlements,
  listSupplierPayables,
  listSupplierSettlements,
} from "@/src/services/finance-service";

export type FinanceActionState<T = unknown> = {
  ok: boolean;
  error?: string;
  data?: T;
};

function revalidateFinancePaths(orderId?: string, supplierId?: string) {
  revalidatePath("/cafe/orders");
  revalidatePath("/supplier/orders");
  revalidatePath("/supplier/finance");
  revalidatePath("/admin/finance");
  if (orderId) {
    revalidatePath(`/cafe/orders/${orderId}`);
    revalidatePath(`/supplier/orders/${orderId}`);
  }
  if (supplierId) {
    revalidatePath(`/admin/finance/suppliers/${supplierId}`);
  }
}

function handleFinanceError<T>(error: unknown): FinanceActionState<T> {
  if (error instanceof FinanceAuthError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof FinancePermissionError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof FinanceNotFoundError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof FinanceInvalidStatusError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof FinanceValidationError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof FinanceConcurrencyError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof Error) {
    return { ok: false, error: error.message };
  }
  return {
    ok: false,
    error: "خطای غیرمنتظره در پردازش مالی؛ لطفاً دوباره تلاش کنید",
  };
}

// ---------------------------------------------------------------------------
// 1. Cafe Finance Server Actions
// ---------------------------------------------------------------------------

export async function createOrderPaymentAction(
  _prevState: FinanceActionState<CafePaymentAttemptDTO>,
  payload: FormData | Record<string, unknown>,
): Promise<FinanceActionState<CafePaymentAttemptDTO>> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      const rawJson = payload.get("data");
      if (typeof rawJson === "string") {
        rawData = JSON.parse(rawJson);
      } else {
        rawData = {
          orderId: payload.get("orderId"),
          idempotencyKey: payload.get("idempotencyKey"),
        };
      }
    } else {
      rawData = payload;
    }

    const data = await createOrderPaymentAttempt(rawData);
    revalidateFinancePaths();
    return { ok: true, data };
  } catch (error) {
    return handleFinanceError<CafePaymentAttemptDTO>(error);
  }
}

export async function getCafeOrderPaymentAction(
  orderId: string,
): Promise<FinanceActionState<CafeOrderPaymentDTO>> {
  try {
    const data = await getCafeOrderPayment(orderId);
    return { ok: true, data };
  } catch (error) {
    return handleFinanceError<CafeOrderPaymentDTO>(error);
  }
}

// ---------------------------------------------------------------------------
// 2. Supplier Finance Server Actions
// ---------------------------------------------------------------------------

export async function getSupplierFinanceOverviewAction(): Promise<
  FinanceActionState<SupplierFinanceOverviewDTO>
> {
  try {
    const data = await getSupplierFinanceOverview();
    return { ok: true, data };
  } catch (error) {
    return handleFinanceError<SupplierFinanceOverviewDTO>(error);
  }
}

export async function listSupplierPayablesAction(
  query: unknown,
): Promise<FinanceActionState<SupplierPayableListResult>> {
  try {
    const data = await listSupplierPayables(query);
    return { ok: true, data };
  } catch (error) {
    return handleFinanceError<SupplierPayableListResult>(error);
  }
}

export async function listSupplierSettlementsAction(
  query: unknown,
): Promise<FinanceActionState<SupplierSettlementListResult>> {
  try {
    const data = await listSupplierSettlements(query);
    return { ok: true, data };
  } catch (error) {
    return handleFinanceError<SupplierSettlementListResult>(error);
  }
}

// ---------------------------------------------------------------------------
// 3. Admin Finance Server Actions
// ---------------------------------------------------------------------------

export async function getAdminFinanceOverviewAction(): Promise<
  FinanceActionState<AdminFinanceOverviewDTO>
> {
  try {
    const data = await getAdminFinanceOverview();
    return { ok: true, data };
  } catch (error) {
    return handleFinanceError<AdminFinanceOverviewDTO>(error);
  }
}

export async function listAdminPaymentsAction(
  query: unknown,
): Promise<FinanceActionState<AdminPaymentListResult>> {
  try {
    const data = await listAdminPayments(query);
    return { ok: true, data };
  } catch (error) {
    return handleFinanceError<AdminPaymentListResult>(error);
  }
}

export async function listAdminSettlementsAction(
  query: unknown,
): Promise<FinanceActionState<AdminSettlementListResult>> {
  try {
    const data = await listAdminSettlements(query);
    return { ok: true, data };
  } catch (error) {
    return handleFinanceError<AdminSettlementListResult>(error);
  }
}

export async function getAdminSettlementCandidatesAction(
  supplierId: string,
): Promise<FinanceActionState<AdminSettlementCandidateDTO[]>> {
  try {
    const data = await getAdminSettlementCandidates(supplierId);
    return { ok: true, data };
  } catch (error) {
    return handleFinanceError<AdminSettlementCandidateDTO[]>(error);
  }
}

export async function createSupplierSettlementAction(
  _prevState: FinanceActionState<CreateSettlementResultDTO>,
  payload: FormData | Record<string, unknown>,
): Promise<FinanceActionState<CreateSettlementResultDTO>> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      const rawJson = payload.get("data");
      if (typeof rawJson === "string") {
        rawData = JSON.parse(rawJson);
      } else {
        rawData = {
          supplierId: payload.get("supplierId"),
          payableIds: payload.getAll("payableIds"),
          note: payload.get("note") || undefined,
        };
      }
    } else {
      rawData = payload;
    }

    const data = await createSupplierSettlement(rawData);
    revalidateFinancePaths(undefined, data.supplierId);
    return { ok: true, data };
  } catch (error) {
    return handleFinanceError<CreateSettlementResultDTO>(error);
  }
}
