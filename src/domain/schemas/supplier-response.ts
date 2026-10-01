import { z } from "zod";

import { supplierRequestEntityIdSchema } from "@/src/domain/schemas/supplier-request";

export const quotedItemSchema = z.object({
  purchaseRequestItemId: supplierRequestEntityIdSchema,
  status: z.literal("quoted"),
  unitPrice: z
    .number({ message: "قیمت واحد الزامی است" })
    .int("قیمت واحد باید عدد صحیح به تومان باشد")
    .positive("قیمت واحد باید عددی مثبت باشد")
    .refine(Number.isSafeInteger, "قیمت واحد خارج از محدوده مجاز است"),
  confirmedQuantity: z
    .number({ message: "تعداد تأییدشده الزامی است" })
    .int("تعداد تأییدشده باید عدد صحیح باشد")
    .positive("تعداد تأییدشده باید عددی مثبت باشد")
    .refine(Number.isSafeInteger, "تعداد تأییدشده خارج از محدوده مجاز است"),
  note: z
    .string()
    .trim()
    .max(300, "یادداشت قلم نمی‌تواند بیش از ۳۰۰ کاراکتر باشد")
    .optional(),
});

export const unavailableItemSchema = z
  .object({
    purchaseRequestItemId: supplierRequestEntityIdSchema,
    status: z.literal("unavailable"),
    unitPrice: z.any().optional(),
    confirmedQuantity: z.any().optional(),
    note: z
      .string()
      .trim()
      .max(300, "یادداشت قلم نمی‌تواند بیش از ۳۰۰ کاراکتر باشد")
      .optional(),
  })
  .refine(
    (data) => data.unitPrice === undefined || data.unitPrice === null,
    {
      message: "برای قلم ناموجود نباید قیمت تعیین شود",
      path: ["unitPrice"],
    },
  )
  .refine(
    (data) =>
      data.confirmedQuantity === undefined ||
      data.confirmedQuantity === null ||
      data.confirmedQuantity === 0,
    {
      message: "تعداد قلم ناموجود باید صفر باشد",
      path: ["confirmedQuantity"],
    },
  );

export const supplierResponseItemInputSchema = z.discriminatedUnion("status", [
  quotedItemSchema,
  unavailableItemSchema,
]);

export type SupplierResponseItemInput = z.infer<
  typeof supplierResponseItemInputSchema
>;

export const submitSupplierResponseSchema = z.object({
  supplierRequestId: supplierRequestEntityIdSchema,
  deliveryDays: z
    .number({ message: "مدت زمان تحویل الزامی است" })
    .int("مدت زمان تحویل باید عدد صحیح باشد")
    .min(0, "مدت زمان تحویل نمی‌تواند منفی باشد")
    .max(365, "مدت زمان تحویل نمی‌تواند بیش از ۳۶۵ روز باشد")
    .refine(Number.isSafeInteger, "مدت زمان تحویل خارج از محدوده مجاز است"),
  shippingCost: z
    .number({ message: "هزینه ارسال الزامی است" })
    .int("هزینه ارسال باید عدد صحیح به تومان باشد")
    .min(0, "هزینه ارسال نمی‌تواند منفی باشد")
    .refine(Number.isSafeInteger, "هزینه ارسال خارج از محدوده مجاز است"),
  items: z
    .array(supplierResponseItemInputSchema)
    .min(1, "حداقل یک قلم برای پاسخ الزامی است"),
  note: z
    .string()
    .trim()
    .max(500, "یادداشت کلی نمی‌تواند بیش از ۵۰۰ کاراکتر باشد")
    .optional(),
});

export type SubmitSupplierResponseInput = z.infer<
  typeof submitSupplierResponseSchema
>;

export const updateSupplierResponseSchema = submitSupplierResponseSchema;
export type UpdateSupplierResponseInput = SubmitSupplierResponseInput;

export const declineSupplierRequestSchema = z.object({
  supplierRequestId: supplierRequestEntityIdSchema,
  reason: z
    .string()
    .trim()
    .max(300, "دلیل رد درخواست نمی‌تواند بیش از ۳۰۰ کاراکتر باشد")
    .optional(),
});

export type DeclineSupplierRequestInput = z.infer<
  typeof declineSupplierRequestSchema
>;
