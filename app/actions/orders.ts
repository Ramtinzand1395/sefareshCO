"use server";

import { revalidatePath } from "next/cache";

import type {
  CafeOrderDetailDTO,
  CafeOrderListResult,
  CreateOrdersFromSelectionResultDTO,
  SupplierOrderDetailDTO,
  SupplierOrderListResult,
} from "@/src/domain/order";
import {
  cancelCafeOrder,
  confirmSupplierOrder,
  createOrdersFromPurchaseRequestSelection,
  getCafeOrder,
  getSupplierOrder,
  listCafeOrders,
  listSupplierOrders,
  markSupplierOrderDelivered,
  markSupplierOrderPreparing,
  markSupplierOrderShipped,
  OrderAuthError,
  OrderCalculationError,
  OrderInsufficientStockError,
  OrderInvalidStatusError,
  OrderNotFoundError,
  OrderPermissionError,
  OrderStaleResponseError,
  OrderValidationError,
  rejectSupplierOrder,
} from "@/src/services/order-service";

export type OrderActionState<T = unknown> = {
  ok: boolean;
  error?: string;
  data?: T;
};

function revalidateOrderPaths(orderId?: string, rfqId?: string) {
  revalidatePath("/cafe/orders");
  revalidatePath("/supplier/orders");
  revalidatePath("/cafe/purchase-requests");
  if (orderId) {
    revalidatePath(`/cafe/orders/${orderId}`);
    revalidatePath(`/supplier/orders/${orderId}`);
  }
  if (rfqId) {
    revalidatePath(`/cafe/purchase-requests/${rfqId}`);
    revalidatePath(`/cafe/purchase-requests/${rfqId}/compare`);
  }
}

function handleOrderError<T>(error: unknown): OrderActionState<T> {
  if (error instanceof OrderAuthError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof OrderPermissionError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof OrderNotFoundError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof OrderInvalidStatusError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof OrderValidationError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof OrderStaleResponseError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof OrderInsufficientStockError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof OrderCalculationError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof Error) {
    return { ok: false, error: error.message };
  }
  return {
    ok: false,
    error: "خطای غیرمنتظره در پردازش سفارش؛ لطفاً دوباره تلاش کنید",
  };
}

// ---------------------------------------------------------------------------
// 1. Order Creation Action (Confirm Purchase)
// ---------------------------------------------------------------------------

export async function createOrdersFromSelectionAction(
  _prevState: OrderActionState<CreateOrdersFromSelectionResultDTO>,
  payload: FormData | Record<string, unknown>,
): Promise<OrderActionState<CreateOrdersFromSelectionResultDTO>> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      const rawJson = payload.get("data");
      if (typeof rawJson === "string") {
        rawData = JSON.parse(rawJson);
      } else {
        rawData = {
          purchaseRequestId: payload.get("purchaseRequestId"),
        };
      }
    } else {
      rawData = payload;
    }

    const result = await createOrdersFromPurchaseRequestSelection(rawData);
    revalidateOrderPaths(undefined, result.purchaseRequestId);
    return { ok: true, data: result };
  } catch (error) {
    return handleOrderError<CreateOrdersFromSelectionResultDTO>(error);
  }
}

// ---------------------------------------------------------------------------
// 2. Cafe Order Actions
// ---------------------------------------------------------------------------

export async function getCafeOrderDetailAction(
  orderId: string,
): Promise<OrderActionState<CafeOrderDetailDTO>> {
  try {
    const data = await getCafeOrder(orderId);
    return { ok: true, data };
  } catch (error) {
    return handleOrderError<CafeOrderDetailDTO>(error);
  }
}

export async function listCafeOrdersAction(
  query: unknown,
): Promise<OrderActionState<CafeOrderListResult>> {
  try {
    const data = await listCafeOrders(query);
    return { ok: true, data };
  } catch (error) {
    return handleOrderError<CafeOrderListResult>(error);
  }
}

