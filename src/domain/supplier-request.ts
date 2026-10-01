import type {
  SupplierRequestStatus,
} from "@/model/supplier-request";

export type { SupplierRequestStatus };

export type SupplierRequestProductSnapshot = {
  name: string;
  unit: string;
  brand?: string;
  categoryName?: string;
};

// ---------------------------------------------------------------------------
// Supplier-Facing Item DTO: strictly isolated data boundary
// Contains NO internal cafe IDs, NO creator user IDs, NO shopping list provenance
// ---------------------------------------------------------------------------

export type SupplierRequestSupplierItemDTO = {
  purchaseRequestItemId: string;
  productId: string;
  name: string;
  unit: string;
  brand?: string;
  categoryName?: string;
  quantity: number;
  note?: string;
};

// ---------------------------------------------------------------------------
// Supplier-Facing Request DTO for Supplier Inbox & Details
// ---------------------------------------------------------------------------

export type SupplierRequestSupplierViewDTO = {
  id: string;
  referenceNumber: string;
  status: SupplierRequestStatus;
  neededByDate?: string;
  itemCount: number;
  items: SupplierRequestSupplierItemDTO[];
  createdAt: string;
  sentAt?: string;
  cancelledAt?: string;
};

// ---------------------------------------------------------------------------
// Cafe-Facing Request Item DTO for RFQ matching inspection
// ---------------------------------------------------------------------------

export type SupplierRequestCafeItemDTO = {
  purchaseRequestItemId: string;
  productId: string;
  name: string;
  unit: string;
  quantity: number;
};

// ---------------------------------------------------------------------------
// Cafe-Facing Request DTO for RFQ detail view
// ---------------------------------------------------------------------------

export type SupplierRequestCafeViewDTO = {
  id: string;
  supplierId: string;
  supplierName: string;
  status: SupplierRequestStatus;
  itemCount: number;
  items: SupplierRequestCafeItemDTO[];
  createdAt: string;
  sentAt?: string;
  cancelledAt?: string;
};

// ---------------------------------------------------------------------------
// Unmatched Item Reason & DTO
// ---------------------------------------------------------------------------

export type UnmatchedItemReason =
  | "custom_item"
  | "no_active_offer"
  | "insufficient_stock"
  | "below_moq"
  | "no_verified_supplier";

export type SupplierMatchingUnmatchedItemDTO = {
  purchaseRequestItemId: string;
  itemType: "catalog" | "custom";
  productId?: string;
  title: string;
  quantity: number;
  reason: UnmatchedItemReason;
};

// ---------------------------------------------------------------------------
// Structured Matching Service Result
// ---------------------------------------------------------------------------

export type SupplierMatchingResultDTO = {
  purchaseRequestId: string;
  catalogItemCount: number;
  customItemCount: number;
  matchedItemCount: number;
  unmatchedItemCount: number;
  eligibleSupplierCount: number;
  supplierRequestsCreated: number;
  supplierRequestsSkipped: number;
  unmatchedItems: SupplierMatchingUnmatchedItemDTO[];
};
