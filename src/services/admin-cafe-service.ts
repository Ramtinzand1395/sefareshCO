import "server-only";

import { requireAdmin } from "@/src/lib/admin-helpers";
import type { CafeStatus } from "@/src/domain/schemas/admin-cafe";
import {
  findAdminCafeList,
  findAdminCafeDetail,
  updateCafeStatus,
  type AdminCafeListItemDTO,
  type AdminCafeDetailDTO,
} from "@/src/repositories/admin-cafe-repository";

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class CafeNotFoundError extends Error {}
export class CafeStatusUpdateFailedError extends Error {}

// ---------------------------------------------------------------------------
// Pagination DTO
// ---------------------------------------------------------------------------

export type CafePaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type AdminCafeListDTO = {
  items: AdminCafeListItemDTO[];
  pagination: CafePaginationMeta;
};

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function getAdminCafeList(query: {
  page: number;
  pageSize: number;
  search?: string;
  status?: CafeStatus;
}): Promise<AdminCafeListDTO> {
  await requireAdmin();

  const page = Math.max(1, query.page);
  const pageSize = Math.min(Math.max(1, query.pageSize), 50);

  const { items, total } = await findAdminCafeList({ ...query, page, pageSize });

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

export async function getAdminCafeDetail(
  cafeId: string,
): Promise<AdminCafeDetailDTO> {
  await requireAdmin();

  const cafe = await findAdminCafeDetail(cafeId);
  if (!cafe) throw new CafeNotFoundError();

  return cafe;
}

// ---------------------------------------------------------------------------
// Update status
// ---------------------------------------------------------------------------

export async function updateAdminCafeStatus(
  cafeId: string,
  status: CafeStatus,
): Promise<void> {
  await requireAdmin();

  const cafe = await findAdminCafeDetail(cafeId);
  if (!cafe) throw new CafeNotFoundError();

  const updated = await updateCafeStatus(cafeId, status);
  if (!updated) throw new CafeStatusUpdateFailedError();
}
