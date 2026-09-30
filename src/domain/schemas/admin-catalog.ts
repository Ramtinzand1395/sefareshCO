import { z } from "zod";

import { adminEntityIdSchema } from "@/src/domain/schemas/admin-common";

// ---------------------------------------------------------------------------
// Category Enums & Values
// ---------------------------------------------------------------------------

export const categoryStatusValues = ["active", "inactive"] as const;
export type CategoryStatus = (typeof categoryStatusValues)[number];

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const categorySlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "اسلاگ باید حداقل ۲ کاراکتر باشد")
  .max(140, "اسلاگ نمی‌تواند بیشتر از ۱۴۰ کاراکتر باشد")
  .regex(
    slugRegex,
    "اسلاگ فقط می‌تواند شامل حروف کوچک انگلیسی، اعداد و خط تیره (-) باشد",
  );

export const productSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "اسلاگ باید حداقل ۲ کاراکتر باشد")
  .max(220, "اسلاگ نمی‌تواند بیشتر از ۲۲۰ کاراکتر باشد")
  .regex(
    slugRegex,
    "اسلاگ فقط می‌تواند شامل حروف کوچک انگلیسی، اعداد و خط تیره (-) باشد",
  );

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Converts null/undefined/"" → undefined so optional string fields accept
 * the null that FormData.get() returns for absent inputs in Zod v4.
 * (.optional().or(z.literal("")) is broken with null in Zod v4)
 */
const nullToUndef = (v: unknown) =>
  v === null || v === undefined || v === "" ? undefined : v;

/** Optional string field that correctly handles null from FormData in Zod v4. */
function optStr(maxLen: number, msg?: string) {
  return z.preprocess(nullToUndef, z.string().trim().max(maxLen, msg).optional());
}

// ---------------------------------------------------------------------------
// Category Schemas
// ---------------------------------------------------------------------------

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "نام دسته‌بندی باید حداقل ۲ کاراکتر باشد")
    .max(120, "نام دسته‌بندی نمی‌تواند بیش از ۱۲۰ کاراکتر باشد"),
  slug: categorySlugSchema,
  description: optStr(1000, "توضیحات نمی‌تواند بیش از ۱۰۰۰ کاراکتر باشد"),
  parentId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null))
    .refine((val) => val === null || /^[a-f\d]{24}$/i.test(val), {
      message: "شناسه دسته‌بندی والد نامعتبر است",
    }),
  displayOrder: z.coerce
    .number({ message: "ترتیب نمایش باید عدد باشد" })
    .int("ترتیب نمایش باید عدد صحیح باشد")
    .min(0, "ترتیب نمایش نمی‌تواند منفی باشد")
    .default(0),
  icon: optStr(100),
  image: optStr(500),
  status: z
    .enum(categoryStatusValues, {
      message: "وضعیت انتخاب‌شده معتبر نیست",
    })
    .default("active"),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  categoryId: adminEntityIdSchema,
  name: z
    .string()
    .trim()
    .min(2, "نام دسته‌بندی باید حداقل ۲ کاراکتر باشد")
    .max(120, "نام دسته‌بندی نمی‌تواند بیش از ۱۲۰ کاراکتر باشد"),
  slug: categorySlugSchema,
  description: optStr(1000, "توضیحات نمی‌تواند بیش از ۱۰۰۰ کاراکتر باشد"),
  parentId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null))
    .refine((val) => val === null || /^[a-f\d]{24}$/i.test(val), {
      message: "شناسه دسته‌بندی والد نامعتبر است",
    }),
  displayOrder: z.coerce
    .number({ message: "ترتیب نمایش باید عدد باشد" })
    .int("ترتیب نمایش باید عدد صحیح باشد")
    .min(0, "ترتیب نمایش نمی‌تواند منفی باشد")
    .default(0),
  icon: optStr(100),
  image: optStr(500),
  status: z.enum(categoryStatusValues, {
    message: "وضعیت انتخاب‌شده معتبر نیست",
  }),
});

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const updateCategoryStatusSchema = z.object({
  categoryId: adminEntityIdSchema,
  status: z.enum(categoryStatusValues, {
    message: "وضعیت انتخاب‌شده معتبر نیست",
  }),
});

export type UpdateCategoryStatusInput = z.infer<
  typeof updateCategoryStatusSchema
