import "server-only";

import { adminEntityIdSchema } from "@/src/domain/schemas/admin-common";
import type {
  CreateProductInput,
  ProductStatus,
  UpdateProductInput,
} from "@/src/domain/schemas/admin-catalog";
import { requireAdmin } from "@/src/lib/admin-helpers";
import {
  createPaginationMeta,
  type AdminPaginationMeta,
} from "@/src/lib/admin-query";
import { findCategoryById } from "@/src/repositories/admin-category-repository";
import {
  createProduct,
  findAdminProductDetail,
  findAdminProductList,
  findProductByBarcode,
  findProductBySku,
  findProductBySlug,
  updateProduct,
  updateProductStatus,
  type AdminProductDetailDTO,
  type AdminProductListItemDTO,
} from "@/src/repositories/admin-product-repository";

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

export class ProductNotFoundError extends Error {
  constructor(message = "محصول مورد نظر یافت نشد") {
    super(message);
    this.name = "ProductNotFoundError";
  }
}

export class DuplicateProductSlugError extends Error {
  constructor(message = "این نامک (slug) قبلاً برای محصول دیگری ثبت شده است") {
    super(message);
    this.name = "DuplicateProductSlugError";
  }
}

export class DuplicateProductSkuError extends Error {
  constructor(message = "این کد کالا (SKU) قبلاً برای محصول دیگری ثبت شده است") {
    super(message);
    this.name = "DuplicateProductSkuError";
  }
}

export class DuplicateProductBarcodeError extends Error {
  constructor(message = "این بارکد قبلاً برای محصول دیگری ثبت شده است") {
    super(message);
    this.name = "DuplicateProductBarcodeError";
  }
}

export class CategoryForProductNotFoundError extends Error {
  constructor(message = "دسته‌بندی انتخاب‌شده برای محصول وجود ندارد") {
    super(message);
    this.name = "CategoryForProductNotFoundError";
  }
}

export class InactiveCategoryAssignmentError extends Error {
  constructor(
    message = "نمی‌توان محصول فعال را به یک دسته‌بندی غیرفعال تخصیص داد",
  ) {
    super(message);
    this.name = "InactiveCategoryAssignmentError";
  }
}

export class InvalidProductIdError extends Error {
  constructor(message = "شناسه محصول معتبر نیست") {
    super(message);
    this.name = "InvalidProductIdError";
  }
}

// ---------------------------------------------------------------------------
// Pagination DTO
// ---------------------------------------------------------------------------

export type AdminProductListDTO = {
  items: AdminProductListItemDTO[];
  pagination: AdminPaginationMeta;
};

function assertValidProductId(productId: string) {
  if (!adminEntityIdSchema.safeParse(productId).success) {
    throw new InvalidProductIdError();
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getAdminProductList(query: {
  page: number;
  pageSize: number;
  search?: string;
  status?: ProductStatus;
  categoryId?: string;
}): Promise<AdminProductListDTO> {
  await requireAdmin();

  const { items, total } = await findAdminProductList(query);

  return {
    items,
    pagination: createPaginationMeta(query.page, query.pageSize, total),
  };
}

export async function getAdminProductDetail(
  productId: string,
): Promise<AdminProductDetailDTO> {
  await requireAdmin();
  assertValidProductId(productId);

  const product = await findAdminProductDetail(productId);
  if (!product) throw new ProductNotFoundError();

  return product;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createAdminProduct(
  input: CreateProductInput,
): Promise<string> {
  await requireAdmin();

  // 1. Verify Category exists
  const category = await findCategoryById(input.categoryId);
  if (!category) {
    throw new CategoryForProductNotFoundError();
  }

  if (input.status === "active" && category.status === "inactive") {
    throw new InactiveCategoryAssignmentError();
  }

  const slug = input.slug.trim().toLowerCase();

  // 2. Duplicate slug check
  const existingBySlug = await findProductBySlug(slug);
  if (existingBySlug) {
    throw new DuplicateProductSlugError();
  }

  // 3. Duplicate SKU check
  if (input.sku) {
    const existingBySku = await findProductBySku(input.sku);
    if (existingBySku) {
      throw new DuplicateProductSkuError();
    }
  }

  // 4. Duplicate Barcode check
  if (input.barcode) {
    const existingByBarcode = await findProductByBarcode(input.barcode);
    if (existingByBarcode) {
      throw new DuplicateProductBarcodeError();
    }
  }

  try {
    return await createProduct({
      name: input.name,
      slug,
      categoryId: input.categoryId,
      brand: input.brand,
      unit: input.unit,
      description: input.description,
      barcode: input.barcode,
      sku: input.sku,
      status: input.status,
      images: input.images,
      attributes: input.attributes,
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: number }).code === 11000
    ) {
      const errKey = (error as { keyPattern?: Record<string, number> })
        .keyPattern;
      if (errKey?.sku) throw new DuplicateProductSkuError();
      if (errKey?.barcode) throw new DuplicateProductBarcodeError();
      throw new DuplicateProductSlugError();
    }
    throw error;
  }
}

export async function updateAdminProduct(
  input: UpdateProductInput,
): Promise<void> {
  await requireAdmin();
  assertValidProductId(input.productId);

  // 1. Verify Category exists
  const category = await findCategoryById(input.categoryId);
  if (!category) {
    throw new CategoryForProductNotFoundError();
  }

  if (input.status === "active" && category.status === "inactive") {
    throw new InactiveCategoryAssignmentError();
  }

  const slug = input.slug.trim().toLowerCase();

  // 2. Duplicate slug check (excluding self)
  const existingBySlug = await findProductBySlug(slug, input.productId);
  if (existingBySlug) {
    throw new DuplicateProductSlugError();
  }

  // 3. Duplicate SKU check (excluding self)
  if (input.sku) {
    const existingBySku = await findProductBySku(input.sku, input.productId);
    if (existingBySku) {
      throw new DuplicateProductSkuError();
    }
  }

  // 4. Duplicate Barcode check (excluding self)
  if (input.barcode) {
    const existingByBarcode = await findProductByBarcode(
      input.barcode,
      input.productId,
    );
    if (existingByBarcode) {
      throw new DuplicateProductBarcodeError();
    }
  }

  try {
    const updated = await updateProduct(input.productId, {
      name: input.name,
      slug,
      categoryId: input.categoryId,
      brand: input.brand,
      unit: input.unit,
      description: input.description,
      barcode: input.barcode,
      sku: input.sku,
      status: input.status,
      images: input.images,
      attributes: input.attributes,
    });

    if (!updated) {
      throw new ProductNotFoundError();
    }
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: number }).code === 11000
    ) {
      const errKey = (error as { keyPattern?: Record<string, number> })
        .keyPattern;
      if (errKey?.sku) throw new DuplicateProductSkuError();
      if (errKey?.barcode) throw new DuplicateProductBarcodeError();
      throw new DuplicateProductSlugError();
    }
    throw error;
  }
}

export async function updateAdminProductStatus(
  productId: string,
  newStatus: ProductStatus,
): Promise<void> {
  await requireAdmin();
  assertValidProductId(productId);

  if (newStatus === "active") {
    const product = await findAdminProductDetail(productId);
    if (!product) throw new ProductNotFoundError();

    const category = await findCategoryById(product.categoryId);
    if (!category || category.status === "inactive") {
      throw new InactiveCategoryAssignmentError(
        "نمی‌توان محصول را فعال کرد زیرا دسته‌بندی والد آن غیرفعال است",
      );
    }
  }

  const updated = await updateProductStatus(productId, newStatus);
  if (!updated) {
    throw new ProductNotFoundError();
  }
}
