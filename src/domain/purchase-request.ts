import crypto from "crypto";

import type {
  PurchaseRequestItemType,
  PurchaseRequestStatus,
} from "@/model/purchase-request";

export const MAX_PURCHASE_REQUEST_ITEMS = 100;

export type { PurchaseRequestItemType, PurchaseRequestStatus };

export type PurchaseRequestProductSnapshot = {
  name: string;
  unit: string;
  brand?: string;
  categoryName?: string;
};

export type PurchaseRequestAllocationDTO = {
  shoppingListItemId: string;
  quantity: number;
};

export type PurchaseRequestItemDTO = {
  id: string;
  itemType: PurchaseRequestItemType;
  productId?: string;
  productSnapshot?: PurchaseRequestProductSnapshot;
  customTitle?: string;
  customUnit?: string;
  quantity: number;
  note?: string;
  allocations: PurchaseRequestAllocationDTO[];
};

export type PurchaseRequestDetailDTO = {
  id: string;
  referenceNumber: string;
  cafeId: string;
  createdByUserId: string;
  creatorName?: string;
  title?: string;
  note?: string;
  neededByDate?: string;
  status: PurchaseRequestStatus;
  items: PurchaseRequestItemDTO[];
  totalQuantity: number;
  itemCount: number;
  submittedAt?: string;
  cancelledAt?: string;
  cancelledByUserId?: string;
  cancellerName?: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseRequestListItemDTO = {
  id: string;
  referenceNumber: string;
  cafeId: string;
  createdByUserId: string;
  creatorName?: string;
  title?: string;
  status: PurchaseRequestStatus;
  itemCount: number;
  totalQuantity: number;
  neededByDate?: string;
  submittedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseRequestListResult = {
  items: PurchaseRequestListItemDTO[];
  total: number;
};

export type ShoppingListItemAvailabilityDTO = {
  id: string;
  itemType: PurchaseRequestItemType;
  productId?: string;
  productName?: string;
  productUnit?: string;
  customTitle?: string;
  customUnit?: string;
  totalQuantity: number;
  allocatedQuantity: number;
  availableQuantity: number;
};

export type ShoppingListAggregateAvailabilityDTO = {
  key: string;
  itemType: PurchaseRequestItemType;
  productId?: string;
  productName?: string;
  productUnit?: string;
  customTitle?: string;
  customUnit?: string;
  totalQuantity: number;
  allocatedQuantity: number;
  availableQuantity: number;
  itemCount: number;
};

export type ShoppingListAvailabilityDTO = {
  items: ShoppingListItemAvailabilityDTO[];
  aggregatedItems: ShoppingListAggregateAvailabilityDTO[];
};

// ---------------------------------------------------------------------------
// Human-readable, race-safe, non-guessable RFQ Reference Generator
// Example: RFQ-2610-K8P9W
// ---------------------------------------------------------------------------

const REFERENCE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generatePurchaseRequestReference(): string {
  const now = new Date();
  const year = (now.getFullYear() % 100).toString().padStart(2, "0");
  const month = (now.getMonth() + 1).toString().padStart(2, "0");

  const randomBytes = crypto.randomBytes(5);
  let code = "";
  for (let i = 0; i < 5; i++) {
    const index = randomBytes[i] % REFERENCE_CHARS.length;
    code += REFERENCE_CHARS[index];
  }

  return `RFQ-${year}${month}-${code}`;
}

// ---------------------------------------------------------------------------
// Status Workflow Transition Validator
// Allowed transitions:
//   draft -> submitted
//   draft -> cancelled
//   submitted -> cancelled
// All other transitions (submitted -> draft, cancelled -> anything) are forbidden.
// ---------------------------------------------------------------------------

export function canTransitionPurchaseRequestStatus(
  current: PurchaseRequestStatus,
  target: PurchaseRequestStatus,
): boolean {
  if (current === target) return true; // idempotent

  switch (current) {
    case "draft":
      return target === "submitted" || target === "cancelled";
    case "submitted":
      return target === "cancelled";
    case "cancelled":
      return false; // Terminal state
    default:
      return false;
  }
}
