import { z } from "zod";

import {
  paymentStatusValues,
  supplierPayableStatusValues,
} from "@/src/domain/finance";

const objectIdPattern = /^[a-f\d]{24}$/i;

export const financeEntityIdSchema = z
  .string()
  .trim()
  .regex(objectIdPattern, "شناسه معتبر نیست");

// ---------------------------------------------------------------------------
// 1. Payment Schemas
// ---------------------------------------------------------------------------

export const createPaymentAttemptSchema = z.object({
  orderId: financeEntityIdSchema,
  idempotencyKey: z
    .string()
    .trim()
    .min(1, "کلید تکرارناپذیری (idempotencyKey) الزامی است")
    .max(100, "طول کلید تکرارناپذیری نمی‌تواند بیش از ۱۰۰ کاراکتر باشد"),
});

export type CreatePaymentAttemptInput = z.infer<
  typeof createPaymentAttemptSchema
>;

export const markPaymentPaidInternalSchema = z.object({
  paymentId: financeEntityIdSchema,
  providerReference: z
    .string()
    .trim()
    .max(100, "شناسه مرجع درگاه نمی‌تواند بیش از ۱۰۰ کاراکتر باشد")
    .optional(),
});

export type MarkPaymentPaidInternalInput = z.infer<
  typeof markPaymentPaidInternalSchema
>;

export const markPaymentFailedInternalSchema = z.object({
  paymentId: financeEntityIdSchema,
  failureCode: z
    .string()
    .trim()
    .max(50, "کد خطا نمی‌تواند بیش از ۵۰ کاراکتر باشد")
    .optional(),
  failureMessage: z
    .string()
    .trim()
    .max(500, "پیام خطا نمی‌تواند بیش از ۵۰۰ کاراکتر باشد")
    .optional(),
});

export type MarkPaymentFailedInternalInput = z.infer<
  typeof markPaymentFailedInternalSchema
>;

// ---------------------------------------------------------------------------
// 2. Query Schemas
// ---------------------------------------------------------------------------

export const supplierPayableQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(supplierPayableStatusValues).optional(),
});

export type SupplierPayableQueryInput = z.infer<
  typeof supplierPayableQuerySchema
>;

export const supplierSettlementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type SupplierSettlementQueryInput = z.infer<
  typeof supplierSettlementQuerySchema
>;

export const adminPaymentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(paymentStatusValues).optional(),
  cafeId: financeEntityIdSchema.optional(),
  supplierId: financeEntityIdSchema.optional(),
});

export type AdminPaymentQueryInput = z.infer<typeof adminPaymentQuerySchema>;

export const adminSettlementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  supplierId: financeEntityIdSchema.optional(),
});

export type AdminSettlementQueryInput = z.infer<
  typeof adminSettlementQuerySchema
>;

// ---------------------------------------------------------------------------
// 3. Settlement Creation Schema
// ---------------------------------------------------------------------------

export const createSettlementSchema = z.object({
  supplierId: financeEntityIdSchema,
  payableIds: z
    .array(financeEntityIdSchema)
    .min(1, "حداقل انتخاب یک قلم پرداختنی الزامی است"),
  note: z
    .string()
    .trim()
    .max(500, "یادداشت تسویه نمی‌تواند بیش از ۵۰۰ کاراکتر باشد")
    .optional(),
});

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;
