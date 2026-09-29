import "server-only";

import { requireAdmin } from "@/src/lib/admin-helpers";
import { adminEntityIdSchema } from "@/src/domain/schemas/admin-common";
import type { CafeStatus } from "@/src/domain/schemas/admin-cafe";
import {
  createPaginationMeta,
  type AdminPaginationMeta,
} from "@/src/lib/admin-query";
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
export class InvalidCafeIdError extends Error {}

// ---------------------------------------------------------------------------
// Pagination DTO
// ---------------------------------------------------------------------------

export type AdminCafeListDTO = {
  items: AdminCafeListItemDTO[];
  pagination: AdminPaginationMeta;
};

function assertValidCafeId(cafeId: string) {
  if (!adminEntityIdSchema.safeParse(cafeId).success) {
    throw new InvalidCafeIdError();
  }
}

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

  const { items, total } = await findAdminCafeList(query);

  return {
    items,
    pagination: createPaginationMeta(query.page, query.pageSize, total),
  };
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export async function getAdminCafeDetail(
  cafeId: string,
): Promise<AdminCafeDetailDTO> {
  await requireAdmin();
  assertValidCafeId(cafeId);

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
  assertValidCafeId(cafeId);

  const updated = await updateCafeStatus(cafeId, status);
  if (!updated) throw new CafeNotFoundError();
}
