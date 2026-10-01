import { Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { Product } from "@/model/product";
import {
  ShoppingList,
  type ShoppingListItemType,
  type ShoppingListSourceType,
} from "@/model/shopping-list";
import {
  aggregateShoppingListItems,
  MAX_SHOPPING_LIST_ITEMS,
  type ShoppingListDetailDTO,
  type ShoppingListItemDTO,
} from "@/src/domain/shopping-list";

// ---------------------------------------------------------------------------
// Internal Lean Types
// ---------------------------------------------------------------------------

type ShoppingListItemLean = {
  _id: { toString(): string };
  itemType: ShoppingListItemType;
  productId?: { toString(): string } | null;
  customTitle?: string | null;
  customUnit?: string | null;
  quantity: number;
  sourceType: ShoppingListSourceType;
  sourceQuantity: number;
  internalPurchaseRequestId?: { toString(): string } | null;
  internalPurchaseRequestItemId?: { toString(): string } | null;
  note?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

type ShoppingListLean = {
  _id: { toString(): string };
  cafeId: { toString(): string };
  status: "active" | "archived";
  items: ShoppingListItemLean[];
  createdAt?: Date;
  updatedAt?: Date;
};

// ---------------------------------------------------------------------------
// Helper: Batch load product metadata (name + unit)
// ---------------------------------------------------------------------------

async function batchLoadProducts(
  productIds: string[],
): Promise<Map<string, { name: string; unit: string }>> {
  const map = new Map<string, { name: string; unit: string }>();
  const validIds = productIds
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  if (validIds.length === 0) return map;

  const products = (await Product.find({ _id: { $in: validIds } })
    .select("name unit")
    .lean()) as Array<{
    _id: { toString(): string };
    name?: string;
    unit?: string;
  }>;

  for (const p of products) {
    map.set(p._id.toString(), {
      name: p.name || "",
      unit: p.unit || "",
    });
  }

  return map;
}

// ---------------------------------------------------------------------------
// Helper: Transform Lean ShoppingList into Serializable ShoppingListDetailDTO
// ---------------------------------------------------------------------------

async function mapLeanToDTO(
  doc: ShoppingListLean,
): Promise<ShoppingListDetailDTO> {
  const catalogProductIds: string[] = [];
  for (const item of doc.items || []) {
    if (item.itemType === "catalog" && item.productId) {
      catalogProductIds.push(item.productId.toString());
    }
  }

  const productMap = await batchLoadProducts(catalogProductIds);

  const rawItems = doc.items || [];

  // Deterministic sort: chronological creation, then _id
  const sortedRawItems = [...rawItems].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeA !== timeB) return timeA - timeB;
    return a._id.toString().localeCompare(b._id.toString());
  });

  const itemsDTO: ShoppingListItemDTO[] = sortedRawItems.map((item) => {
    const dto: ShoppingListItemDTO = {
      id: item._id.toString(),
      itemType: item.itemType,
      quantity: item.quantity,
      sourceType: item.sourceType,
      sourceQuantity: item.sourceQuantity,
      note: item.note || undefined,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : "",
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : "",
    };

    if (item.itemType === "catalog" && item.productId) {
      const pid = item.productId.toString();
      dto.productId = pid;
      const productInfo = productMap.get(pid);
      if (productInfo) {
        dto.productName = productInfo.name;
        dto.productUnit = productInfo.unit;
      }
    } else {
      dto.customTitle = item.customTitle || undefined;
      dto.customUnit = item.customUnit || undefined;
    }

    if (item.internalPurchaseRequestId) {
      dto.internalPurchaseRequestId = item.internalPurchaseRequestId.toString();
    }
    if (item.internalPurchaseRequestItemId) {
      dto.internalPurchaseRequestItemId =
        item.internalPurchaseRequestItemId.toString();
    }

    return dto;
  });

  const totalQuantity = itemsDTO.reduce((sum, i) => sum + i.quantity, 0);
  const aggregatedItems = aggregateShoppingListItems(itemsDTO);

  return {
    id: doc._id.toString(),
    cafeId: doc.cafeId.toString(),
    status: doc.status,
    itemCount: itemsDTO.length,
    totalQuantity,
    items: itemsDTO,
    aggregatedItems,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : "",
  };
}

