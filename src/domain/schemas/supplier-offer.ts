import { z } from "zod";

const objectIdPattern = /^[a-f\d]{24}$/i;

export const offerEntityIdSchema = z
  .string()
  .trim()
  .regex(objectIdPattern, "شناسه معتبر نیست");

export const offerStatusValues = ["active", "inactive"] as const;
export type OfferStatus = (typeof offerStatusValues)[number];

export const createSupplierOfferSchema = z.object({
  productId: offerEntityIdSchema.describe("شناسه محصول"),
  price: z.coerce
    .number({ message: "قیمت باید عدد باشد" })
    .int("قیمت باید عدد صحیح باشد")
    .min(1, "قیمت باید حداقل ۱ تومان باشد"),
  stock: z.coerce
    .number({ message: "موجودی باید عدد باشد" })
    .int("موجودی باید عدد صحیح باشد")
    .min(0, "موجودی نمی‌تواند منفی باشد"),
  minOrderQuantity: z.coerce
    .number({ message: "حداقل تعداد باید عدد باشد" })
    .int("حداقل تعداد باید عدد صحیح باشد")
    .min(1, "حداقل تعداد سفارش باید حداقل ۱ باشد"),
  deliveryDays: z.coerce
    .number({ message: "روز تحویل باید عدد باشد" })
    .int("روز تحویل باید عدد صحیح باشد")
    .min(0, "روز تحویل نمی‌تواند منفی باشد"),
  status: z
    .enum(offerStatusValues, { message: "وضعیت معتبر نیست" })
    .default("inactive"),
});

export type CreateSupplierOfferInput = z.infer<typeof createSupplierOfferSchema>;

export const updateSupplierOfferSchema = z.object({
  offerId: offerEntityIdSchema,
  price: z.coerce
    .number({ message: "قیمت باید عدد باشد" })
    .int("قیمت باید عدد صحیح باشد")
    .min(1, "قیمت باید حداقل ۱ تومان باشد"),
  stock: z.coerce
    .number({ message: "موجودی باید عدد باشد" })
    .int("موجودی باید عدد صحیح باشد")
    .min(0, "موجودی نمی‌تواند منفی باشد"),
  minOrderQuantity: z.coerce
    .number({ message: "حداقل تعداد باید عدد باشد" })
    .int("حداقل تعداد باید عدد صحیح باشد")
    .min(1, "حداقل تعداد سفارش باید حداقل ۱ باشد"),
  deliveryDays: z.coerce
    .number({ message: "روز تحویل باید عدد باشد" })
    .int("روز تحویل باید عدد صحیح باشد")
    .min(0, "روز تحویل نمی‌تواند منفی باشد"),
});

export type UpdateSupplierOfferInput = z.infer<typeof updateSupplierOfferSchema>;

export const updateOfferStatusSchema = z.object({
  offerId: offerEntityIdSchema,
  status: z.enum(offerStatusValues, { message: "وضعیت معتبر نیست" }),
});

export type UpdateOfferStatusInput = z.infer<typeof updateOfferStatusSchema>;
