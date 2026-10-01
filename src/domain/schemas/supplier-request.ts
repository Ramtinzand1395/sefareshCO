import { z } from "zod";

import { supplierRequestStatusValues } from "@/model/supplier-request";

const objectIdPattern = /^[a-f\d]{24}$/i;

export const supplierRequestEntityIdSchema = z
  .string()
  .trim()
  .regex(objectIdPattern, "شناسه معتبر نیست");

export const matchPurchaseRequestSchema = z.object({
  requestId: supplierRequestEntityIdSchema,
});

export type MatchPurchaseRequestInput = z.infer<
  typeof matchPurchaseRequestSchema
>;

export const supplierRequestIdSchema = z.object({
  id: supplierRequestEntityIdSchema,
});

export type SupplierRequestIdInput = z.infer<typeof supplierRequestIdSchema>;

export const supplierRequestQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(supplierRequestStatusValues).optional(),
});

export type SupplierRequestQueryInput = z.infer<
  typeof supplierRequestQuerySchema
>;
