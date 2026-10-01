import type { PurchaseRequestStatus } from "@/model/purchase-request";

// ---------------------------------------------------------------------------
// 1. Comparison DTOs (for Cafe RFQ Comparison Workspace)
// ---------------------------------------------------------------------------

export type PurchaseRequestComparisonResponseOptionDTO = {
  supplierId: string;
  supplierName: string;
  supplierRequestId: string;
  supplierResponseId: string;
  status: "quoted" | "unavailable";
  unitPrice?: number;
  confirmedQuantity: number;
  itemSubtotal: number;
  deliveryDays: number;
  shippingCost: number;
  respondedAt: string;
  isSelectable: boolean;
  isModifiedAfterSelection?: boolean;
};

export type PurchaseRequestComparisonItemDTO = {
  purchaseRequestItemId: string;
  itemType: "catalog" | "custom";
  title: string;
  unit: string;
  requestedQuantity: number;
  selectedQuantity: number;
  remainingQuantity: number;
  lowestUnitPrice?: number;
  responses: PurchaseRequestComparisonResponseOptionDTO[];
};

export type PurchaseRequestComparisonDTO = {
  purchaseRequestId: string;
  referenceNumber: string;
  cafeId: string;
  rfqStatus: PurchaseRequestStatus;
  neededByDate?: string;
  totalRfqItems: number;
  items: PurchaseRequestComparisonItemDTO[];
  currentSelection: PurchaseRequestSelectionDTO | null;
};

// ---------------------------------------------------------------------------
// 2. Selection DTOs (for Cafe Selected Offers / Future Cart & Order)
// ---------------------------------------------------------------------------

export type PurchaseRequestSelectionItemSelectionDTO = {
  supplierId: string;
  supplierName: string;
  supplierRequestId: string;
  supplierResponseId: string;
  selectedQuantity: number;
  unitPrice: number;
  itemSubtotal: number;
  responseModifiedAfterSelection: boolean;
};

export type PurchaseRequestSelectionItemDTO = {
  purchaseRequestItemId: string;
  itemType: "catalog" | "custom";
  title: string;
  unit: string;
  requestedQuantity: number;
  selectedQuantity: number;
  remainingQuantity: number;
  isFullySelected: boolean;
  selections: PurchaseRequestSelectionItemSelectionDTO[];
};

export type PurchaseRequestSelectionSupplierGroupDTO = {
  supplierId: string;
  supplierName: string;
  supplierResponseId: string;
  deliveryDays: number;
  shippingCost: number;
  itemsSubtotal: number;
  supplierTotal: number;
  responseModifiedAfterSelection: boolean;
};

export type PurchaseRequestSelectionTotalsDTO = {
  selectedItemCount: number;
  fullySelectedItemCount: number;
  partiallySelectedItemCount: number;
  unselectedItemCount: number;
  estimatedItemsTotal: number;
  shippingTotal: number;
  estimatedTotal: number;
};

export type PurchaseRequestSelectionDTO = {
  id: string;
  purchaseRequestId: string;
  cafeId: string;
  version: number;
  selectedByUserId: string;
  selectedByUserName?: string;
  items: PurchaseRequestSelectionItemDTO[];
  supplierGroups: PurchaseRequestSelectionSupplierGroupDTO[];
  totals: PurchaseRequestSelectionTotalsDTO;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// 3. Save Selection Action Result DTO
// ---------------------------------------------------------------------------

export type SavePurchaseRequestSelectionResultDTO = {
  selectionId: string;
  version: number;
  selectedItemCount: number;
  fullySelectedItemCount: number;
  partiallySelectedItemCount: number;
  unselectedItemCount: number;
  estimatedItemsTotal: number;
  shippingTotal: number;
  estimatedTotal: number;
};
