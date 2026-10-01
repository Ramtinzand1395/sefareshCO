import "server-only";

import { Types } from "mongoose";

import { InternalPurchaseRequest } from "@/model/internal-purchase-request";
import { Product } from "@/model/product";
import {
  canManageShoppingList,
  canViewShoppingList,
} from "@/src/domain/cafe-access";
import {
  addCatalogItemSchema,
  addCustomItemSchema,
  removeShoppingListItemSchema,
  transferInternalPurchaseRequestSchema,
  updateShoppingListItemQuantitySchema,
  type AddCatalogItemInput,
  type AddCustomItemInput,
  type RemoveShoppingListItemInput,
  type TransferInternalPurchaseRequestInput,
  type UpdateShoppingListItemQuantityInput,
} from "@/src/domain/schemas/shopping-list";
import type {
  ShoppingListDetailDTO,
  ShoppingListItemDTO,
} from "@/src/domain/shopping-list";
import { getCurrentCafeIdentity } from "@/src/lib/auth-helpers";
import {
  addCatalogItemToActiveShoppingList as repoAddCatalogItem,
  addCustomItemToActiveShoppingList as repoAddCustomItem,
  atomicTransferIprItemsToActiveShoppingList as repoAtomicTransfer,
  getOrCreateActiveShoppingList as repoGetOrCreateActiveList,
  removeShoppingListItem as repoRemoveItem,
  updateShoppingListItemQuantity as repoUpdateQuantity,
} from "@/src/repositories/shopping-list-repository";

// ---------------------------------------------------------------------------
// Custom Domain Errors
// ---------------------------------------------------------------------------

export class ShoppingListAuthError extends Error {
  constructor(message = "دسترسی به اطلاعات کافه ممکن نیست؛ لطفاً وارد شوید") {
    super(message);
    this.name = "ShoppingListAuthError";
  }
}

export class ShoppingListPermissionError extends Error {
  constructor(message = "شما دسترسی لازم برای مدیریت لیست خرید را ندارید") {
    super(message);
    this.name = "ShoppingListPermissionError";
  }
}

export class ShoppingListNotFoundError extends Error {
  constructor(message = "درخواست خرید یا لیست خرید مورد نظر یافت نشد") {
    super(message);
    this.name = "ShoppingListNotFoundError";
  }
}

export class ShoppingListItemNotFoundError extends Error {
  constructor(message = "قلم مورد نظر در لیست خرید یافت نشد") {
    super(message);
    this.name = "ShoppingListItemNotFoundError";
  }
}

export class ShoppingListValidationError extends Error {
  constructor(message = "اطلاعات ورودی عملیات لیست خرید معتبر نیست") {
    super(message);
    this.name = "ShoppingListValidationError";
  }
}

export class InvalidCatalogProductError extends Error {
  constructor(message = "کالای انتخابی در کاتالوگ موجود یا فعال نیست") {
    super(message);
    this.name = "InvalidCatalogProductError";
  }
}

export class InvalidTransferStateError extends Error {
  constructor(
    message = "تنها درخواست‌های خرید تأییدشده یا تأیید جزئی‌شده قابل انتقال به لیست خرید هستند",
  ) {
    super(message);
    this.name = "InvalidTransferStateError";
  }
}

// ---------------------------------------------------------------------------
// Authentication Guard: resolves identity server-side from active session
// ---------------------------------------------------------------------------

export async function requireCafeMemberAccess() {
  const identity = await getCurrentCafeIdentity();
  if (!identity) {
    throw new ShoppingListAuthError();
  }
  return identity;
}

// ---------------------------------------------------------------------------
// 1. Get or Create Active Shopping List for Current Cafe
// ---------------------------------------------------------------------------

export async function getActiveShoppingList(): Promise<ShoppingListDetailDTO> {
  const identity = await requireCafeMemberAccess();

  if (!canViewShoppingList(identity)) {
    throw new ShoppingListPermissionError(
      "شما دسترسی لازم برای مشاهده لیست خرید کافه را ندارید",
    );
  }

  return repoGetOrCreateActiveList(identity.cafeId);
}

// ---------------------------------------------------------------------------
// 2. Add Direct Catalog Item to Active Shopping List
// ---------------------------------------------------------------------------

export async function addCatalogItemToShoppingList(
  rawInput: unknown,
): Promise<ShoppingListItemDTO> {
  const identity = await requireCafeMemberAccess();

  if (!canManageShoppingList(identity)) {
    throw new ShoppingListPermissionError(
      "شما دسترسی لازم برای افزودن کالا به لیست خرید را ندارید",
    );
  }

  const parsed = addCatalogItemSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    throw new ShoppingListValidationError(firstIssue || "داده‌های ورودی نامعتبر است");
  }

  const input: AddCatalogItemInput = parsed.data;

  // Validate that the product exists and is active in the catalog
  const product = await Product.findOne({
    _id: new Types.ObjectId(input.productId),
    status: "active",
    deletedAt: null,
  })
    .select("_id")
    .lean();

  if (!product) {
    throw new InvalidCatalogProductError();
  }

  return repoAddCatalogItem({
    cafeId: identity.cafeId,
    productId: input.productId,
    quantity: input.quantity,
    note: input.note,
  });
}

// ---------------------------------------------------------------------------
// 3. Add Direct Custom Item to Active Shopping List
// ---------------------------------------------------------------------------