export async function cancelCafeOrderAction(
  _prevState: OrderActionState<CafeOrderDetailDTO>,
  payload: FormData | Record<string, unknown>,
): Promise<OrderActionState<CafeOrderDetailDTO>> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      rawData = {
        orderId: payload.get("orderId"),
        cancelReason: payload.get("cancelReason") || undefined,
      };
    } else {
      rawData = payload;
    }

    const data = await cancelCafeOrder(rawData);
    revalidateOrderPaths(data.id, data.purchaseRequestId);
    return { ok: true, data };
  } catch (error) {
    return handleOrderError<CafeOrderDetailDTO>(error);
  }
}

// ---------------------------------------------------------------------------
// 3. Supplier Order Actions
// ---------------------------------------------------------------------------

export async function getSupplierOrderDetailAction(
  orderId: string,
): Promise<OrderActionState<SupplierOrderDetailDTO>> {
  try {
    const data = await getSupplierOrder(orderId);
    return { ok: true, data };
  } catch (error) {
    return handleOrderError<SupplierOrderDetailDTO>(error);
  }
}

export async function listSupplierOrdersAction(
  query: unknown,
): Promise<OrderActionState<SupplierOrderListResult>> {
  try {
    const data = await listSupplierOrders(query);
    return { ok: true, data };
  } catch (error) {
    return handleOrderError<SupplierOrderListResult>(error);
  }
}

export async function confirmSupplierOrderAction(
  orderId: string,
): Promise<OrderActionState<SupplierOrderDetailDTO>> {
  try {
    const data = await confirmSupplierOrder(orderId);
    revalidateOrderPaths(data.id, data.purchaseRequestId);
    return { ok: true, data };
  } catch (error) {
    return handleOrderError<SupplierOrderDetailDTO>(error);
  }
}

export async function rejectSupplierOrderAction(
  _prevState: OrderActionState<SupplierOrderDetailDTO>,
  payload: FormData | Record<string, unknown>,
): Promise<OrderActionState<SupplierOrderDetailDTO>> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      rawData = {
        orderId: payload.get("orderId"),
        rejectReason: payload.get("rejectReason") || undefined,
      };
    } else {
      rawData = payload;
    }

    const data = await rejectSupplierOrder(rawData);
    revalidateOrderPaths(data.id, data.purchaseRequestId);
    return { ok: true, data };
  } catch (error) {
    return handleOrderError<SupplierOrderDetailDTO>(error);
  }
}

export async function markSupplierOrderPreparingAction(
  orderId: string,
): Promise<OrderActionState<SupplierOrderDetailDTO>> {
  try {
    const data = await markSupplierOrderPreparing(orderId);
    revalidateOrderPaths(data.id, data.purchaseRequestId);
    return { ok: true, data };
  } catch (error) {
    return handleOrderError<SupplierOrderDetailDTO>(error);
  }
}

export async function markSupplierOrderShippedAction(
  _prevState: OrderActionState<SupplierOrderDetailDTO>,
  payload: FormData | Record<string, unknown>,
): Promise<OrderActionState<SupplierOrderDetailDTO>> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      rawData = {
        orderId: payload.get("orderId"),
        shippingNote: payload.get("shippingNote") || undefined,
      };
    } else {
      rawData = payload;
    }

    const data = await markSupplierOrderShipped(rawData);
    revalidateOrderPaths(data.id, data.purchaseRequestId);
    return { ok: true, data };
  } catch (error) {
    return handleOrderError<SupplierOrderDetailDTO>(error);
  }
}

export async function markSupplierOrderDeliveredAction(
  orderId: string,
): Promise<OrderActionState<SupplierOrderDetailDTO>> {
  try {
    const data = await markSupplierOrderDelivered(orderId);
    revalidateOrderPaths(data.id, data.purchaseRequestId);
    return { ok: true, data };
  } catch (error) {
    return handleOrderError<SupplierOrderDetailDTO>(error);
  }
}
