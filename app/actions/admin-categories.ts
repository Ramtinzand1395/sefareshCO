"use server";

import { revalidatePath } from "next/cache";

import {
  createCategorySchema,
  updateCategorySchema,
  updateCategoryStatusSchema,
} from "@/src/domain/schemas/admin-catalog";
import { requireAdmin } from "@/src/lib/admin-helpers";
import {
  CategoryCycleError,
  CategoryHasActiveProductsError,
  CategoryNotFoundError,
  createAdminCategory,
  DuplicateCategoryNameError,
  DuplicateCategorySlugError,
  InvalidCategoryIdError,
  InvalidParentCategoryError,
  updateAdminCategory,
  updateAdminCategoryStatus,
} from "@/src/services/admin-category-service";

export type AdminCategoryActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  createdId?: string;
};

// ---------------------------------------------------------------------------
// Create category action
// ---------------------------------------------------------------------------

export async function createCategoryAction(
  _state: AdminCategoryActionState,
  formData: FormData,
): Promise<AdminCategoryActionState> {
  await requireAdmin();

  const rawParentId = formData.get("parentId");
  const parsed = createCategorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    parentId:
      typeof rawParentId === "string" && rawParentId.trim().length > 0
        ? rawParentId.trim()
        : null,
    displayOrder: formData.get("displayOrder") ?? 0,
    icon: formData.get("icon"),
    image: formData.get("image"),
    status: formData.get("status") || "active",
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const createdId = await createAdminCategory(parsed.data);
    revalidatePath("/admin/catalog/categories");
    revalidatePath("/admin/catalog/products");
    revalidatePath("/admin");
    return { ok: true, createdId };
  } catch (error) {
    if (error instanceof DuplicateCategorySlugError) {
      return {
        fieldErrors: {
          slug: [error.message],
        },
      };
    }
    if (error instanceof DuplicateCategoryNameError) {
      return {
        fieldErrors: {
          name: [error.message],
        },
      };
    }
    if (error instanceof InvalidParentCategoryError) {
      return {
        fieldErrors: {
          parentId: [error.message],
        },
      };
    }
    return { error: "خطایی در ثبت دسته‌بندی رخ داد؛ لطفاً دوباره تلاش کنید" };
  }
}

// ---------------------------------------------------------------------------
// Update category action
// ---------------------------------------------------------------------------

export async function updateCategoryAction(
  _state: AdminCategoryActionState,
  formData: FormData,
): Promise<AdminCategoryActionState> {
  await requireAdmin();

  const rawParentId = formData.get("parentId");
  const parsed = updateCategorySchema.safeParse({
    categoryId: formData.get("categoryId"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    parentId:
      typeof rawParentId === "string" && rawParentId.trim().length > 0
        ? rawParentId.trim()
        : null,
    displayOrder: formData.get("displayOrder") ?? 0,
    icon: formData.get("icon"),
    image: formData.get("image"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await updateAdminCategory(parsed.data);
    revalidatePath("/admin/catalog/categories");
    revalidatePath(`/admin/catalog/categories/${parsed.data.categoryId}`);
    revalidatePath("/admin/catalog/products");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      return { error: error.message };
    }
    if (error instanceof DuplicateCategorySlugError) {
      return {
        fieldErrors: {
          slug: [error.message],
        },
      };
    }
    if (error instanceof DuplicateCategoryNameError) {
      return {
        fieldErrors: {
          name: [error.message],
        },
      };
    }
    if (error instanceof CategoryCycleError) {
      return {
        fieldErrors: {
          parentId: [error.message],
        },
      };
    }
    if (error instanceof InvalidParentCategoryError) {
      return {
        fieldErrors: {
          parentId: [error.message],
        },
      };
    }
    if (error instanceof CategoryHasActiveProductsError) {
      return {
        error: error.message,
      };
    }
    if (error instanceof InvalidCategoryIdError) {
      return { error: error.message };
    }
    return { error: "خطای غیرمنتظره در ویرایش دسته‌بندی؛ لطفاً دوباره تلاش کنید" };
  }
}

// ---------------------------------------------------------------------------
// Update category status action
// ---------------------------------------------------------------------------

export async function updateCategoryStatusAction(
  _state: AdminCategoryActionState,
  formData: FormData,
): Promise<AdminCategoryActionState> {
  await requireAdmin();

  const parsed = updateCategoryStatusSchema.safeParse({
    categoryId: formData.get("categoryId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await updateAdminCategoryStatus(parsed.data.categoryId, parsed.data.status);
    revalidatePath("/admin/catalog/categories");
    revalidatePath(`/admin/catalog/categories/${parsed.data.categoryId}`);
    revalidatePath("/admin/catalog/products");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      return { error: error.message };
    }
    if (error instanceof CategoryHasActiveProductsError) {
      return { error: error.message };
    }
    return { error: "خطای غیرمنتظره؛ لطفاً دوباره تلاش کنید" };
  }
}
