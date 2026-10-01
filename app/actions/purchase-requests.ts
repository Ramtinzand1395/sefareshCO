"use server";

import { revalidatePath } from "next/cache";

import type {
  PurchaseRequestDetailDTO,
  PurchaseRequestListResult,
  ShoppingListAvailabilityDTO,
} from "@/src/domain/purchase-request";
import {
  cancelPurchaseRequest,
  createPurchaseRequest,
  getPurchaseRequestById,
  getShoppingListAvailability,
  listPurchaseRequests,
  PurchaseRequestAuthError,
  PurchaseRequestConcurrencyError,
  PurchaseRequestNotFoundError,
  PurchaseRequestOverAllocationError,
  PurchaseRequestPermissionError,
  PurchaseRequestValidationError,
  submitPurchaseRequest,
} from "@/src/services/purchase-request-service";

export type PurchaseRequestActionState = {
  ok?: boolean;
  error?: string;
  data?: PurchaseRequestDetailDTO;
};

const REVALIDATE_PATHS = [
  "/cafe/purchase-requests",
  "/cafe/shopping-list",
];

function revalidatePurchaseRequestPaths() {
  for (const p of REVALIDATE_PATHS) {
    revalidatePath(p);
  }
}

function handleServiceError(error: unknown): PurchaseRequestActionState {
  if (error instanceof PurchaseRequestAuthError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof PurchaseRequestPermissionError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof PurchaseRequestNotFoundError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof PurchaseRequestOverAllocationError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof PurchaseRequestConcurrencyError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof PurchaseRequestValidationError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof Error) {
    return { ok: false, error: error.message };
  }
  return {
    ok: false,
    error: "خطای غیرمنتظره در پردازش استعلام قیمت؛ لطفاً دوباره تلاش کنید",
  };
}

// ---------------------------------------------------------------------------
// 1. Create Purchase Request Action
// ---------------------------------------------------------------------------

export async function createPurchaseRequestAction(
  _prevState: PurchaseRequestActionState,
  payload: FormData | Record<string, unknown>,
): Promise<PurchaseRequestActionState> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      const rawJson = payload.get("payload");
      if (typeof rawJson === "string") {
        rawData = JSON.parse(rawJson);
      } else {
        rawData = {
          title: payload.get("title") || undefined,
          note: payload.get("note") || undefined,
          neededByDate: payload.get("neededByDate") || undefined,
          idempotencyKey: payload.get("idempotencyKey") || undefined,
          submitImmediately: payload.get("submitImmediately") === "true",
          items: [],
        };
      }
    } else {
      rawData = payload;
    }

    const result = await createPurchaseRequest(rawData);
    revalidatePurchaseRequestPaths();
    return { ok: true, data: result };
  } catch (error) {
    return handleServiceError(error);
  }
}

// ---------------------------------------------------------------------------
// 2. Submit Purchase Request Action
// ---------------------------------------------------------------------------

export async function submitPurchaseRequestAction(
  _prevState: PurchaseRequestActionState,
  payload: FormData | Record<string, unknown>,
): Promise<PurchaseRequestActionState> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      rawData = {
        requestId: payload.get("requestId"),
      };
    } else {
      rawData = payload;
    }

    const result = await submitPurchaseRequest(rawData);
    revalidatePurchaseRequestPaths();
    return { ok: true, data: result };
  } catch (error) {
    return handleServiceError(error);
  }
}

// ---------------------------------------------------------------------------
// 3. Cancel Purchase Request Action
// ---------------------------------------------------------------------------

export async function cancelPurchaseRequestAction(
  _prevState: PurchaseRequestActionState,
  payload: FormData | Record<string, unknown>,
): Promise<PurchaseRequestActionState> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      rawData = {
        requestId: payload.get("requestId"),
        reason: payload.get("reason") || undefined,
      };
    } else {
      rawData = payload;
    }

    const result = await cancelPurchaseRequest(rawData);
    revalidatePurchaseRequestPaths();
    return { ok: true, data: result };
  } catch (error) {
    return handleServiceError(error);
  }
}

// ---------------------------------------------------------------------------
// 4. Get Purchase Request Detail Action
// ---------------------------------------------------------------------------

export async function getPurchaseRequestDetailAction(
  requestIdOrRef: string,
): Promise<{
  ok: boolean;
  data?: PurchaseRequestDetailDTO;
  error?: string;
}> {
  try {
    const data = await getPurchaseRequestById(requestIdOrRef);
    return { ok: true, data };
  } catch (error) {
    const handled = handleServiceError(error);
    return { ok: false, error: handled.error };
  }
}

// ---------------------------------------------------------------------------
// 5. List Purchase Requests Action
// ---------------------------------------------------------------------------

export async function listPurchaseRequestsAction(
  query: unknown,
): Promise<{
  ok: boolean;
  data?: PurchaseRequestListResult;
  error?: string;
}> {
  try {
    const data = await listPurchaseRequests(query);
    return { ok: true, data };
  } catch (error) {
    const handled = handleServiceError(error);
    return { ok: false, error: handled.error };
  }
}

// ---------------------------------------------------------------------------
// 6. Get Shopping List Availability Action
// ---------------------------------------------------------------------------

export async function getShoppingListAvailabilityAction(): Promise<{
  ok: boolean;
  data?: ShoppingListAvailabilityDTO;
  error?: string;
}> {
  try {
    const data = await getShoppingListAvailability();
    return { ok: true, data };
  } catch (error) {
    const handled = handleServiceError(error);
    return { ok: false, error: handled.error };
  }
}
