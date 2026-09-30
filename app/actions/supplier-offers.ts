"use server";

import { revalidatePath } from "next/cache";

import {
  createSupplierOfferSchema,
  updateOfferStatusSchema,
  updateSupplierOfferSchema,
} from "@/src/domain/schemas/supplier-offer";
import {
  createMyOffer,
  DuplicateOfferError,
  InvalidOfferInputError,
  InvalidProductForOfferError,
  OfferNotFoundError,
  OfferPermissionError,
  SupplierAuthError,
  toggleMyOfferStatus,
  updateMyOffer,
} from "@/src/services/supplier-offer-service";

export type SupplierOfferActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  createdId?: string;
};

const REVALIDATE_PATHS = ["/supplier/products"];

function revalidateOfferPaths() {
  for (const p of REVALIDATE_PATHS) {
    revalidatePath(p);
  }
}

function handleServiceError(error: unknown): SupplierOfferActionState {
  if (error instanceof SupplierAuthError) {
    return { error: error.message };
  }
  if (error instanceof OfferPermissionError) {
    return { error: error.message };
  }
  if (error instanceof InvalidProductForOfferError) {
    return { fieldErrors: { productId: [error.message] } };
  }
  if (error instanceof DuplicateOfferError) {
    return { fieldErrors: { productId: [error.message] } };
  }
  if (error instanceof OfferNotFoundError) {
    return { error: error.message };
  }
  if (error instanceof InvalidOfferInputError) {
    return { error: error.message };
  }
  return { error: "خطای غیرمنتظره در ثبت عرضه؛ لطفاً دوباره تلاش کنید" };
}

// ---------------------------------------------------------------------------
// Create Supplier Offer
// ---------------------------------------------------------------------------

export async function createOfferAction(
  _state: SupplierOfferActionState,
  formData: FormData,
): Promise<SupplierOfferActionState> {
  const parsed = createSupplierOfferSchema.safeParse({
    productId: formData.get("productId"),
    price: formData.get("price"),
    stock: formData.get("stock"),
    minOrderQuantity: formData.get("minOrderQuantity"),
    deliveryDays: formData.get("deliveryDays"),
    status: formData.get("status") || "inactive",
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const createdId = await createMyOffer(parsed.data);
    revalidateOfferPaths();
    return { ok: true, createdId };
  } catch (error) {
    return handleServiceError(error);
  }
}

// ---------------------------------------------------------------------------
// Update Supplier Offer
// ---------------------------------------------------------------------------

export async function updateOfferAction(
  _state: SupplierOfferActionState,
  formData: FormData,
): Promise<SupplierOfferActionState> {
  const parsed = updateSupplierOfferSchema.safeParse({
    offerId: formData.get("offerId"),
    price: formData.get("price"),
    stock: formData.get("stock"),
    minOrderQuantity: formData.get("minOrderQuantity"),
    deliveryDays: formData.get("deliveryDays"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await updateMyOffer(parsed.data);
    revalidateOfferPaths();
    return { ok: true };
  } catch (error) {
    return handleServiceError(error);
  }
}

// ---------------------------------------------------------------------------
// Toggle Supplier Offer Status
// ---------------------------------------------------------------------------

export async function toggleOfferStatusAction(
  _state: SupplierOfferActionState,
  formData: FormData,
): Promise<SupplierOfferActionState> {
  const parsed = updateOfferStatusSchema.safeParse({
    offerId: formData.get("offerId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await toggleMyOfferStatus(parsed.data.offerId, parsed.data.status);
    revalidateOfferPaths();
    return { ok: true };
  } catch (error) {
    return handleServiceError(error);
  }
}
