import { z } from "zod";

import {
  purchaseRequestItemTypeValues,
  purchaseRequestStatusValues,
  type PurchaseRequestItemType,
  type PurchaseRequestStatus,
} from "@/model/purchase-request";
import { MAX_PURCHASE_REQUEST_ITEMS } from "@/src/domain/purchase-request";

export {
  purchaseRequestItemTypeValues,
  purchaseRequestStatusValues,
};
export type {
  PurchaseRequestItemType,
  PurchaseRequestStatus,
};

const objectIdPattern = /^[a-f\d]{24}$/i;

export const purchaseRequestEntityIdSchema = z
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
// Needed By Date Schema (Future date / safe ISO string)
// ---------------------------------------------------------------------------

export const neededByDateSchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      const d = new Date(val);
      return !isNaN(d.getTime());
    },
    { message: "فرمت تاریخ تحویل درخواستی معتبر نیست" },
  )
  .refine(
    (val) => {
      const d = new Date(val);
      const now = new Date();
      const todayUtc = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      return d.getTime() >= todayUtc.getTime();
    },
    { message: "تاریخ تحویل درخواستی نمی‌تواند در گذشته باشد" },
  );

// ---------------------------------------------------------------------------
// Item Selection Schema
// Supports selecting by specific shoppingListItemId OR by aggregateKey.
// If quantity is omitted, allocates the full remaining available quantity.
// ---------------------------------------------------------------------------

export const purchaseRequestItemSelectionSchema = z
  .object({
    shoppingListItemId: z.preprocess(
      nullToUndef,
      purchaseRequestEntityIdSchema.optional(),
    ),
    aggregateKey: z.preprocess(
      nullToUndef,
      z.string().trim().min(1, "کلید تجمیعی قلم معتبر نیست").optional(),
    ),
    quantity: z.preprocess(
      nullToUndef,
      safePositiveInteger("تعداد قلم درخواستی", 1).optional(),
    ),
    note: z.preprocess(
      nullToUndef,
      z
        .string()
        .trim()
        .max(300, "طول یادداشت قلم نمی‌تواند بیش از ۳۰۰ کاراکتر باشد")
        .optional(),
    ),
  })
  .refine(
    (data) => Boolean(data.shoppingListItemId || data.aggregateKey),
    {
      message: "حداقل یکی از شناسه قلم یا کلید تجمیعی باید مشخص شود",
    },
  );

export type PurchaseRequestItemSelectionInput = z.infer<
  typeof purchaseRequestItemSelectionSchema
>;

// ---------------------------------------------------------------------------
// Create Purchase Request Schema
// ---------------------------------------------------------------------------

export const createPurchaseRequestSchema = z.object({
  title: z.preprocess(
    nullToUndef,
    z
      .string()
      .trim()
      .max(150, "طول عنوان استعلام نمی‌تواند بیش از ۱۵۰ کاراکتر باشد")
      .optional(),
  ),
  note: z.preprocess(
    nullToUndef,
    z
      .string()
      .trim()
      .max(500, "طول توضیحات استعلام نمی‌تواند بیش از ۵۰۰ کاراکتر باشد")
      .optional(),
  ),
  neededByDate: z.preprocess(nullToUndef, neededByDateSchema.optional()),
  idempotencyKey: z.preprocess(
    nullToUndef,
    z
      .string()
      .trim()
      .min(1, "کلید تکرارناپذیری معتبر نیست")
      .max(128, "طول کلید تکرارناپذیری بیش از حد مجاز است")
      .optional(),
  ),
  submitImmediately: z.coerce.boolean().default(false),
  items: z
    .array(purchaseRequestItemSelectionSchema)
    .min(1, "حداقل یک قلم برای ایجاد استعلام قیمت الزامی است")
    .max(
      MAX_PURCHASE_REQUEST_ITEMS,
      `حداکثر ${MAX_PURCHASE_REQUEST_ITEMS} قلم در هر استعلام قیمت مجاز است`,
    ),
});

export type CreatePurchaseRequestInput = z.infer<
  typeof createPurchaseRequestSchema
>;

// ---------------------------------------------------------------------------
// Submit Purchase Request Schema
// ---------------------------------------------------------------------------

export const submitPurchaseRequestSchema = z.object({
  requestId: purchaseRequestEntityIdSchema,
});

export type SubmitPurchaseRequestInput = z.infer<
  typeof submitPurchaseRequestSchema
>;

// ---------------------------------------------------------------------------
// Cancel Purchase Request Schema
// ---------------------------------------------------------------------------

export const cancelPurchaseRequestSchema = z.object({
  requestId: purchaseRequestEntityIdSchema,
  reason: z.preprocess(
    nullToUndef,
    z
      .string()
      .trim()
      .max(500, "طول دلیل لغو نمی‌تواند بیش از ۵۰۰ کاراکتر باشد")
      .optional(),
  ),
});

export type CancelPurchaseRequestInput = z.infer<
  typeof cancelPurchaseRequestSchema
>;

// ---------------------------------------------------------------------------
// List Query Schema
// ---------------------------------------------------------------------------

export const purchaseRequestQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.preprocess(
    nullToUndef,
    z.enum(purchaseRequestStatusValues).optional(),
  ),
});

export type PurchaseRequestQueryInput = z.infer<
  typeof purchaseRequestQuerySchema
>;
