import { z } from "zod";

import {
  shoppingListItemTypeValues,
  shoppingListSourceTypeValues,
  shoppingListStatusValues,
  type ShoppingListItemType,
  type ShoppingListSourceType,
  type ShoppingListStatus,
} from "@/model/shopping-list";

export {
  shoppingListItemTypeValues,
  shoppingListSourceTypeValues,
  shoppingListStatusValues,
};
export type {
  ShoppingListItemType,
  ShoppingListSourceType,
  ShoppingListStatus,
};

const objectIdPattern = /^[a-f\d]{24}$/i;

export const shoppingListEntityIdSchema = z
  .string()
  .trim()
  .regex(objectIdPattern, "شناسه معتبر نیست");

export const safePositiveInteger = (fieldName: string, min = 1) =>
  z.coerce
    .number({ message: `${fieldName} باید عدد باشد` })
    .int(`${fieldName} باید عدد صحیح باشد`)
    .min(min, `${fieldName} باید حداقل ${min} باشد`)
    .max(Number.MAX_SAFE_INTEGER, `${fieldName} خارج از محدوده مجاز است`)
    .refine((n) => Number.isSafeInteger(n), {
      message: `${fieldName} باید عدد صحیح امن باشد`,
    });

const nullToUndef = (v: unknown) =>
  v === null || v === undefined || v === "" ? undefined : v;

// ---------------------------------------------------------------------------
// Add Catalog Item Schema
// ---------------------------------------------------------------------------

export const addCatalogItemSchema = z.object({
  itemType: z.literal("catalog").default("catalog"),
  productId: shoppingListEntityIdSchema,
  quantity: safePositiveInteger("تعداد", 1),
  note: z.preprocess(
    nullToUndef,
    z
      .string()
      .trim()
      .max(300, "طول یادداشت قلم نمی‌تواند بیش از ۳۰۰ کاراکتر باشد")
      .optional(),
  ),
  customTitle: z.undefined().optional(),
  customUnit: z.undefined().optional(),
});

export type AddCatalogItemInput = z.infer<typeof addCatalogItemSchema>;

// ---------------------------------------------------------------------------
// Add Custom Item Schema
// ---------------------------------------------------------------------------

export const addCustomItemSchema = z.object({
  itemType: z.literal("custom").default("custom"),
  customTitle: z
    .string()
    .trim()
    .min(1, "عنوان قلم سفارشی الزامی است")
    .max(150, "طول عنوان قلم نمی‌تواند بیش از ۱۵۰ کاراکتر باشد"),
  customUnit: z
    .string()
    .trim()
    .min(1, "واحد قلم سفارشی الزامی است")
    .max(50, "طول واحد قلم نمی‌تواند بیش از ۵۰ کاراکتر باشد"),
  quantity: safePositiveInteger("تعداد", 1),
  note: z.preprocess(
    nullToUndef,
    z
      .string()
      .trim()
      .max(300, "طول یادداشت قلم نمی‌تواند بیش از ۳۰۰ کاراکتر باشد")
      .optional(),
  ),
  productId: z.undefined().optional(),
});

export type AddCustomItemInput = z.infer<typeof addCustomItemSchema>;

// ---------------------------------------------------------------------------
// Unified Add Item Schema (discriminated by itemType)
// ---------------------------------------------------------------------------

export const addShoppingListItemSchema = z.discriminatedUnion("itemType", [
  addCatalogItemSchema,
  addCustomItemSchema,
]);

export type AddShoppingListItemInput = z.infer<
  typeof addShoppingListItemSchema
>;

// ---------------------------------------------------------------------------
// Update Item Quantity Schema
// ---------------------------------------------------------------------------

export const updateShoppingListItemQuantitySchema = z.object({
  itemId: shoppingListEntityIdSchema,
  quantity: safePositiveInteger("تعداد جدید", 1),
});

export type UpdateShoppingListItemQuantityInput = z.infer<
  typeof updateShoppingListItemQuantitySchema
>;

// ---------------------------------------------------------------------------
// Remove Item Schema
// ---------------------------------------------------------------------------

export const removeShoppingListItemSchema = z.object({
  itemId: shoppingListEntityIdSchema,
});

export type RemoveShoppingListItemInput = z.infer<
  typeof removeShoppingListItemSchema
>;

// ---------------------------------------------------------------------------
// Transfer Internal Purchase Request Schema
// ---------------------------------------------------------------------------

export const transferInternalPurchaseRequestSchema = z.object({
  requestId: shoppingListEntityIdSchema,
});

export type TransferInternalPurchaseRequestInput = z.infer<
  typeof transferInternalPurchaseRequestSchema
>;
