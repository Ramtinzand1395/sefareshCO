import crypto from "crypto";

import type {
  OrderItemType,
  OrderStatus,
} from "@/model/order";
import {
  orderItemTypeValues,
  orderStatusValues,
} from "@/model/order";

export { orderItemTypeValues, orderStatusValues };
export type { OrderItemType, OrderStatus };

// ---------------------------------------------------------------------------
// 1. Order Item & Component DTOs
// ---------------------------------------------------------------------------

export type OrderItemSnapshotDTO = {
  id: string;
  purchaseRequestItemId: string;
  supplierRequestId: string;
  supplierResponseId: string;
  productId?: string | null;
  matchedSupplierOfferId?: string | null;
  itemType: OrderItemType;
  title: string;
  unit: string;
  brand?: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type OrderFinancialSummaryDTO = {
  itemsSubtotal: number;
  shippingCost: number;
  totalAmount: number;
};

export type OrderDeliveryDTO = {
  deliveryDays: number;
  shippingNote?: string | null;
};

export type OrderTimelineDTO = {
  placedAt: string;
  confirmedAt?: string | null;
  preparingAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  rejectedAt?: string | null;
};

// ---------------------------------------------------------------------------
// 2. Allowed Actions DTOs
// ---------------------------------------------------------------------------

export type CafeOrderAllowedActionsDTO = {
  canCancel: boolean;
};

export type SupplierOrderAllowedActionsDTO = {
  canConfirm: boolean;
  canReject: boolean;
  canMarkPreparing: boolean;
  canMarkShipped: boolean;
  canMarkDelivered: boolean;
};

// ---------------------------------------------------------------------------
// 3. Cafe Views (Strict Privacy: No internal supplier members/costs exposed)
// ---------------------------------------------------------------------------

export type CafeOrderListItemDTO = {
  id: string;
  orderNumber: string;
  purchaseRequestId: string;
  supplierId: string;
  supplierName: string;
  status: OrderStatus;
  itemCount: number;
  totalAmount: number;
  deliveryDays: number;
  createdAt: string;
  placedAt: string;
};

export type CafeOrderDetailDTO = {
  id: string;
  orderNumber: string;
  cafeId: string;
  createdByUserId: string;
  purchaseRequestId: string;
  purchaseRequestSelectionId: string;
  supplier: {
    id: string;
    businessName: string;
  };
  status: OrderStatus;
  items: OrderItemSnapshotDTO[];
  financials: OrderFinancialSummaryDTO;
  delivery: OrderDeliveryDTO;
  timeline: OrderTimelineDTO;
  cancellation?: {
    cancelledAt: string;
    cancelReason?: string | null;
  } | null;
  rejection?: {
    rejectedAt: string;
    rejectReason?: string | null;
  } | null;
  allowedActions: CafeOrderAllowedActionsDTO;
  createdAt: string;
  updatedAt: string;
};

export type CafeOrderListResult = {
  items: CafeOrderListItemDTO[];
  total: number;
};

// ---------------------------------------------------------------------------
// 4. Supplier Views (Strict Privacy: Cafe business name only, no internal cafe data)
// ---------------------------------------------------------------------------

export type SupplierOrderListItemDTO = {
  id: string;
  orderNumber: string;
  purchaseRequestId: string;
  cafeId: string;
  cafeName: string;
  status: OrderStatus;
  itemCount: number;
  totalAmount: number;
  deliveryDays: number;
  createdAt: string;
  placedAt: string;
};

export type SupplierOrderDetailDTO = {
  id: string;
  orderNumber: string;
  supplierId: string;
  purchaseRequestId: string;
  purchaseRequestSelectionId: string;
  cafe: {
    id: string;
    businessName: string;
  };
  status: OrderStatus;
  items: OrderItemSnapshotDTO[];
  financials: OrderFinancialSummaryDTO;
  delivery: OrderDeliveryDTO;
  timeline: OrderTimelineDTO;
  cancellation?: {
    cancelledAt: string;
    cancelReason?: string | null;
  } | null;
  rejection?: {
    rejectedAt: string;
    rejectReason?: string | null;
  } | null;
  allowedActions: SupplierOrderAllowedActionsDTO;
  createdAt: string;
  updatedAt: string;
};

export type SupplierOrderListResult = {
  items: SupplierOrderListItemDTO[];
  total: number;
};

// ---------------------------------------------------------------------------
// 5. Order Creation Result DTO
// ---------------------------------------------------------------------------

export type CreatedOrderSummaryDTO = {
  orderId: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  itemCount: number;
  totalAmount: number;
  deliveryDays: number;
  status: OrderStatus;
};

export type CreateOrdersFromSelectionResultDTO = {
  purchaseRequestId: string;
  purchaseRequestSelectionId: string;
  orderCount: number;
  orders: CreatedOrderSummaryDTO[];
};

// ---------------------------------------------------------------------------
// 6. Domain Reference Number Generator
// Format: ORD-YYMM-XXXXX (e.g. ORD-2610-K8P9W)
// ---------------------------------------------------------------------------

const REFERENCE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateOrderNumber(): string {
  const now = new Date();
  const year = (now.getFullYear() % 100).toString().padStart(2, "0");
  const month = (now.getMonth() + 1).toString().padStart(2, "0");

  const randomBytes = crypto.randomBytes(5);
  let code = "";
  for (let i = 0; i < 5; i++) {
    const index = randomBytes[i] % REFERENCE_CHARS.length;
    code += REFERENCE_CHARS[index];
  }

  return `ORD-${year}${month}-${code}`;
}

// ---------------------------------------------------------------------------
// 7. Status Lifecycle Transition Guard
// Centralized pure domain rules:
// - Cafe: can only cancel when 'placed' (placed -> cancelled)
// - Supplier:
//     placed -> confirmed
//     placed -> rejected
//     confirmed -> preparing
//     preparing -> shipped
//     shipped -> delivered
// - Terminal states: cancelled, rejected, delivered
// ---------------------------------------------------------------------------

export function canTransitionOrderStatus(
  current: OrderStatus,
  target: OrderStatus,
  actor: "cafe" | "supplier",
): boolean {
  if (current === target) return true;

  if (actor === "cafe") {
    if (current === "placed" && target === "cancelled") return true;
    return false;
  }

  if (actor === "supplier") {
    switch (current) {
      case "placed":
        return target === "confirmed" || target === "rejected";
      case "confirmed":
        return target === "preparing";
      case "preparing":
        return target === "shipped";
      case "shipped":
        return target === "delivered";
      default:
        return false;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// 8. Allowed Actions Calculation Helpers
// ---------------------------------------------------------------------------

export function getCafeOrderAllowedActions(
  status: OrderStatus,
): CafeOrderAllowedActionsDTO {
  return {
    canCancel: status === "placed",
  };
}

export function getSupplierOrderAllowedActions(
  status: OrderStatus,
): SupplierOrderAllowedActionsDTO {
  return {
    canConfirm: status === "placed",
    canReject: status === "placed",
    canMarkPreparing: status === "confirmed",
    canMarkShipped: status === "preparing",
    canMarkDelivered: status === "shipped",
  };
}

// ---------------------------------------------------------------------------
// 9. Pure Calculation & Safe Integer Helper
// ---------------------------------------------------------------------------

export class OrderCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderCalculationError";
  }
}

export function calculateOrderTotals(
  items: Array<{ quantity: number; unitPrice: number }>,
  shippingCost: number,
): { itemsSubtotal: number; shippingCost: number; totalAmount: number } {
  if (
    typeof shippingCost !== "number" ||
    !Number.isInteger(shippingCost) ||
    shippingCost < 0 ||
    !Number.isSafeInteger(shippingCost)
  ) {
    throw new OrderCalculationError("هزینه ارسال سفارش نامعتبر است");
  }

  let itemsSubtotal = 0;

  for (const item of items) {
    if (
      typeof item.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isSafeInteger(item.quantity)
    ) {
      throw new OrderCalculationError("تعداد قلم سفارش نامعتبر است");
    }

    if (
      typeof item.unitPrice !== "number" ||
      !Number.isInteger(item.unitPrice) ||
      item.unitPrice <= 0 ||
      !Number.isSafeInteger(item.unitPrice)
    ) {
      throw new OrderCalculationError("قیمت واحد قلم سفارش نامعتبر است");
    }

    const subtotal = item.quantity * item.unitPrice;
    if (!Number.isSafeInteger(subtotal) || subtotal > Number.MAX_SAFE_INTEGER) {
      throw new OrderCalculationError("مبلغ قلم سفارش خارج از محدوده مجاز محاسبات سیستم است");
    }

    itemsSubtotal += subtotal;
    if (
      !Number.isSafeInteger(itemsSubtotal) ||
      itemsSubtotal > Number.MAX_SAFE_INTEGER
    ) {
      throw new OrderCalculationError("مجموع اقلام سفارش خارج از محدوده مجاز محاسبات سیستم است");
    }
  }

  const totalAmount = itemsSubtotal + shippingCost;
  if (!Number.isSafeInteger(totalAmount) || totalAmount > Number.MAX_SAFE_INTEGER) {
    throw new OrderCalculationError("مبلغ کل سفارش خارج از محدوده مجاز محاسبات سیستم است");
  }

  return {
    itemsSubtotal,
    shippingCost,
    totalAmount,
  };
}
