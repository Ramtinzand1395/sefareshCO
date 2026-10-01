"use server";

import { revalidatePath } from "next/cache";

import {
  createInternalPurchaseRequest,
  cancelInternalPurchaseRequest,
  reviewInternalPurchaseRequest,
  InternalRequestAuthError,
  InternalRequestNotFoundError,
  InternalRequestPermissionError,
  InternalRequestValidationError,
  InvalidCatalogProductError,
  InvalidRequestStateTransitionError,
} from "@/src/services/internal-purchase-request-service";

export type InternalPurchaseRequestActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  createdId?: string;
  status?: string;
};

const REVALIDATE_PATHS = [
  "/cafe/internal-requests",
  "/cafe/purchase-requests",
];

function revalidateInternalRequestPaths() {
  for (const p of REVALIDATE_PATHS) {
    revalidatePath(p);
  }
}

function handleServiceError(error: unknown): InternalPurchaseRequestActionState {
  if (error instanceof InternalRequestAuthError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof InternalRequestPermissionError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof InternalRequestNotFoundError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof InvalidCatalogProductError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof InvalidRequestStateTransitionError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof InternalRequestValidationError) {
    return { ok: false, error: error.message };
  }
  return {
    ok: false,
    error: "خطای غیرمنتظره در پردازش درخواست داخلی؛ لطفاً دوباره تلاش کنید",
  };
}

// ---------------------------------------------------------------------------
// 1. Create Internal Purchase Request Action
// ---------------------------------------------------------------------------

export async function createInternalPurchaseRequestAction(
  _prevState: InternalPurchaseRequestActionState,
  payload: FormData | Record<string, unknown>,
): Promise<InternalPurchaseRequestActionState> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      const itemsRaw = payload.get("items");
      let items: unknown = [];
      if (typeof itemsRaw === "string" && itemsRaw.trim() !== "") {
        try {
          items = JSON.parse(itemsRaw);
        } catch {
          return {
            ok: false,
            error: "فرمت اقلام ارسالی نامعتبر است",
          };
        }
      }

      rawData = {
        title: payload.get("title") || undefined,
        description: payload.get("description") || undefined,
        items,
      };
    } else {
      rawData = payload;
    }

    const createdId = await createInternalPurchaseRequest(rawData);
    revalidateInternalRequestPaths();
    return { ok: true, createdId };
  } catch (error) {
    return handleServiceError(error);
  }
}

// ---------------------------------------------------------------------------
// 2. Review Internal Purchase Request Action
// ---------------------------------------------------------------------------

export async function reviewInternalPurchaseRequestAction(
  _prevState: InternalPurchaseRequestActionState,
  payload: FormData | Record<string, unknown>,
): Promise<InternalPurchaseRequestActionState> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      const itemsRaw = payload.get("items");
      let items: unknown = [];
      if (typeof itemsRaw === "string" && itemsRaw.trim() !== "") {
        try {
          items = JSON.parse(itemsRaw);
        } catch {
          return {
            ok: false,
            error: "فرمت اقلام ارسالی برای بررسی نامعتبر است",
          };
        }
      }

      rawData = {
        requestId: payload.get("requestId"),
        reviewNotes: payload.get("reviewNotes") || undefined,
        items,
      };
    } else {
      rawData = payload;
    }

    const result = await reviewInternalPurchaseRequest(rawData);
    revalidateInternalRequestPaths();
    return { ok: true, status: result.status };
  } catch (error) {
    return handleServiceError(error);
  }
}

// ---------------------------------------------------------------------------
// 3. Cancel Internal Purchase Request Action
// ---------------------------------------------------------------------------

export async function cancelInternalPurchaseRequestAction(
  _prevState: InternalPurchaseRequestActionState,
  payload: FormData | Record<string, unknown>,
): Promise<InternalPurchaseRequestActionState> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      rawData = {
        requestId: payload.get("requestId"),
        cancelReason: payload.get("cancelReason") || undefined,
      };
    } else {
      rawData = payload;
    }

    await cancelInternalPurchaseRequest(rawData);
    revalidateInternalRequestPaths();
    return { ok: true };
  } catch (error) {
    return handleServiceError(error);
  }
}