// ---------------------------------------------------------------------------
// 1. Get or Create Active Shopping List for Cafe
// Concurrency safe: Uses findOneAndUpdate with upsert + unique partial index fallback.
// ---------------------------------------------------------------------------

export async function getOrCreateActiveShoppingList(
  cafeId: string,
): Promise<ShoppingListDetailDTO> {
  if (!Types.ObjectId.isValid(cafeId)) {
    throw new Error("شناسه کافه نامعتبر است");
  }

  await dbConnect();
  const cafeObjId = new Types.ObjectId(cafeId);

  // 1. Check if active list already exists
  let doc = (await ShoppingList.findOne({
    cafeId: cafeObjId,
    status: "active",
  }).lean()) as ShoppingListLean | null;

  if (doc) {
    return mapLeanToDTO(doc);
  }

  // 2. Try upsert with concurrency protection
  try {
    doc = (await ShoppingList.findOneAndUpdate(
      { cafeId: cafeObjId, status: "active" },
      {
        $setOnInsert: {
          cafeId: cafeObjId,
          status: "active",
          items: [],
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    ).lean()) as ShoppingListLean | null;
  } catch (error: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any)?.code === 11000) {
      // Race condition winner created it first; fetch the winning active list
      doc = (await ShoppingList.findOne({
        cafeId: cafeObjId,
        status: "active",
      }).lean()) as ShoppingListLean | null;
    } else {
      throw error;
    }
  }

  if (!doc) {
    throw new Error("خطا در ایجاد یا دریافت لیست خرید فعال");
  }

  return mapLeanToDTO(doc);
}

// ---------------------------------------------------------------------------
// 2. Find Active Shopping List by Cafe (Read-only, returns null if none exists)
// ---------------------------------------------------------------------------

export async function findActiveShoppingListByCafe(
  cafeId: string,
): Promise<ShoppingListDetailDTO | null> {
  if (!Types.ObjectId.isValid(cafeId)) {
    return null;
  }

  await dbConnect();

  const doc = (await ShoppingList.findOne({
    cafeId: new Types.ObjectId(cafeId),
    status: "active",
  }).lean()) as ShoppingListLean | null;

  if (!doc) return null;

  return mapLeanToDTO(doc);
}

// ---------------------------------------------------------------------------
// 3. Add Catalog Item to Active Shopping List
// Atomic push with upper bound items limit enforcement.
// ---------------------------------------------------------------------------

