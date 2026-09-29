import { z } from "zod";

// ---------------------------------------------------------------------------
// Status – matches model enum exactly
// ---------------------------------------------------------------------------

export const supplierStatusValues = [
  "pending",
  "active",
  "suspended",
  "rejected",
] as const;

export type SupplierStatus = (typeof supplierStatusValues)[number];

export const updateSupplierStatusSchema = z.object({
  supplierId: z.string().min(1, "شناسه تأمین‌کننده الزامی است"),
  status: z.enum(supplierStatusValues, {
    message: "وضعیت انتخاب‌شده معتبر نیست",
  }),
});

export type UpdateSupplierStatusInput = z.infer<
  typeof updateSupplierStatusSchema
>;

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export const supplierVerificationValues = ["verified", "unverified"] as const;

export type SupplierVerificationAction =
  (typeof supplierVerificationValues)[number];

export const updateSupplierVerificationSchema = z.object({
  supplierId: z.string().min(1, "شناسه تأمین‌کننده الزامی است"),
  action: z.enum(supplierVerificationValues, {
    message: "عملیات تأیید معتبر نیست",
  }),
});

export type UpdateSupplierVerificationInput = z.infer<
  typeof updateSupplierVerificationSchema
>;
