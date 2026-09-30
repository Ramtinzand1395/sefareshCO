import { z } from "zod";

const objectIdPattern = /^[a-f\d]{24}$/i;

export const offerEntityIdSchema = z
  .string()
  .trim()
  .regex(objectIdPattern, "شناسه معتبر نیست");

export const offerStatusValues = ["active", "inactive"] as const;
export type OfferStatus = (typeof offerStatusValues)[number];

const safePositiveInteger = (fieldName: string, min = 1) =>
  z.coerce
    .number({ message: `${fieldName} باید عدد باشد` })
    .int(`${fieldName} باید عدد صحیح باشد`)
    .min(min, `${fieldName} باید حداقل ${min} باشد`)
    .max(Number.MAX_SAFE_INTEGER, `${fieldName} خارج از محدوده مجاز است`)
    .refine((n) => Number.isSafeInteger(n), {
      message: `${fieldName} باید عدد صحیح امن باشد`,
    });

const safeNonNegativeInteger = (fieldName: string) =>
  z.coerce
    .number({ message: `${fieldName} باید عدد باشد` })
    .int(`${fieldName} باید عدد صحیح باشد`)
    .min(0, `${fieldName} نمی‌تواند منفی باشد`)
    .max(Number.MAX_SAFE_INTEGER, `${fieldName} خارج از محدوده مجاز است`)
    .refine((n) => Number.isSafeInteger(n), {
      message: `${fieldName} باید عدد صحیح امن باشد`,
    });

export const createSupplierOfferSchema = z.object({
  productId: offerEntityIdSchema.describe("شناسه محصول"),
  price: safePositiveInteger("قیمت (تومان)", 1),
  stock: safeNonNegativeInteger("موجودی انبار"),
  minOrderQuantity: safePositiveInteger("حداقل تعداد سفارش", 1).default(1),
  deliveryDays: z.coerce
    .number({ message: "زمان تحویل باید عدد باشد" })
    .int("زمان تحویل باید عدد صحیح باشد")
    .min(0, "زمان تحویل نمی‌تواند منفی باشد")
    .max(365, "زمان تحویل نمی‌تواند بیش از ۳۶۵ روز باشد")
    .default(0),
  status: z
    .enum(offerStatusValues, { message: "وضعیت انتخاب‌شده معتبر نیست" })
    .default("inactive"),
});

export type CreateSupplierOfferInput = z.infer<typeof createSupplierOfferSchema>;

export const updateSupplierOfferSchema = z.object({
  offerId: offerEntityIdSchema,
  price: safePositiveInteger("قیمت (تومان)", 1),
  stock: safeNonNegativeInteger("موجودی انبار"),
  minOrderQuantity: safePositiveInteger("حداقل تعداد سفارش", 1).default(1),
  deliveryDays: z.coerce
    .number({ message: "زمان تحویل باید عدد باشد" })
    .int("زمان تحویل باید عدد صحیح باشد")
    .min(0, "زمان تحویل نمی‌تواند منفی باشد")
    .max(365, "زمان تحویل نمی‌تواند بیش از ۳۶۵ روز باشد"),
});

export type UpdateSupplierOfferInput = z.infer<typeof updateSupplierOfferSchema>;

export const updateOfferStatusSchema = z.object({
  offerId: offerEntityIdSchema,
  status: z.enum(offerStatusValues, { message: "وضعیت انتخاب‌شده معتبر نیست" }),
});

export type UpdateOfferStatusInput = z.infer<typeof updateOfferStatusSchema>;

export const supplierOfferQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum(offerStatusValues).optional(),
});

export type SupplierOfferQueryInput = z.infer<typeof supplierOfferQuerySchema>;
