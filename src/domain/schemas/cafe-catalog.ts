import { z } from "zod";

import { adminEntityIdSchema } from "@/src/domain/schemas/admin-common";

export const buyerCatalogSortValues = [
  "newest",
  "price_asc",
  "price_desc",
] as const;

export type BuyerCatalogSort = (typeof buyerCatalogSortValues)[number];

export const buyerCompareSortValues = ["price", "deliveryDays"] as const;
export type BuyerCompareSort = (typeof buyerCompareSortValues)[number];

const nullToUndef = (v: unknown) =>
  v === null || v === undefined || v === "" ? undefined : v;

export const buyerCatalogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(24),
  search: z.preprocess(
    nullToUndef,
    z
      .string()
      .trim()
      .max(80, "طول عبارت جستجو نمی‌تواند بیش از ۸۰ کاراکتر باشد")
      .optional(),
  ),
  categoryId: z.preprocess(nullToUndef, adminEntityIdSchema.optional()),
  sort: z.enum(buyerCatalogSortValues).default("newest"),
});

export type BuyerCatalogQueryInput = z.infer<typeof buyerCatalogQuerySchema>;

export const buyerCompareQuerySchema = z.object({
  productId: z.preprocess(nullToUndef, adminEntityIdSchema.optional()),
  quantity: z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? 1 : v),
    z.coerce
      .number({ message: "تعداد باید یک عدد معتبر باشد" })
      .int("تعداد باید یک عدد صحیح باشد")
      .min(1, "تعداد باید حداقل ۱ باشد")
      .refine(
        (v) => Number.isSafeInteger(v),
        "تعداد خارج از محدوده مجاز محاسباتی است",
      ),
  ),
  sortBy: z.enum(buyerCompareSortValues).default("price"),
});

export type BuyerCompareQueryInput = z.infer<typeof buyerCompareQuerySchema>;
