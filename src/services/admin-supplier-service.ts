import "server-only";

import { requireAdmin } from "@/src/lib/admin-helpers";
import { adminEntityIdSchema } from "@/src/domain/schemas/admin-common";
import type {
  SupplierStatus,
  SupplierVerificationAction,
} from "@/src/domain/schemas/admin-supplier";
import {
  createPaginationMeta,
  type AdminPaginationMeta,
} from "@/src/lib/admin-query";
import {
  findAdminSupplierList,
  findAdminSupplierDetail,
  updateSupplierStatus,
  updateSupplierVerification,
  type AdminSupplierListItemDTO,
  type AdminSupplierDetailDTO,
} from "@/src/repositories/admin-supplier-repository";

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class SupplierNotFoundError extends Error {}
export class InvalidSupplierIdError extends Error {}

// ---------------------------------------------------------------------------
// Pagination DTO
// ---------------------------------------------------------------------------

export type AdminSupplierListDTO = {
  items: AdminSupplierListItemDTO[];
  pagination: AdminPaginationMeta;
};

function assertValidSupplierId(supplierId: string) {
  if (!adminEntityIdSchema.safeParse(supplierId).success) {
    throw new InvalidSupplierIdError();
  }
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function getAdminSupplierList(query: {
  page: number;
  pageSize: number;
  search?: string;
  status?: SupplierStatus;
  isVerified?: boolean;
}): Promise<AdminSupplierListDTO> {
  await requireAdmin();

  const { items, total } = await findAdminSupplierList(query);

  return {
    items,
    pagination: createPaginationMeta(query.page, query.pageSize, total),
  };
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export async function getAdminSupplierDetail(
  supplierId: string,
): Promise<AdminSupplierDetailDTO> {
  await requireAdmin();
  assertValidSupplierId(supplierId);

  const supplier = await findAdminSupplierDetail(supplierId);
  if (!supplier) throw new SupplierNotFoundError();

  return supplier;
}

// ---------------------------------------------------------------------------
// Update status
// ---------------------------------------------------------------------------

export async function updateAdminSupplierStatus(
  supplierId: string,
  status: SupplierStatus,
): Promise<void> {
  await requireAdmin();
  assertValidSupplierId(supplierId);

  const updated = await updateSupplierStatus(supplierId, status);
  if (!updated) throw new SupplierNotFoundError();
}

// ---------------------------------------------------------------------------
// Update verification
// ---------------------------------------------------------------------------

export async function updateAdminSupplierVerification(
  supplierId: string,
  action: SupplierVerificationAction,
): Promise<void> {
  const admin = await requireAdmin();
  assertValidSupplierId(supplierId);

  const isVerified = action === "verified";
  const updated = await updateSupplierVerification(
    supplierId,
    isVerified,
    admin.userId,
  );
  if (!updated) throw new SupplierNotFoundError();
}
