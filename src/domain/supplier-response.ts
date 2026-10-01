import type {
  SupplierResponseItemStatus,
} from "@/model/supplier-response";
import type { SupplierRequestStatus } from "@/model/supplier-request";

export type { SupplierResponseItemStatus };

// ---------------------------------------------------------------------------
// Cafe-Facing Response Item DTO for RFQ comparison
// Sanitized: NO supplier personal phone, NO bank info, NO national ID,
// NO internal cafe provenance / shopping list data
// ---------------------------------------------------------------------------

export type SupplierResponseCafeItemDTO = {
  purchaseRequestItemId: string;
  productId: string;
  name: string;
  unit: string;
  status: SupplierResponseItemStatus;
  unitPrice?: number;
  confirmedQuantity: number;
  itemSubtotal: number;
  note?: string;
};

// ---------------------------------------------------------------------------
// Cafe-Facing Response DTO for RFQ detail & future comparison
// ---------------------------------------------------------------------------

export type SupplierResponseCafeViewDTO = {
  id: string;
  supplierRequestId: string;
  supplierId: string;
  supplierName: string;
  status: SupplierRequestStatus;
  itemCount: number;
  items: SupplierResponseCafeItemDTO[];
  itemSubtotal: number;
  shippingCost: number;
  estimatedTotal: number;
  deliveryDays: number;
  respondedAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Supplier-Facing Item DTO: complete decision details for supplier review
// ---------------------------------------------------------------------------

export type SupplierResponseSupplierItemDTO = {
  purchaseRequestItemId: string;
  productId: string;
  name: string;
  unit: string;
  brand?: string;
  categoryName?: string;
  requestedQuantity: number;
  status: SupplierResponseItemStatus;
  unitPrice?: number;
  confirmedQuantity: number;
  itemSubtotal: number;
  note?: string;
};

// ---------------------------------------------------------------------------
// Supplier-Facing Response DTO: isolated view of own submitted quote
// ---------------------------------------------------------------------------

export type SupplierResponseSupplierViewDTO = {
  id: string;
  supplierRequestId: string;
  purchaseRequestId: string;
  referenceNumber: string;
  supplierId: string;
  itemCount: number;
  items: SupplierResponseSupplierItemDTO[];
  itemSubtotal: number;
  shippingCost: number;
  estimatedTotal: number;
  deliveryDays: number;
  note?: string;
  respondedAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Supplier-Facing Decline Result DTO
// ---------------------------------------------------------------------------

export type SupplierRequestDeclineResultDTO = {
  supplierRequestId: string;
  status: "declined";
  declinedAt: string;
  reason?: string;
};
