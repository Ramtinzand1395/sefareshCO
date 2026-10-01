"use server";

import { revalidatePath } from "next/cache";

import type {
  ShoppingListDetailDTO,
  ShoppingListItemDTO,
} from "@/src/domain/shopping-list";
import {
  addCatalogItemToShoppingList,
  addCustomItemToShoppingList,
  getActiveShoppingList,
  InvalidCatalogProductError,
  InvalidTransferStateError,
  removeShoppingListItem,
  ShoppingListAuthError,
  ShoppingListItemNotFoundError,
  ShoppingListNotFoundError,
  ShoppingListPermissionError,
  ShoppingListValidationError,
  transferInternalPurchaseRequest,
  updateShoppingListItemQuantity,
} from "@/src/services/shopping-list-service";

export type ShoppingListActionState = {
  ok?: boolean;
  error?: string;
  item?: ShoppingListItemDTO;
  transferredCount?: number;
  skippedCount?: number;
};

const REVALIDATE_PATHS = [
  "/cafe/shopping-list",
  "/cafe/purchase-requests",
  "/cafe/internal-requests",
];

function revalidateShoppingListPaths() {
  for (const p of REVALIDATE_PATHS) {
    revalidatePath(p);
  }
}

function handleServiceError(error: unknown): ShoppingListActionState {
  if (error instanceof ShoppingListAuthError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof ShoppingListPermissionError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof ShoppingListNotFoundError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof ShoppingListItemNotFoundError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof InvalidCatalogProductError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof InvalidTransferStateError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof ShoppingListValidationError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof Error) {
    return { ok: false, error: error.message };
  }
  return {
    ok: false,
    error: "خطای غیرمنتظره در پردازش عملیات لیست خرید؛ لطفاً دوباره تلاش کنید",
  };
}

// ---------------------------------------------------------------------------
// 1. Get Active Shopping List Action
// ---------------------------------------------------------------------------

export async function getActiveShoppingListAction(): Promise<{
  ok: boolean;
  data?: ShoppingListDetailDTO;
  error?: string;
}> {
  try {
    const list = await getActiveShoppingList();
    return { ok: true, data: list };
  } catch (error) {
    const handled = handleServiceError(error);
    return { ok: false, error: handled.error };
  }
}

// ---------------------------------------------------------------------------
// 2. Add Catalog Item to Shopping List Action
// ---------------------------------------------------------------------------

export async function addCatalogItemToShoppingListAction(
  _prevState: ShoppingListActionState,
  payload: FormData | Record<string, unknown>,
): Promise<ShoppingListActionState> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      rawData = {
        itemType: "catalog",
        productId: payload.get("productId"),
        quantity: payload.get("quantity"),
        note: payload.get("note") || undefined,
      };
    } else {
      rawData = payload;
    }

    const item = await addCatalogItemToShoppingList(rawData);
    revalidateShoppingListPaths();
    return { ok: true, item };
  } catch (error) {
    return handleServiceError(error);
  }
}

// ---------------------------------------------------------------------------
// 3. Add Custom Item to Shopping List Action
// ---------------------------------------------------------------------------

export async function addCustomItemToShoppingListAction(
  _prevState: ShoppingListActionState,
  payload: FormData | Record<string, unknown>,
): Promise<ShoppingListActionState> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      rawData = {
        itemType: "custom",
        customTitle: payload.get("customTitle"),
        customUnit: payload.get("customUnit"),
        quantity: payload.get("quantity"),
        note: payload.get("note") || undefined,
      };
    } else {
      rawData = payload;
    }

    const item = await addCustomItemToShoppingList(rawData);
    revalidateShoppingListPaths();
    return { ok: true, item };
  } catch (error) {
    return handleServiceError(error);
  }
}

// ---------------------------------------------------------------------------
// 4. Update Shopping List Item Quantity Action
// ---------------------------------------------------------------------------

export async function updateShoppingListItemQuantityAction(
  _prevState: ShoppingListActionState,
  payload: FormData | Record<string, unknown>,
): Promise<ShoppingListActionState> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      rawData = {
        itemId: payload.get("itemId"),
        quantity: payload.get("quantity"),
      };
    } else {
      rawData = payload;
    }

    await updateShoppingListItemQuantity(rawData);
    revalidateShoppingListPaths();
    return { ok: true };
  } catch (error) {
    return handleServiceError(error);
  }
}

// ---------------------------------------------------------------------------
// 5. Remove Shopping List Item Action
// ---------------------------------------------------------------------------

export async function removeShoppingListItemAction(
  _prevState: ShoppingListActionState,
  payload: FormData | Record<string, unknown>,
): Promise<ShoppingListActionState> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      rawData = {
        itemId: payload.get("itemId"),
      };
    } else {
      rawData = payload;
    }

    await removeShoppingListItem(rawData);
    revalidateShoppingListPaths();
    return { ok: true };
  } catch (error) {
    return handleServiceError(error);
  }
}

// ---------------------------------------------------------------------------
// 6. Transfer Approved Internal Purchase Request Action
// ---------------------------------------------------------------------------

export async function transferInternalPurchaseRequestToShoppingListAction(
  _prevState: ShoppingListActionState,
  payload: FormData | Record<string, unknown>,
): Promise<ShoppingListActionState> {
  try {
    let rawData: unknown;

    if (payload instanceof FormData) {
      rawData = {
        requestId: payload.get("requestId"),
      };
    } else {
      rawData = payload;
    }

    const result = await transferInternalPurchaseRequest(rawData);
    revalidateShoppingListPaths();
    return {
      ok: true,
      transferredCount: result.transferredCount,
      skippedCount: result.skippedCount,
    };
  } catch (error) {
    return handleServiceError(error);
  }
}
