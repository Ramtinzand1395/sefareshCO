import "server-only";

import {
  createSupplierOfferSchema,
  offerEntityIdSchema,
  supplierOfferQuerySchema,
  updateOfferStatusSchema,
  updateSupplierOfferSchema,
} from "@/src/domain/schemas/supplier-offer";
import type {
  CreateSupplierOfferInput,
  OfferStatus,
  SupplierOfferQueryInput,
  UpdateSupplierOfferInput,
} from "@/src/domain/schemas/supplier-offer";
import { getCurrentSupplierIdentity } from "@/src/lib/auth-helpers";
import {
  createPaginationMeta,
  type AdminPaginationMeta,
} from "@/src/lib/admin-query";
import { findAdminProductDetail } from "@/src/repositories/admin-product-repository";
import {
  createSupplierOffer,
  findActiveProductsForOffer,
  findEligibleOffersForProduct,
  findOfferBySupplierAndProduct,
  findSupplierOfferById,
  findSupplierOfferList,
  isCategoryBranchActive,
  updateSupplierOffer,
  updateSupplierOfferStatus,
  type EligibleOfferDTO,
  type SupplierOfferDetailDTO,
  type SupplierOfferListItemDTO,
} from "@/src/repositories/supplier-offer-repository";

// ---------------------------------------------------------------------------
// Domain Errors
// ---------------------------------------------------------------------------

export class SupplierAuthError extends Error {
  constructor(message = "دسترسی به پنل تأمین‌کننده ممکن نیست؛ لطفاً وارد شوید") {
    super(message);
    this.name = "SupplierAuthError";
  }
}

export class OfferPermissionError extends Error {
  constructor(message = "دسترسی لازم برای مدیریت عرضه‌ها (canManageOffers) را ندارید") {
    super(message);
    this.name = "OfferPermissionError";
  }
}

export class OfferNotFoundError extends Error {
  constructor(message = "عرضه مورد نظر یافت نشد") {
    super(message);
    this.name = "OfferNotFoundError";
  }
}

export class DuplicateOfferError extends Error {
  constructor(message = "شما قبلاً برای این محصول یک عرضه ثبت کرده‌اید") {
    super(message);
    this.name = "DuplicateOfferError";
  }
}

export class InvalidProductForOfferError extends Error {
  constructor(
    message = "محصول انتخاب‌شده فعال نیست یا دسته‌بندی آن غیرفعال است",
  ) {
    super(message);
    this.name = "InvalidProductForOfferError";
  }
}

export class InvalidOfferInputError extends Error {
  constructor(message = "اطلاعات ورودی عرضه نامعتبر است") {
    super(message);
    this.name = "InvalidOfferInputError";
  }
}

// ---------------------------------------------------------------------------
// Authorization Guard: identity resolved server-side from active session
// ---------------------------------------------------------------------------

export async function requireSupplierOfferAccess() {
  const identity = await getCurrentSupplierIdentity();
  if (!identity) throw new SupplierAuthError();
  if (!identity.permissions.canManageOffers) throw new OfferPermissionError();
  return identity;
}

// ---------------------------------------------------------------------------
// Product eligibility check (Active product & entire active category ancestor branch)
// ---------------------------------------------------------------------------

async function assertProductEligibleForOffer(productId: string) {
  const product = await findAdminProductDetail(productId);
  if (!product || product.status !== "active") {
    throw new InvalidProductForOfferError(
      "محصول انتخاب‌شده در کاتالوگ فعال نیست یا حذف شده است",
    );
  }

  const isBranchActive = await isCategoryBranchActive(product.categoryId);
  if (!isBranchActive) {
    throw new InvalidProductForOfferError(
      "دسته‌بندی این محصول یا یکی از دسته‌بندی‌های والد آن غیرفعال است",
    );
  }
}

// ---------------------------------------------------------------------------
// DTO & Pagination
// ---------------------------------------------------------------------------

