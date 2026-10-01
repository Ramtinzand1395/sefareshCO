"use server";

import { revalidatePath } from "next/cache";

import type {
  SupplierRequestDeclineResultDTO,
  SupplierResponseCafeViewDTO,
  SupplierResponseSupplierViewDTO,
} from "@/src/domain/supplier-response";
import {
  declineSupplierRequest,
  getSupplierResponseForSupplier,
  getSupplierResponsesForCafeRFQ,
  submitSupplierResponse,
  SupplierResponseAuthError,
  SupplierResponseInvalidStatusError,
  SupplierResponseNotFoundError,
  SupplierResponsePermissionError,
  SupplierResponseValidationError,
  updateSupplierResponseService,
} from "@/src/services/supplier-response-service";

export type SupplierResponseActionState<T = unknown> = {
  ok?: boolean;
  error?: string;
  data?: T;
};

const REVALIDATE_PATHS = [
  "/supplier/requests",
  "/cafe/purchase-requests",
];

function revalidateResponsePaths(supplierRequestId?: string) {
  for (const p of REVALIDATE_PATHS) {
    revalidatePath(p);
  }
  if (supplierRequestId) {
    revalidatePath(`/supplier/requests/${supplierRequestId}`);
  }
}

function handleResponseServiceError<T>(
  error: unknown,
): SupplierResponseActionState<T> {
  if (error instanceof SupplierResponseAuthError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof SupplierResponsePermissionError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof SupplierResponseNotFoundError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof SupplierResponseInvalidStatusError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof SupplierResponseValidationError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof Error) {
    return { ok: false, error: error.message };
  }
  return {
    ok: false,
    error: "خطای غیرمنتظره در ثبت یا ویرایش پاسخ تأمین‌کننده",
  };
}

// ---------------------------------------------------------------------------
// 1. Submit Supplier Response Action
// ---------------------------------------------------------------------------

export async function submitSupplierResponseAction(
  _prevState: SupplierResponseActionState<SupplierResponseSupplierViewDTO>,
  payload: FormData | Record<string, unknown>,
): Promise<SupplierResponseActionState<SupplierResponseSupplierViewDTO>> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      const rawJson = payload.get("data");
      if (typeof rawJson === "string") {
        rawData = JSON.parse(rawJson);
      } else {
        rawData = {
          supplierRequestId: payload.get("supplierRequestId"),
          deliveryDays: Number(payload.get("deliveryDays")),
          shippingCost: Number(payload.get("shippingCost")),
          note: payload.get("note") || undefined,
          items: JSON.parse((payload.get("items") as string) || "[]"),
        };
      }
    } else {
      rawData = payload;
    }

    const result = await submitSupplierResponse(rawData);
    revalidateResponsePaths(result.supplierRequestId);
    return { ok: true, data: result };
  } catch (error) {
    return handleResponseServiceError(error);
  }
}

// ---------------------------------------------------------------------------
// 2. Update Supplier Response Action (Edit Quote)
// ---------------------------------------------------------------------------

export async function updateSupplierResponseAction(
  _prevState: SupplierResponseActionState<SupplierResponseSupplierViewDTO>,
  payload: FormData | Record<string, unknown>,
): Promise<SupplierResponseActionState<SupplierResponseSupplierViewDTO>> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      const rawJson = payload.get("data");
      if (typeof rawJson === "string") {
        rawData = JSON.parse(rawJson);
      } else {
        rawData = {
          supplierRequestId: payload.get("supplierRequestId"),
          deliveryDays: Number(payload.get("deliveryDays")),
          shippingCost: Number(payload.get("shippingCost")),
          note: payload.get("note") || undefined,
          items: JSON.parse((payload.get("items") as string) || "[]"),
        };
      }
    } else {
      rawData = payload;
    }

    const result = await updateSupplierResponseService(rawData);
    revalidateResponsePaths(result.supplierRequestId);
    return { ok: true, data: result };
  } catch (error) {
    return handleResponseServiceError(error);
  }
}

// ---------------------------------------------------------------------------
// 3. Decline Supplier Request Action
// ---------------------------------------------------------------------------

export async function declineSupplierRequestAction(
  _prevState: SupplierResponseActionState<SupplierRequestDeclineResultDTO>,
  payload: FormData | Record<string, unknown>,
): Promise<SupplierResponseActionState<SupplierRequestDeclineResultDTO>> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      rawData = {
        supplierRequestId: payload.get("supplierRequestId"),
        reason: payload.get("reason") || undefined,
      };
    } else {
      rawData = payload;
    }

    const result = await declineSupplierRequest(rawData);
    revalidateResponsePaths(result.supplierRequestId);
    return { ok: true, data: result };
  } catch (error) {
    return handleResponseServiceError(error);
  }
}

// ---------------------------------------------------------------------------
// 4. Get Single Supplier Response For Supplier Action
// ---------------------------------------------------------------------------

export async function getSupplierResponseForSupplierAction(
  supplierRequestId: string,
): Promise<{
  ok: boolean;
  data?: SupplierResponseSupplierViewDTO;
  error?: string;
}> {
  try {
    const data = await getSupplierResponseForSupplier(supplierRequestId);
    return { ok: true, data };
  } catch (error) {
    const handled = handleResponseServiceError(error);
    return { ok: false, error: handled.error };
  }
}

// ---------------------------------------------------------------------------
// 5. Get All Supplier Responses For Cafe RFQ Action
// ---------------------------------------------------------------------------

export async function getSupplierResponsesForCafeRFQAction(
  purchaseRequestId: string,
): Promise<{
  ok: boolean;
  data?: SupplierResponseCafeViewDTO[];
  error?: string;
}> {
  try {
    const data = await getSupplierResponsesForCafeRFQ(purchaseRequestId);
    return { ok: true, data };
  } catch (error) {
    const handled = handleResponseServiceError(error);
    return { ok: false, error: handled.error };
  }
}
