import { z } from "zod";

import {
  internalRequestItemStatusValues,
  internalRequestStatusValues,
  type InternalRequestItemStatus,
  type InternalRequestStatus,
} from "@/model/internal-purchase-request";

export { internalRequestItemStatusValues, internalRequestStatusValues };
export type { InternalRequestItemStatus, InternalRequestStatus };

const objectIdPattern = /^[a-f\d]{24}$/i;

export const internalRequestEntityIdSchema = z
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

export const safeNonNegativeInteger = (fieldName: string) =>
  z.coerce
    .number({ message: `${fieldName} باید عدد باشد` })
    .int(`${fieldName} باید عدد صحیح باشد`)
    .min(0, `${fieldName} نمی‌تواند منفی باشد`)
    .max(Number.MAX_SAFE_INTEGER, `${fieldName} خارج از محدوده مجاز است`)
    .refine((n) => Number.isSafeInteger(n), {
      message: `${fieldName} باید عدد صحیح امن باشد`,
    });

const nullToUndef = (v: unknown) =>
  v === null || v === undefined || v === "" ? undefined : v;

// ---------------------------------------------------------------------------
// Item creation schemas with discriminated union
// Invariant: catalog item MUST have productId and NO customTitle/customUnit.
//            custom item MUST have customTitle/customUnit and NO productId.
// ---------------------------------------------------------------------------

const catalogItemSchema = z.object({
  itemType: z.literal("catalog"),
  productId: internalRequestEntityIdSchema,
  requestedQuantity: safePositiveInteger("تعداد درخواستی", 1),
  note: z
    .string()
    .trim()
    .max(300, "طول یادداشت قلم نمی‌تواند بیش از ۳۰۰ کاراکتر باشد")
    .optional(),
  customTitle: z.undefined().optional(),
  customUnit: z.undefined().optional(),
});

const customItemSchema = z.object({
  itemType: z.literal("custom"),
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
  requestedQuantity: safePositiveInteger("تعداد درخواستی", 1),
  note: z
    .string()
    .trim()
    .max(300, "طول یادداشت قلم نمی‌تواند بیش از ۳۰۰ کاراکتر باشد")
    .optional(),
  productId: z.undefined().optional(),
});

export const createInternalRequestItemSchema = z.discriminatedUnion(
  "itemType",
  [catalogItemSchema, customItemSchema],
);

export type CreateInternalRequestItemInput = z.infer<
  typeof createInternalRequestItemSchema
>;

// ---------------------------------------------------------------------------
// Create Request Schema
// ---------------------------------------------------------------------------

export const createInternalPurchaseRequestSchema = z.object({
  title: z.preprocess(
    nullToUndef,
    z
      .string()
      .trim()
      .max(150, "عنوان درخواست نمی‌تواند بیش از ۱۵۰ کاراکتر باشد")
      .optional(),
  ),
  description: z.preprocess(
    nullToUndef,
    z
      .string()
      .trim()
      .max(1000, "توضیحات درخواست نمی‌تواند بیش از ۱۰۰۰ کاراکتر باشد")
      .optional(),
  ),
  items: z
    .array(createInternalRequestItemSchema)
    .min(1, "حداقل یک قلم برای درخواست الزامی است")
    .max(50, "حداکثر ۵۰ قلم در یک درخواست مجاز است"),
});

export type CreateInternalPurchaseRequestInput = z.infer<
  typeof createInternalPurchaseRequestSchema
>;

// ---------------------------------------------------------------------------
// Review Request Schema
// ---------------------------------------------------------------------------

export const reviewInternalRequestItemSchema = z.object({
  itemId: internalRequestEntityIdSchema,
  approvedQuantity: safeNonNegativeInteger("تعداد تأییدشده"),
  note: z.preprocess(
    nullToUndef,
    z
      .string()
      .trim()
      .max(300, "طول یادداشت بررسی قلم نمی‌تواند بیش از ۳۰۰ کاراکتر باشد")
      .optional(),
  ),
});

export type ReviewInternalRequestItemInput = z.infer<
  typeof reviewInternalRequestItemSchema
>;

export const reviewInternalPurchaseRequestSchema = z.object({
  requestId: internalRequestEntityIdSchema,
  reviewNotes: z.preprocess(
    nullToUndef,
    z
      .string()
      .trim()
      .max(1000, "توضیحات مدیر نمی‌تواند بیش از ۱۰۰۰ کاراکتر باشد")
      .optional(),
  ),
  items: z
    .array(reviewInternalRequestItemSchema)
    .min(1, "حداقل یک قلم برای بررسی الزامی است"),
});

export type ReviewInternalPurchaseRequestInput = z.infer<
  typeof reviewInternalPurchaseRequestSchema
>;

// ---------------------------------------------------------------------------
// Cancel Request Schema
// ---------------------------------------------------------------------------

export const cancelInternalPurchaseRequestSchema = z.object({
  requestId: internalRequestEntityIdSchema,
  cancelReason: z.preprocess(
    nullToUndef,
    z
      .string()
      .trim()
      .max(500, "دلیل لغو درخواست نمی‌تواند بیش از ۵۰۰ کاراکتر باشد")
      .optional(),
  ),
});

export type CancelInternalPurchaseRequestInput = z.infer<
  typeof cancelInternalPurchaseRequestSchema
>;

// ---------------------------------------------------------------------------
// List Query Schema
// ---------------------------------------------------------------------------

export const internalPurchaseRequestQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z.preprocess(
    nullToUndef,
    z
      .enum(internalRequestStatusValues, {
        message: "وضعیت فیلتر انتخاب‌شده معتبر نیست",
      })
      .optional(),
  ),
});

export type InternalPurchaseRequestQueryInput = z.infer<
  typeof internalPurchaseRequestQuerySchema
>;
