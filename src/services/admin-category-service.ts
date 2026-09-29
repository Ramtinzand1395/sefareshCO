import "server-only";

import { adminEntityIdSchema } from "@/src/domain/schemas/admin-common";
import type {
  CategoryStatus,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/src/domain/schemas/admin-catalog";
import { requireAdmin } from "@/src/lib/admin-helpers";
import {
  createPaginationMeta,
  type AdminPaginationMeta,
} from "@/src/lib/admin-query";
import {
  countCategoryActiveProducts,
  createCategory,
  findAdminCategoryDetail,
  findAdminCategoryList,
  findAdminCategorySimpleList,
  findCategoryById,
  findCategoryByName,
  findCategoryBySlug,
  findCategoryDescendantIds,
  updateCategory,
  updateCategoryStatus,
  type AdminCategoryDetailDTO,
  type AdminCategoryListItemDTO,
  type AdminCategorySimpleDTO,
} from "@/src/repositories/admin-category-repository";

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

export class CategoryNotFoundError extends Error {
  constructor(message = "دسته‌بندی مورد نظر یافت نشد") {
    super(message);
    this.name = "CategoryNotFoundError";
  }
}

export class DuplicateCategorySlugError extends Error {
  constructor(message = "این نامک (slug) قبلاً برای دسته‌بندی دیگری استفاده شده است") {
    super(message);
    this.name = "DuplicateCategorySlugError";
  }
}

export class DuplicateCategoryNameError extends Error {
  constructor(message = "دسته‌بندی با این نام در این سطح از قبل وجود دارد") {
    super(message);
    this.name = "DuplicateCategoryNameError";
  }
}

export class CategoryCycleError extends Error {
  constructor(message = "چرخه در ساختار دسته‌بندی مجاز نیست؛ نمی‌توانید دسته یا فرزندان آن را به عنوان والد انتخاب کنید") {
    super(message);
    this.name = "CategoryCycleError";
  }
}

export class InvalidParentCategoryError extends Error {
  constructor(message = "دسته‌بندی والد انتخاب‌شده وجود ندارد یا غیرفعال است") {
    super(message);
    this.name = "InvalidParentCategoryError";
  }
}

export class CategoryHasActiveProductsError extends Error {
  constructor(message = "امکان غیرفعال‌سازی این دسته‌بندی وجود ندارد زیرا دارای محصولات فعال است") {
    super(message);
    this.name = "CategoryHasActiveProductsError";
  }
}

export class InvalidCategoryIdError extends Error {
  constructor(message = "شناسه دسته‌بندی معتبر نیست") {
    super(message);
    this.name = "InvalidCategoryIdError";
  }
}

// ---------------------------------------------------------------------------
// Pagination DTO
// ---------------------------------------------------------------------------

export type AdminCategoryListDTO = {
  items: AdminCategoryListItemDTO[];
  pagination: AdminPaginationMeta;
};

function assertValidCategoryId(categoryId: string) {
  if (!adminEntityIdSchema.safeParse(categoryId).success) {
    throw new InvalidCategoryIdError();
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getAdminCategoryList(query: {
  page: number;
  pageSize: number;
  search?: string;
  status?: CategoryStatus;
  parentId?: string | null;
}): Promise<AdminCategoryListDTO> {
  await requireAdmin();

  const { items, total } = await findAdminCategoryList(query);

  return {
    items,
    pagination: createPaginationMeta(query.page, query.pageSize, total),
  };
}

export async function getAdminCategorySimpleList(): Promise<
  AdminCategorySimpleDTO[]
> {
  await requireAdmin();
  return findAdminCategorySimpleList();
}

export async function getAdminCategoryDetail(
  categoryId: string,
): Promise<AdminCategoryDetailDTO> {
  await requireAdmin();
  assertValidCategoryId(categoryId);

  const category = await findAdminCategoryDetail(categoryId);
  if (!category) throw new CategoryNotFoundError();

  return category;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createAdminCategory(
  input: CreateCategoryInput,
): Promise<string> {
  await requireAdmin();

  const slug = input.slug.trim().toLowerCase();
  const name = input.name.trim();

  // 1. Check duplicate slug
  const existingBySlug = await findCategoryBySlug(slug);
  if (existingBySlug) {
    throw new DuplicateCategorySlugError();
  }

  // 2. Check duplicate name under the same parent
  const existingByName = await findCategoryByName(name, input.parentId);
  if (existingByName) {
    throw new DuplicateCategoryNameError();
  }

  // 3. Check parent validity if provided
  if (input.parentId) {
    const parent = await findCategoryById(input.parentId);
    if (!parent) {
      throw new InvalidParentCategoryError();
    }
  }

  try {
    return await createCategory({
      name,
      slug,
      description: input.description,
      parentId: input.parentId,
      displayOrder: input.displayOrder,
      icon: input.icon,
      image: input.image,
      status: input.status,
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: number }).code === 11000
    ) {
      throw new DuplicateCategorySlugError();
    }
    throw error;
  }
}

export async function updateAdminCategory(
  input: UpdateCategoryInput,
): Promise<void> {
  await requireAdmin();
  assertValidCategoryId(input.categoryId);

  const existing = await findCategoryById(input.categoryId);
  if (!existing) {
    throw new CategoryNotFoundError();
  }

  const slug = input.slug.trim().toLowerCase();
  const name = input.name.trim();

  // 1. Duplicate slug check (excluding self)
  const existingBySlug = await findCategoryBySlug(slug, input.categoryId);
  if (existingBySlug) {
    throw new DuplicateCategorySlugError();
  }

  // 2. Duplicate name check (excluding self, under same parent)
  const existingByName = await findCategoryByName(
    name,
    input.parentId,
    input.categoryId,
  );
  if (existingByName) {
    throw new DuplicateCategoryNameError();
  }

  // 3. Parent validations & Cycle prevention
  if (input.parentId) {
    // Cannot be parent of itself
    if (input.parentId === input.categoryId) {
      throw new CategoryCycleError("یک دسته‌بندی نمی‌تواند والد خودش باشد");
    }

    // Verify parent exists
    const parent = await findCategoryById(input.parentId);
    if (!parent) {
      throw new InvalidParentCategoryError();
    }

    // Check if new parent is a descendant of this category
    const descendantIds = await findCategoryDescendantIds(input.categoryId);
    if (descendantIds.includes(input.parentId)) {
      throw new CategoryCycleError(
        "نمی‌توانید یکی از زیردسته‌های این دسته‌بندی را به عنوان والد آن انتخاب کنید",
      );
    }
  }

  // 4. Inactivation check: cannot deactivate if active products exist
  if (input.status === "inactive" && existing.status === "active") {
    const activeProducts = await countCategoryActiveProducts(input.categoryId);
    if (activeProducts > 0) {
      throw new CategoryHasActiveProductsError();
    }
  }

  try {
    const updated = await updateCategory(input.categoryId, {
      name,
      slug,
      description: input.description,
      parentId: input.parentId,
      displayOrder: input.displayOrder,
      icon: input.icon,
      image: input.image,
      status: input.status,
    });

    if (!updated) {
      throw new CategoryNotFoundError();
    }
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: number }).code === 11000
    ) {
      throw new DuplicateCategorySlugError();
    }
    throw error;
  }
}

export async function updateAdminCategoryStatus(
  categoryId: string,
  newStatus: CategoryStatus,
): Promise<void> {
  await requireAdmin();
  assertValidCategoryId(categoryId);

  const existing = await findCategoryById(categoryId);
  if (!existing) {
    throw new CategoryNotFoundError();
  }

  if (newStatus === "inactive" && existing.status === "active") {
    const activeProducts = await countCategoryActiveProducts(categoryId);
    if (activeProducts > 0) {
      throw new CategoryHasActiveProductsError();
    }
  }

  const updated = await updateCategoryStatus(categoryId, newStatus);
  if (!updated) {
    throw new CategoryNotFoundError();
  }
}
