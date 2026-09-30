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

export const BUYER_CATALOG_SEARCH_MAX_LENGTH = 80;

export type QueryParamValue = string | string[] | undefined;

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
      .max(
        BUYER_CATALOG_SEARCH_MAX_LENGTH,
        "طول عبارت جستجو نمی‌تواند بیش از ۸۰ کاراکتر باشد",
      )
      .optional(),
  ),
  categoryId: z.preprocess(nullToUndef, adminEntityIdSchema.optional()),
  sort: z.enum(buyerCatalogSortValues).default("newest"),
});

export type BuyerCatalogQueryInput = z.infer<typeof buyerCatalogQuerySchema>;

export function getSingleQueryParam(value: QueryParamValue) {
  return typeof value === "string" ? value : undefined;
}

export function normalizeBuyerCatalogSearchParams(
  rawParams: Record<string, QueryParamValue>,
): BuyerCatalogQueryInput {
  const rawSearch = getSingleQueryParam(rawParams.search)?.trim();
  const search = rawSearch
    ? rawSearch.slice(0, BUYER_CATALOG_SEARCH_MAX_LENGTH)
    : undefined;

  const pageResult = buyerCatalogQuerySchema.shape.page.safeParse(
    getSingleQueryParam(rawParams.page),
  );
  const pageSizeResult = buyerCatalogQuerySchema.shape.pageSize.safeParse(
    getSingleQueryParam(rawParams.pageSize),
  );
  const categoryResult = buyerCatalogQuerySchema.shape.categoryId.safeParse(
    getSingleQueryParam(rawParams.categoryId),
  );
  const sortResult = buyerCatalogQuerySchema.shape.sort.safeParse(
    getSingleQueryParam(rawParams.sort),
  );

  return buyerCatalogQuerySchema.parse({
    page: pageResult.success ? pageResult.data : 1,
    pageSize: pageSizeResult.success ? pageSizeResult.data : 24,
    search,
    categoryId: categoryResult.success ? categoryResult.data : undefined,
    sort: sortResult.success ? sortResult.data : "newest",
  });
}

export const buyerCompareQuantitySchema = z.preprocess(
  (value) => {
    if (value === undefined) return 1;
    if (typeof value === "string" && value.trim() === "") return Number.NaN;
    return value;
  },
  z.coerce
    .number({ message: "تعداد باید یک عدد معتبر باشد" })
    .int("تعداد باید یک عدد صحیح باشد")
    .min(1, "تعداد باید حداقل ۱ باشد")
    .refine(
      (value) => Number.isSafeInteger(value),
      "تعداد خارج از محدوده مجاز محاسباتی است",
    ),
);

const buyerCompareSortSchema = z.enum(buyerCompareSortValues).default("price");

export const buyerCompareQuerySchema = z.object({
  productId: z.preprocess(nullToUndef, adminEntityIdSchema.optional()),
  quantity: buyerCompareQuantitySchema,
  sortBy: buyerCompareSortSchema,
});

export type BuyerCompareQueryInput = z.infer<typeof buyerCompareQuerySchema>;

export type BuyerCompareParamsResult =
  | {
      success: true;
      quantity: number;
      sortBy: BuyerCompareSort;
    }
  | {
      success: false;
      quantityInput: string;
      quantityError: string;
      sortBy: BuyerCompareSort;
    };

export function parseBuyerCompareParams(
  rawQuantity: unknown,
  rawSortBy: unknown,
): BuyerCompareParamsResult {
  const quantityResult = buyerCompareQuantitySchema.safeParse(rawQuantity);
  const sortResult = buyerCompareSortSchema.safeParse(rawSortBy);
  const sortBy = sortResult.success ? sortResult.data : "price";

  if (quantityResult.success) {
    return { success: true, quantity: quantityResult.data, sortBy };
  }

  return {
    success: false,
    quantityInput:
      typeof rawQuantity === "string" || typeof rawQuantity === "number"
        ? String(rawQuantity)
        : "",
    quantityError:
      quantityResult.error.issues[0]?.message ?? "تعداد واردشده معتبر نیست",
    sortBy,
  };
}
