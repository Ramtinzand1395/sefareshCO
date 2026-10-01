"use server";

import { revalidatePath } from "next/cache";

import type {
  SupplierMatchingResultDTO,
  SupplierRequestCafeViewDTO,
  SupplierRequestSupplierViewDTO,
} from "@/src/domain/supplier-request";
import {
  getSupplierRequestForSupplier,
  getSupplierRequestsForCafeRFQ,
  listSupplierRequestsForSupplier,
  matchPurchaseRequestToSuppliers,
  SupplierMatchingAuthError,
  SupplierMatchingInvalidStatusError,
  SupplierMatchingNotFoundError,
  SupplierMatchingPermissionError,
  SupplierMatchingValidationError,
} from "@/src/services/supplier-matching-service";

export type SupplierMatchingActionState = {
  ok?: boolean;
  error?: string;
  data?: SupplierMatchingResultDTO;
};

const REVALIDATE_PATHS = [
  "/cafe/purchase-requests",
  "/supplier/requests",
];

function revalidateMatchingPaths() {
  for (const p of REVALIDATE_PATHS) {
    revalidatePath(p);
  }
}

function handleMatchingServiceError(error: unknown): SupplierMatchingActionState {
  if (error instanceof SupplierMatchingAuthError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof SupplierMatchingPermissionError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof SupplierMatchingNotFoundError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof SupplierMatchingInvalidStatusError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof SupplierMatchingValidationError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof Error) {
    return { ok: false, error: error.message };
  }
  return {
    ok: false,
    error: "خطای غیرمنتظره در پردازش تطبیق تأمین‌کنندگان",
  };
}

// ---------------------------------------------------------------------------
// 1. Match Purchase Request Action (Cafe-scoped trigger or re-run)
// ---------------------------------------------------------------------------

export async function matchPurchaseRequestAction(
  _prevState: SupplierMatchingActionState,
  payload: FormData | Record<string, unknown>,
): Promise<SupplierMatchingActionState> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      rawData = {
        requestId: payload.get("requestId"),
      };
    } else {
      rawData = payload;
    }

    const result = await matchPurchaseRequestToSuppliers(rawData);
    revalidateMatchingPaths();
    return { ok: true, data: result };
  } catch (error) {
    return handleMatchingServiceError(error);
  }
}

// ---------------------------------------------------------------------------
// 2. Get Supplier Requests for Cafe RFQ Action (Cafe-side inspection)
// ---------------------------------------------------------------------------

export async function getSupplierRequestsForCafeRFQAction(
  purchaseRequestId: string,
): Promise<{
  ok: boolean;
  data?: SupplierRequestCafeViewDTO[];
  error?: string;
}> {
  try {
    const data = await getSupplierRequestsForCafeRFQ(purchaseRequestId);
    return { ok: true, data };
  } catch (error) {
    const handled = handleMatchingServiceError(error);
    return { ok: false, error: handled.error };
  }
}

// ---------------------------------------------------------------------------
// 3. Get Single Supplier Request Detail for Supplier Action (Supplier-scoped)
// ---------------------------------------------------------------------------

export async function getSupplierRequestDetailForSupplierAction(
  requestId: string,
): Promise<{
  ok: boolean;
  data?: SupplierRequestSupplierViewDTO;
  error?: string;
}> {
  try {
    const data = await getSupplierRequestForSupplier(requestId);
    return { ok: true, data };
  } catch (error) {
    const handled = handleMatchingServiceError(error);
    return { ok: false, error: handled.error };
  }
}

// ---------------------------------------------------------------------------
// 4. List Supplier Requests for Supplier Action (Supplier Inbox)
// ---------------------------------------------------------------------------

export async function listSupplierRequestsForSupplierAction(
  query: unknown,
): Promise<{
  ok: boolean;
  data?: {
    items: SupplierRequestSupplierViewDTO[];
    total: number;
  };
  error?: string;
}> {
  try {
    const data = await listSupplierRequestsForSupplier(query);
    return { ok: true, data };
  } catch (error) {
    const handled = handleMatchingServiceError(error);
    return { ok: false, error: handled.error };
  }
}
