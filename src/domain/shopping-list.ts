import type {
  ShoppingListItemType,
  ShoppingListSourceType,
  ShoppingListStatus,
} from "@/model/shopping-list";

export const MAX_SHOPPING_LIST_ITEMS = 100;

export type ShoppingListItemDTO = {
  id: string;
  itemType: ShoppingListItemType;
  productId?: string;
  productName?: string;
  productUnit?: string;
  customTitle?: string;
  customUnit?: string;
  quantity: number;
  sourceType: ShoppingListSourceType;
  sourceQuantity: number;
  internalPurchaseRequestId?: string;
  internalPurchaseRequestItemId?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type AggregatedShoppingListItemDTO = {
  key: string;
  itemType: ShoppingListItemType;
  productId?: string;
  productName?: string;
  productUnit?: string;
  customTitle?: string;
  customUnit?: string;
  totalQuantity: number;
  totalSourceQuantity: number;
  itemCount: number;
  items: ShoppingListItemDTO[];
};

export type ShoppingListDetailDTO = {
  id: string;
  cafeId: string;
  status: ShoppingListStatus;
  itemCount: number;
  totalQuantity: number;
  items: ShoppingListItemDTO[];
  aggregatedItems: AggregatedShoppingListItemDTO[];
  createdAt: string;
  updatedAt: string;
};

/**
 * Aggregates shopping list items by unique product (for catalog items)
 * or by normalized customTitle + customUnit (for custom items).
 * Preserves full provenance under `items` while computing totals for clean UI presentation.
 */
export function aggregateShoppingListItems(
  items: ShoppingListItemDTO[],
): AggregatedShoppingListItemDTO[] {
  const map = new Map<string, AggregatedShoppingListItemDTO>();

  for (const item of items) {
    let key: string;
    if (item.itemType === "catalog" && item.productId) {
      key = `catalog:${item.productId}`;
    } else {
      const normTitle = (item.customTitle || "").trim().toLowerCase();
      const normUnit = (item.customUnit || "").trim().toLowerCase();
      key = `custom:${normTitle}:::${normUnit}`;
    }

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        itemType: item.itemType,
        productId: item.productId,
        productName: item.productName,
        productUnit: item.productUnit,
        customTitle: item.customTitle,
        customUnit: item.customUnit,
        totalQuantity: item.quantity,
        totalSourceQuantity: item.sourceQuantity,
        itemCount: 1,
        items: [item],
      });
    } else {
      existing.totalQuantity += item.quantity;
      existing.totalSourceQuantity += item.sourceQuantity;
      existing.itemCount += 1;
      existing.items.push(item);
    }
  }

  // Deterministic sort: catalog items first (by name or productId), then custom items
  return Array.from(map.values()).sort((a, b) => {
    if (a.itemType !== b.itemType) {
      return a.itemType === "catalog" ? -1 : 1;
    }
    const nameA = a.productName || a.customTitle || "";
    const nameB = b.productName || b.customTitle || "";
    return nameA.localeCompare(nameB, "fa");
  });
}
