import "server-only";

import { requireAdmin } from "@/src/lib/admin-helpers";
import type {
  SupplierStatus,
  SupplierVerificationAction,
} from "@/src/domain/schemas/admin-supplier";
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
export class SupplierStatusUpdateFailedError extends Error {}
export class SupplierVerificationUpdateFailedError extends Error {}

// ---------------------------------------------------------------------------
// Pagination DTO
// ---------------------------------------------------------------------------

export type SupplierPaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type AdminSupplierListDTO = {
  items: AdminSupplierListItemDTO[];
  pagination: SupplierPaginationMeta;
};

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

  const page = Math.max(1, query.page);
  const pageSize = Math.min(Math.max(1, query.pageSize), 50);

  const { items, total } = await findAdminSupplierList({
    ...query,
    page,
    pageSize,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export async function getAdminSupplierDetail(
  supplierId: string,
): Promise<AdminSupplierDetailDTO> {
  await requireAdmin();

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

  const supplier = await findAdminSupplierDetail(supplierId);
  if (!supplier) throw new SupplierNotFoundError();

  const updated = await updateSupplierStatus(supplierId, status);
  if (!updated) throw new SupplierStatusUpdateFailedError();
}

// ---------------------------------------------------------------------------
// Update verification
// ---------------------------------------------------------------------------

export async function updateAdminSupplierVerification(
  supplierId: string,
  action: SupplierVerificationAction,
): Promise<void> {
  const admin = await requireAdmin();

  const supplier = await findAdminSupplierDetail(supplierId);
  if (!supplier) throw new SupplierNotFoundError();

  const isVerified = action === "verified";
  const updated = await updateSupplierVerification(
    supplierId,
    isVerified,
    admin.userId,
  );
  if (!updated) throw new SupplierVerificationUpdateFailedError();
}