>;

// ---------------------------------------------------------------------------
// Product Enums & Values
// ---------------------------------------------------------------------------

export const productStatusValues = ["draft", "active", "inactive"] as const;
export type ProductStatus = (typeof productStatusValues)[number];

export const productAttributeItemSchema = z.object({
  name: z.string().trim().min(1, "نام ویژگی الزامی است").max(80),
  value: z.string().trim().min(1, "مقدار ویژگی الزامی است").max(250),
});

export type ProductAttributeItem = z.infer<typeof productAttributeItemSchema>;

// ---------------------------------------------------------------------------
// Product Schemas (Reference Product only: NO price, NO stock, NO seller info)
// ---------------------------------------------------------------------------

export const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "نام محصول باید حداقل ۲ کاراکتر باشد")
    .max(200, "نام محصول نمی‌تواند بیش از ۲۰۰ کاراکتر باشد"),
  slug: productSlugSchema,
  categoryId: adminEntityIdSchema,
  brand: optStr(100, "نام برند نمی‌تواند بیش از ۱۰۰ کاراکتر باشد"),
  unit: z
    .string()
    .trim()
    .min(1, "واحد سنجش الزامی است")
    .max(50, "واحد سنجش نمی‌تواند بیش از ۵۰ کاراکتر باشد"),
  description: optStr(3000, "توضیحات نمی‌تواند بیش از ۳۰۰۰ کاراکتر باشد"),
  barcode: z.preprocess(
    nullToUndef,
    z
      .string()
      .trim()
      .max(60, "بارکد نمی‌تواند بیش از ۶۰ کاراکتر باشد")
      .optional()
      .transform((val) => (val && val.length > 0 ? val : undefined)),
  ),
  sku: z.preprocess(
    nullToUndef,
    z
      .string()
      .trim()
      .max(60, "کد کالا (SKU) نمی‌تواند بیش از ۶۰ کاراکتر باشد")
      .optional()
      .transform((val) => (val && val.length > 0 ? val : undefined)),
  ),
  images: z.array(z.string().trim()).default([]).optional(),
  status: z
    .enum(productStatusValues, {
      message: "وضعیت انتخاب‌شده معتبر نیست",
    })
    .default("draft"),
  attributes: z.array(productAttributeItemSchema).default([]).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  productId: adminEntityIdSchema,
  name: z
    .string()
    .trim()
    .min(2, "نام محصول باید حداقل ۲ کاراکتر باشد")
    .max(200, "نام محصول نمی‌تواند بیش از ۲۰۰ کاراکتر باشد"),
  slug: productSlugSchema,
  categoryId: adminEntityIdSchema,
  brand: optStr(100, "نام برند نمی‌تواند بیش از ۱۰۰ کاراکتر باشد"),
  unit: z
    .string()
    .trim()
    .min(1, "واحد سنجش الزامی است")
    .max(50, "واحد سنجش نمی‌تواند بیش از ۵۰ کاراکتر باشد"),
  description: optStr(3000, "توضیحات نمی‌تواند بیش از ۳۰۰۰ کاراکتر باشد"),
  barcode: z.preprocess(
    nullToUndef,
    z
      .string()
      .trim()
      .max(60, "بارکد نمی‌تواند بیش از ۶۰ کاراکتر باشد")
      .optional()
      .transform((val) => (val && val.length > 0 ? val : undefined)),
  ),
  sku: z.preprocess(
    nullToUndef,
    z
      .string()
      .trim()
      .max(60, "کد کالا (SKU) نمی‌تواند بیش از ۶۰ کاراکتر باشد")
      .optional()
      .transform((val) => (val && val.length > 0 ? val : undefined)),
  ),
  images: z.array(z.string().trim()).default([]).optional(),
  status: z.enum(productStatusValues, {
    message: "وضعیت انتخاب‌شده معتبر نیست",
  }),
  attributes: z.array(productAttributeItemSchema).default([]).optional(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const updateProductStatusSchema = z.object({
  productId: adminEntityIdSchema,
  status: z.enum(productStatusValues, {
    message: "وضعیت انتخاب‌شده معتبر نیست",
  }),
});

export type UpdateProductStatusInput = z.infer<
  typeof updateProductStatusSchema
>;
