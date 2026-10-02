import { z } from "zod";

import { orderStatusValues } from "@/model/order";

const objectIdPattern = /^[a-f\d]{24}$/i;

export const orderEntityIdSchema = z
  .string()
  .trim()
  .regex(objectIdPattern, "شناسه معتبر نیست");

export const createOrdersFromSelectionSchema = z.object({
  purchaseRequestId: orderEntityIdSchema,
});

export type CreateOrdersFromSelectionInput = z.infer<
  typeof createOrdersFromSelectionSchema
>;

export const orderIdSchema = z.object({
  id: orderEntityIdSchema,
});

export type OrderIdInput = z.infer<typeof orderIdSchema>;

export const cancelCafeOrderSchema = z.object({
  orderId: orderEntityIdSchema,
  cancelReason: z
    .string()
    .trim()
    .max(500, "دلیل لغو سفارش نمی‌تواند بیش از ۵۰۰ کاراکتر باشد")
    .optional(),
});

export type CancelCafeOrderInput = z.infer<typeof cancelCafeOrderSchema>;

export const confirmSupplierOrderSchema = z.object({
  orderId: orderEntityIdSchema,
});

export type ConfirmSupplierOrderInput = z.infer<
  typeof confirmSupplierOrderSchema
>;

export const rejectSupplierOrderSchema = z.object({
  orderId: orderEntityIdSchema,
  rejectReason: z
    .string()
    .trim()
    .max(500, "دلیل رد سفارش نمی‌تواند بیش از ۵۰۰ کاراکتر باشد")
    .optional(),
});

export type RejectSupplierOrderInput = z.infer<
  typeof rejectSupplierOrderSchema
>;

export const markSupplierOrderPreparingSchema = z.object({
  orderId: orderEntityIdSchema,
});

export type MarkSupplierOrderPreparingInput = z.infer<
  typeof markSupplierOrderPreparingSchema
>;

export const markSupplierOrderShippedSchema = z.object({
  orderId: orderEntityIdSchema,
  shippingNote: z
    .string()
    .trim()
    .max(500, "توضیحات ارسال نمی‌تواند بیش از ۵۰۰ کاراکتر باشد")
    .optional(),
});

export type MarkSupplierOrderShippedInput = z.infer<
  typeof markSupplierOrderShippedSchema
>;

export const markSupplierOrderDeliveredSchema = z.object({
  orderId: orderEntityIdSchema,
});

export type MarkSupplierOrderDeliveredInput = z.infer<
  typeof markSupplierOrderDeliveredSchema
>;

export const orderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(orderStatusValues).optional(),
});

export type OrderQueryInput = z.infer<typeof orderQuerySchema>;