export async function addCustomItemToShoppingList(
  rawInput: unknown,
): Promise<ShoppingListItemDTO> {
  const identity = await requireCafeMemberAccess();

  if (!canManageShoppingList(identity)) {
    throw new ShoppingListPermissionError(
      "شما دسترسی لازم برای افزودن قلم به لیست خرید را ندارید",
    );
  }

  const parsed = addCustomItemSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    throw new ShoppingListValidationError(firstIssue || "داده‌های ورودی نامعتبر است");
  }

  const input: AddCustomItemInput = parsed.data;

  return repoAddCustomItem({
    cafeId: identity.cafeId,
    customTitle: input.customTitle,
    customUnit: input.customUnit,
    quantity: input.quantity,
    note: input.note,
  });
}

// ---------------------------------------------------------------------------
// 4. Update Shopping List Item Quantity
// ---------------------------------------------------------------------------

export async function updateShoppingListItemQuantity(
  rawInput: unknown,
): Promise<{ ok: boolean }> {
  const identity = await requireCafeMemberAccess();

  if (!canManageShoppingList(identity)) {
    throw new ShoppingListPermissionError(
      "شما دسترسی لازم برای ویرایش تعداد در لیست خرید را ندارید",
    );
  }

  const parsed = updateShoppingListItemQuantitySchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    throw new ShoppingListValidationError(firstIssue || "داده‌های ورودی نامعتبر است");
  }

  const input: UpdateShoppingListItemQuantityInput = parsed.data;

  const success = await repoUpdateQuantity({
    cafeId: identity.cafeId,
    itemId: input.itemId,
    quantity: input.quantity,
  });

  if (!success) {
    throw new ShoppingListItemNotFoundError();
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// 5. Remove Shopping List Item
// ---------------------------------------------------------------------------

export async function removeShoppingListItem(
  rawInput: unknown,
): Promise<{ ok: boolean }> {
  const identity = await requireCafeMemberAccess();

  if (!canManageShoppingList(identity)) {
    throw new ShoppingListPermissionError(
      "شما دسترسی لازم برای حذف قلم از لیست خرید را ندارید",
    );
  }

  const parsed = removeShoppingListItemSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    throw new ShoppingListValidationError(firstIssue || "داده‌های ورودی نامعتبر است");
  }

  const input: RemoveShoppingListItemInput = parsed.data;

  const success = await repoRemoveItem({
    cafeId: identity.cafeId,
    itemId: input.itemId,
  });

  if (!success) {
    throw new ShoppingListItemNotFoundError();
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// 6. Transfer Approved Internal Purchase Request to Active Shopping List
// Strictly idempotent and tenant-isolated.
// Only approved/partially_approved requests are accepted.
// Only approvedQuantity > 0 items are transferred.
// ---------------------------------------------------------------------------

export async function transferInternalPurchaseRequest(
  rawInput: unknown,
): Promise<{
  ok: boolean;
  transferredCount: number;
  skippedCount: number;
}> {
  const identity = await requireCafeMemberAccess();

  if (!canManageShoppingList(identity)) {
    throw new ShoppingListPermissionError(
      "شما دسترسی لازم برای انتقال اقلام به لیست خرید را ندارید",
    );
  }

  const parsed = transferInternalPurchaseRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    throw new ShoppingListValidationError(firstIssue || "داده‌های ورودی نامعتبر است");
  }

  const input: TransferInternalPurchaseRequestInput = parsed.data;

  // Strict tenant-isolated lookup of Internal Purchase Request
  const ipr = (await InternalPurchaseRequest.findOne({
    _id: new Types.ObjectId(input.requestId),
    cafeId: new Types.ObjectId(identity.cafeId),
  }).lean()) as {
    _id: Types.ObjectId;
    status: string;
    items: Array<{
      _id: Types.ObjectId;
      itemType: "catalog" | "custom";
      productId?: Types.ObjectId | null;
      customTitle?: string | null;
      customUnit?: string | null;
      approvedQuantity: number;
      note?: string | null;
    }>;
  } | null;

  if (!ipr) {
    throw new ShoppingListNotFoundError(
      "درخواست خرید داخلی مورد نظر در این کافه یافت نشد",
    );
  }

  // Only approved or partially_approved requests can be transferred
  if (ipr.status !== "approved" && ipr.status !== "partially_approved") {
    throw new InvalidTransferStateError(
      `امکان انتقال درخواست با وضعیت "${ipr.status}" وجود ندارد؛ فقط درخواست‌های تأییدشده یا تأیید جزئی‌شده قابل انتقال هستند`,
    );
  }

  // Filter items where approvedQuantity > 0
  const eligibleItems = (ipr.items || []).filter(
    (item) => item.approvedQuantity > 0,
  );

  if (eligibleItems.length === 0) {
    throw new InvalidTransferStateError(
      "هیچ قلم تأییدشده‌ای با تعداد بیشتر از صفر در این درخواست وجود ندارد",
    );
  }

  const result = await repoAtomicTransfer({
    cafeId: identity.cafeId,
    requestId: ipr._id.toString(),
    itemsToTransfer: eligibleItems.map((item) => ({
      iprItemId: item._id.toString(),
      itemType: item.itemType,
      productId: item.productId?.toString(),
      customTitle: item.customTitle || undefined,
      customUnit: item.customUnit || undefined,
      approvedQuantity: item.approvedQuantity,
      note: item.note || undefined,
    })),
  });

  return {
    ok: true,
    transferredCount: result.transferredCount,
    skippedCount: result.skippedCount,
  };
}
