"use server";

import { revalidatePath } from "next/cache";

import type {
  PurchaseRequestComparisonDTO,
  PurchaseRequestSelectionDTO,
  SavePurchaseRequestSelectionResultDTO,
} from "@/src/domain/purchase-request-selection";
import {
  getPurchaseRequestComparison,
  getPurchaseRequestSelection,
  PurchaseRequestSelectionAuthError,
  PurchaseRequestSelectionConflictError,
  PurchaseRequestSelectionInvalidStatusError,
  PurchaseRequestSelectionInvariantError,
  PurchaseRequestSelectionNotFoundError,
  PurchaseRequestSelectionPermissionError,
  PurchaseRequestSelectionValidationError,
  savePurchaseRequestSelection,
} from "@/src/services/purchase-request-selection-service";

export type PurchaseRequestSelectionActionState<T = unknown> = {
  ok?: boolean;
  error?: string;
  conflict?: boolean;
  data?: T;
};

const REVALIDATE_PATHS = [
  "/cafe/purchase-requests",
  "/cafe/compare",
];

function revalidateSelectionPaths(purchaseRequestId?: string) {
  for (const p of REVALIDATE_PATHS) {
    revalidatePath(p);
  }
  if (purchaseRequestId) {
    revalidatePath(`/cafe/purchase-requests/${purchaseRequestId}`);
  }
}

function handleSelectionError<T>(
  error: unknown,
): PurchaseRequestSelectionActionState<T> {
  if (error instanceof PurchaseRequestSelectionConflictError) {
    return { ok: false, conflict: true, error: error.message };
  }
  if (error instanceof PurchaseRequestSelectionAuthError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof PurchaseRequestSelectionPermissionError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof PurchaseRequestSelectionNotFoundError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof PurchaseRequestSelectionInvalidStatusError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof PurchaseRequestSelectionInvariantError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof PurchaseRequestSelectionValidationError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof Error) {
    return { ok: false, error: error.message };
  }
  return {
    ok: false,
    error: "خطای غیرمنتظره در پردازش انتخاب‌های استعلام قیمت؛ لطفاً دوباره تلاش کنید",
  };
}

// ---------------------------------------------------------------------------
// 1. Get Purchase Request Comparison Action
// ---------------------------------------------------------------------------

export async function getPurchaseRequestComparisonAction(
  purchaseRequestId: string,
): Promise<{
  ok: boolean;
  data?: PurchaseRequestComparisonDTO;
  error?: string;
}> {
  try {
    const data = await getPurchaseRequestComparison(purchaseRequestId);
    return { ok: true, data };
  } catch (error) {
    const handled = handleSelectionError<PurchaseRequestComparisonDTO>(error);
    return { ok: false, error: handled.error };
  }
}

// ---------------------------------------------------------------------------
// 2. Get Purchase Request Selection Action
// ---------------------------------------------------------------------------

export async function getPurchaseRequestSelectionAction(
  purchaseRequestId: string,
): Promise<{
  ok: boolean;
  data?: PurchaseRequestSelectionDTO | null;
  error?: string;
}> {
  try {
    const data = await getPurchaseRequestSelection(purchaseRequestId);
    return { ok: true, data };
  } catch (error) {
    const handled = handleSelectionError<PurchaseRequestSelectionDTO | null>(error);
    return { ok: false, error: handled.error };
  }
}

// ---------------------------------------------------------------------------
// 3. Save Purchase Request Selection Action
// ---------------------------------------------------------------------------

export async function savePurchaseRequestSelectionAction(
  _prevState: PurchaseRequestSelectionActionState<SavePurchaseRequestSelectionResultDTO>,
  payload: FormData | Record<string, unknown>,
): Promise<PurchaseRequestSelectionActionState<SavePurchaseRequestSelectionResultDTO>> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      const rawJson = payload.get("data");
      if (typeof rawJson === "string") {
        rawData = JSON.parse(rawJson);
      } else {
        rawData = {
          purchaseRequestId: payload.get("purchaseRequestId"),
          expectedVersion: payload.get("expectedVersion")
            ? Number(payload.get("expectedVersion"))
            : undefined,
          items: JSON.parse((payload.get("items") as string) || "[]"),
        };
      }
    } else {
      rawData = payload;
    }

    const result = await savePurchaseRequestSelection(rawData);
    const rfqId =
      typeof rawData === "object" && rawData !== null && "purchaseRequestId" in rawData
        ? String((rawData as { purchaseRequestId: unknown }).purchaseRequestId)
        : undefined;

    revalidateSelectionPaths(rfqId);
    return { ok: true, data: result };
  } catch (error) {
    return handleSelectionError<SavePurchaseRequestSelectionResultDTO>(error);
  }
}