export type SupplierOfferListDTO = {
  items: SupplierOfferListItemDTO[];
  pagination: AdminPaginationMeta;
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getMyOfferList(
  query: SupplierOfferQueryInput,
): Promise<SupplierOfferListDTO> {
  const identity = await requireSupplierOfferAccess();

  // Re-validate query input with Zod in Service
  const validatedQuery = supplierOfferQuerySchema.parse(query);

  const { items, total } = await findSupplierOfferList(
    identity.supplierId,
    validatedQuery,
  );

  return {
    items,
    pagination: createPaginationMeta(
      validatedQuery.page,
      validatedQuery.pageSize,
      total,
    ),
  };
}

export async function getMyOfferDetail(
  offerId: string,
): Promise<SupplierOfferDetailDTO> {
  const identity = await requireSupplierOfferAccess();

  const validatedOfferId = offerEntityIdSchema.safeParse(offerId);
  if (!validatedOfferId.success) {
    throw new OfferNotFoundError(); // Do not reveal invalid id vs not found
  }

  const offer = await findSupplierOfferById(
    validatedOfferId.data,
    identity.supplierId,
  );
  if (!offer) throw new OfferNotFoundError();

  return offer;
}

export async function getActiveProductsForOfferSearch(
  search: string,
): Promise<
  Array<{ id: string; name: string; unit: string; categoryName?: string }>
> {
  await requireSupplierOfferAccess();
  return findActiveProductsForOffer(search.trim().slice(0, 100), 20);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createMyOffer(
  rawInput: CreateSupplierOfferInput,
): Promise<string> {
  const identity = await requireSupplierOfferAccess();

  // 1. Re-validate input in Service with Zod
  const parsed = createSupplierOfferSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new InvalidOfferInputError(
      parsed.error.issues.map((e) => e.message).join("، "),
    );
  }
  const input = parsed.data;

  // 2. Assert product & category branch eligibility
  await assertProductEligibleForOffer(input.productId);

  // 3. Pre-check duplicate (for immediate friendly error)
  const existing = await findOfferBySupplierAndProduct(
    identity.supplierId,
    input.productId,
  );
  if (existing) throw new DuplicateOfferError();

  // 4. Create offer with 11000 duplicate handling
  try {
    return await createSupplierOffer({
      supplierId: identity.supplierId,
      productId: input.productId,
      price: input.price,
      stock: input.stock,
      minOrderQuantity: input.minOrderQuantity,
      deliveryDays: input.deliveryDays,
      status: input.status,
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: number }).code === 11000
    ) {
      throw new DuplicateOfferError();
    }
    throw error;
  }
}

export async function updateMyOffer(
  rawInput: UpdateSupplierOfferInput,
): Promise<void> {
  const identity = await requireSupplierOfferAccess();

  // 1. Re-validate input in Service with Zod
  const parsed = updateSupplierOfferSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new InvalidOfferInputError(
      parsed.error.issues.map((e) => e.message).join("، "),
    );
  }
  const input = parsed.data;

  // 2. Verify ownership (strictly scoped to this supplier)
  const offer = await findSupplierOfferById(input.offerId, identity.supplierId);
  if (!offer) throw new OfferNotFoundError();

  // 3. Note: productId is strictly immutable and cannot be updated

  const updated = await updateSupplierOffer(
    input.offerId,
    identity.supplierId,
    {
      price: input.price,
      stock: input.stock,
      minOrderQuantity: input.minOrderQuantity,
      deliveryDays: input.deliveryDays,
    },
  );

  if (!updated) throw new OfferNotFoundError();
}

export async function toggleMyOfferStatus(
  offerId: string,
  newStatus: OfferStatus,
): Promise<void> {
  const identity = await requireSupplierOfferAccess();

  // 1. Re-validate input in Service with Zod
  const parsed = updateOfferStatusSchema.safeParse({ offerId, status: newStatus });
  if (!parsed.success) {
    throw new InvalidOfferInputError("شناسه عرضه یا وضعیت نامعتبر است");
  }

  // 2. Fetch existing offer under current supplier
  const offer = await findSupplierOfferById(offerId, identity.supplierId);
  if (!offer) throw new OfferNotFoundError();

  // 3. If activating, re-verify product & category validity
  if (newStatus === "active") {
    await assertProductEligibleForOffer(offer.productId);
  }
  // Note: if deactivating, allow deactivation even if product became inactive

  const updated = await updateSupplierOfferStatus(
    offerId,
    identity.supplierId,
    newStatus,
  );

  if (!updated) throw new OfferNotFoundError();
}

// ---------------------------------------------------------------------------
// Common eligibility check for buyer-facing / RFQ consumption
// ---------------------------------------------------------------------------

export async function getEligibleOffersForBuyer(
  productId: string,
): Promise<EligibleOfferDTO[]> {
  const validated = offerEntityIdSchema.safeParse(productId);
  if (!validated.success) return [];
  return findEligibleOffersForProduct(validated.data);
}
