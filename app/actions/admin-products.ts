"use server";

import { revalidatePath } from "next/cache";

import {
  createProductSchema,
  updateProductSchema,
  updateProductStatusSchema,
} from "@/src/domain/schemas/admin-catalog";
import { requireAdmin } from "@/src/lib/admin-helpers";
import {
  CategoryForProductNotFoundError,
  createAdminProduct,
  DuplicateProductBarcodeError,
  DuplicateProductSkuError,
  DuplicateProductSlugError,
  InactiveCategoryAssignmentError,
  ProductNotFoundError,
  updateAdminProduct,
  updateAdminProductStatus,
} from "@/src/services/admin-product-service";

export type AdminProductActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  createdId?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseAttributes(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseImages(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((item) => typeof item === "string");
  } catch {
    // If not JSON, try newline or comma-separated
    return raw
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Create product action
// ---------------------------------------------------------------------------

export async function createProductAction(
  _state: AdminProductActionState,
  formData: FormData,
): Promise<AdminProductActionState> {
  await requireAdmin();

  const parsed = createProductSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    categoryId: formData.get("categoryId"),
    brand: formData.get("brand"),
    unit: formData.get("unit"),
    description: formData.get("description"),
    barcode: formData.get("barcode"),
    sku: formData.get("sku"),
    status: formData.get("status") || "draft",
    images: parseImages(formData.get("images")),
    attributes: parseAttributes(formData.get("attributes")),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const createdId = await createAdminProduct(parsed.data);
    revalidatePath("/admin/catalog/products");
    revalidatePath("/admin/catalog/categories");
    revalidatePath("/admin");
    return { ok: true, createdId };
  } catch (error) {
    if (error instanceof DuplicateProductSlugError) {
      return { fieldErrors: { slug: [error.message] } };
    }
    if (error instanceof DuplicateProductSkuError) {
      return { fieldErrors: { sku: [error.message] } };
    }
    if (error instanceof DuplicateProductBarcodeError) {
      return { fieldErrors: { barcode: [error.message] } };
    }
    if (error instanceof CategoryForProductNotFoundError) {
      return { fieldErrors: { categoryId: [error.message] } };
    }
    if (error instanceof InactiveCategoryAssignmentError) {
      return { fieldErrors: { categoryId: [error.message] } };
    }
    return { error: "خطایی در ثبت محصول رخ داد؛ لطفاً دوباره تلاش کنید" };
  }
}

// ---------------------------------------------------------------------------
// Update product action
// ---------------------------------------------------------------------------

export async function updateProductAction(
  _state: AdminProductActionState,
  formData: FormData,
): Promise<AdminProductActionState> {
  await requireAdmin();

  const parsed = updateProductSchema.safeParse({
    productId: formData.get("productId"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    categoryId: formData.get("categoryId"),
    brand: formData.get("brand"),
    unit: formData.get("unit"),
    description: formData.get("description"),
    barcode: formData.get("barcode"),
    sku: formData.get("sku"),
    status: formData.get("status"),
    images: parseImages(formData.get("images")),
    attributes: parseAttributes(formData.get("attributes")),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await updateAdminProduct(parsed.data);
    revalidatePath("/admin/catalog/products");
    revalidatePath(`/admin/catalog/products/${parsed.data.productId}`);
    revalidatePath("/admin/catalog/categories");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      return { error: error.message };
    }
    if (error instanceof DuplicateProductSlugError) {
      return { fieldErrors: { slug: [error.message] } };
    }
    if (error instanceof DuplicateProductSkuError) {
      return { fieldErrors: { sku: [error.message] } };
    }
    if (error instanceof DuplicateProductBarcodeError) {
      return { fieldErrors: { barcode: [error.message] } };
    }
    if (error instanceof CategoryForProductNotFoundError) {
      return { fieldErrors: { categoryId: [error.message] } };
    }
    if (error instanceof InactiveCategoryAssignmentError) {
      return { fieldErrors: { categoryId: [error.message] } };
    }
    return { error: "خطایی در ویرایش محصول رخ داد؛ لطفاً دوباره تلاش کنید" };
  }
}

// ---------------------------------------------------------------------------
// Update product status action
// ---------------------------------------------------------------------------

export async function updateProductStatusAction(
  _state: AdminProductActionState,
  formData: FormData,
): Promise<AdminProductActionState> {
  await requireAdmin();

  const parsed = updateProductStatusSchema.safeParse({
    productId: formData.get("productId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await updateAdminProductStatus(parsed.data.productId, parsed.data.status);
    revalidatePath("/admin/catalog/products");
    revalidatePath(`/admin/catalog/products/${parsed.data.productId}`);
    revalidatePath("/admin/catalog/categories");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      return { error: error.message };
    }
    if (error instanceof InactiveCategoryAssignmentError) {
      return { error: error.message };
    }
    return { error: "خطای غیرمنتظره؛ لطفاً دوباره تلاش کنید" };
  }
}