export async function addCatalogItemToActiveShoppingList(params: {
  cafeId: string;
  productId: string;
  quantity: number;
  note?: string;
}): Promise<ShoppingListItemDTO> {
  if (
    !Types.ObjectId.isValid(params.cafeId) ||
    !Types.ObjectId.isValid(params.productId)
  ) {
    throw new Error("شناسه‌های ارسالی نامعتبر است");
  }

  await dbConnect();
  // Ensure active list exists
  await getOrCreateActiveShoppingList(params.cafeId);

  const itemId = new Types.ObjectId();
  const now = new Date();

  const newItem = {
    _id: itemId,
    itemType: "catalog" as const,
    productId: new Types.ObjectId(params.productId),
    customTitle: null,
    customUnit: null,
    quantity: params.quantity,
    sourceType: "direct" as const,
    sourceQuantity: params.quantity,
    internalPurchaseRequestId: null,
    internalPurchaseRequestItemId: null,
    note: params.note ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const updateResult = await ShoppingList.updateOne(
    {
      cafeId: new Types.ObjectId(params.cafeId),
      status: "active",
      $expr: { $lt: [{ $size: "$items" }, MAX_SHOPPING_LIST_ITEMS] },
    },
    {
      $push: { items: newItem },
    },
  );

  if (updateResult.modifiedCount === 0) {
    // Check if list was full
    const current = await ShoppingList.findOne({
      cafeId: new Types.ObjectId(params.cafeId),
      status: "active",
    }).select("items");

    if (current && current.items && current.items.length >= MAX_SHOPPING_LIST_ITEMS) {
      throw new Error(`حداکثر ${MAX_SHOPPING_LIST_ITEMS} قلم در لیست خرید مجاز است`);
    }

    throw new Error("افزودن قلم به لیست خرید ممکن نشد");
  }

  // Hydrate product metadata for response DTO
  const product = (await Product.findById(params.productId)
    .select("name unit")
    .lean()) as { name?: string; unit?: string } | null;

  return {
    id: itemId.toString(),
    itemType: "catalog",
    productId: params.productId,
    productName: product?.name || "",
    productUnit: product?.unit || "",
    quantity: params.quantity,
    sourceType: "direct",
    sourceQuantity: params.quantity,
    note: params.note || undefined,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 4. Add Custom Item to Active Shopping List
// Atomic push with upper bound items limit enforcement.
// ---------------------------------------------------------------------------

export async function addCustomItemToActiveShoppingList(params: {
  cafeId: string;
  customTitle: string;
  customUnit: string;
  quantity: number;
  note?: string;
}): Promise<ShoppingListItemDTO> {
  if (!Types.ObjectId.isValid(params.cafeId)) {
    throw new Error("شناسه کافه نامعتبر است");
  }

  await dbConnect();
  // Ensure active list exists
  await getOrCreateActiveShoppingList(params.cafeId);

  const itemId = new Types.ObjectId();
  const now = new Date();

  const newItem = {
    _id: itemId,
    itemType: "custom" as const,
    productId: null,
    customTitle: params.customTitle.trim(),
    customUnit: params.customUnit.trim(),
    quantity: params.quantity,
    sourceType: "direct" as const,
    sourceQuantity: params.quantity,
    internalPurchaseRequestId: null,
    internalPurchaseRequestItemId: null,
    note: params.note ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const updateResult = await ShoppingList.updateOne(
    {
      cafeId: new Types.ObjectId(params.cafeId),
      status: "active",
      $expr: { $lt: [{ $size: "$items" }, MAX_SHOPPING_LIST_ITEMS] },
    },
    {
      $push: { items: newItem },
    },
  );

  if (updateResult.modifiedCount === 0) {
    const current = await ShoppingList.findOne({
      cafeId: new Types.ObjectId(params.cafeId),
      status: "active",
    }).select("items");

    if (current && current.items && current.items.length >= MAX_SHOPPING_LIST_ITEMS) {
      throw new Error(`حداکثر ${MAX_SHOPPING_LIST_ITEMS} قلم در لیست خرید مجاز است`);
    }

    throw new Error("افزودن قلم به لیست خرید ممکن نشد");
  }

  return {
    id: itemId.toString(),
    itemType: "custom",
    customTitle: params.customTitle.trim(),
    customUnit: params.customUnit.trim(),
    quantity: params.quantity,
    sourceType: "direct",
    sourceQuantity: params.quantity,
    note: params.note || undefined,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 5. Update Shopping List Item Quantity
// Atomic update targeting items.$.quantity while keeping sourceQuantity intact.
// ---------------------------------------------------------------------------

export async function updateShoppingListItemQuantity(params: {
  cafeId: string;
  itemId: string;
  quantity: number;
}): Promise<boolean> {
  if (
    !Types.ObjectId.isValid(params.cafeId) ||
    !Types.ObjectId.isValid(params.itemId)
  ) {
    return false;
  }

  await dbConnect();

  const result = await ShoppingList.updateOne(
    {
      cafeId: new Types.ObjectId(params.cafeId),
      status: "active",
      "items._id": new Types.ObjectId(params.itemId),
    },
    {
      $set: {
        "items.$.quantity": params.quantity,
        "items.$.updatedAt": new Date(),
      },
    },
  );

  return result.modifiedCount > 0;
}

// ---------------------------------------------------------------------------
// 6. Remove Shopping List Item
// Atomic pull targeting items._id.
// ---------------------------------------------------------------------------

export async function removeShoppingListItem(params: {
  cafeId: string;
  itemId: string;
}): Promise<boolean> {
  if (
    !Types.ObjectId.isValid(params.cafeId) ||
    !Types.ObjectId.isValid(params.itemId)
  ) {
    return false;
  }

  await dbConnect();

  const result = await ShoppingList.updateOne(
    {
      cafeId: new Types.ObjectId(params.cafeId),
      status: "active",
      "items._id": new Types.ObjectId(params.itemId),
    },
    {
      $pull: {
        items: { _id: new Types.ObjectId(params.itemId) },
      },
    },
  );

  return result.modifiedCount > 0;
}

// ---------------------------------------------------------------------------
// 7. Atomic Transfer Approved IPR Items to Active Shopping List
// Strictly idempotent:
// For each item, uses condition:
//   "items.internalPurchaseRequestItemId": { $ne: iprItemId }
// to ensure no duplicate provenance is ever created, even across concurrent transfers.
// ---------------------------------------------------------------------------

export async function atomicTransferIprItemsToActiveShoppingList(params: {
  cafeId: string;
  requestId: string;
  itemsToTransfer: Array<{
    iprItemId: string;
    itemType: "catalog" | "custom";
    productId?: string;
    customTitle?: string;
    customUnit?: string;
    approvedQuantity: number;
    note?: string;
  }>;
}): Promise<{ transferredCount: number; skippedCount: number }> {
  if (
    !Types.ObjectId.isValid(params.cafeId) ||
    !Types.ObjectId.isValid(params.requestId)
  ) {
    throw new Error("شناسه‌های ارسالی برای انتقال نامعتبر است");
  }

  await dbConnect();
  // Ensure active shopping list exists
  const activeList = await getOrCreateActiveShoppingList(params.cafeId);
  const activeListId = new Types.ObjectId(activeList.id);

  let transferredCount = 0;
  let skippedCount = 0;

  for (const item of params.itemsToTransfer) {
    if (!Types.ObjectId.isValid(item.iprItemId)) {
      skippedCount++;
      continue;
    }

    const iprItemObjId = new Types.ObjectId(item.iprItemId);
    const now = new Date();

    const newItem = {
      _id: new Types.ObjectId(),
      itemType: item.itemType,
      productId:
        item.itemType === "catalog" && item.productId
          ? new Types.ObjectId(item.productId)
          : null,
      customTitle: item.itemType === "custom" ? item.customTitle ?? null : null,
      customUnit: item.itemType === "custom" ? item.customUnit ?? null : null,
      quantity: item.approvedQuantity,
      sourceType: "internal_request" as const,
      sourceQuantity: item.approvedQuantity,
      internalPurchaseRequestId: new Types.ObjectId(params.requestId),
      internalPurchaseRequestItemId: iprItemObjId,
      note: item.note ?? null,
      createdAt: now,
      updatedAt: now,
    };

    // Atomic insert with duplicate provenance prevention and items count ceiling
    const updateResult = await ShoppingList.updateOne(
      {
        _id: activeListId,
        cafeId: new Types.ObjectId(params.cafeId),
        status: "active",
        "items.internalPurchaseRequestItemId": { $ne: iprItemObjId },
        $expr: { $lt: [{ $size: "$items" }, MAX_SHOPPING_LIST_ITEMS] },
      },
      {
        $push: { items: newItem },
      },
    );

    if (updateResult.modifiedCount > 0) {
      transferredCount++;
    } else {
      skippedCount++;
    }
  }

  return { transferredCount, skippedCount };
}
