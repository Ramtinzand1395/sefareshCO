import "server-only";

import { requireAdmin } from "@/src/lib/admin-helpers";
import type { UserStatus } from "@/src/domain/schemas/admin-user";
import {
  findAdminUserList,
  findAdminUserDetail,
  updateUserStatus,
  type AdminUserListItemDTO,
  type AdminUserDetailDTO,
} from "@/src/repositories/admin-user-repository";

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class UserNotFoundError extends Error {}
export class SelfStatusChangeError extends Error {}
export class StatusUpdateFailedError extends Error {}

// ---------------------------------------------------------------------------
// Pagination DTO
// ---------------------------------------------------------------------------

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type AdminUserListDTO = {
  items: AdminUserListItemDTO[];
  pagination: PaginationMeta;
};

// ---------------------------------------------------------------------------
// List users
// ---------------------------------------------------------------------------

export async function getAdminUserList(query: {
  page: number;
  pageSize: number;
  search?: string;
  status?: UserStatus;
  isAdmin?: boolean;
}): Promise<AdminUserListDTO> {
  await requireAdmin();

  const { items, total } = await findAdminUserList(query);

  const page = Math.max(1, query.page);
  const pageSize = Math.min(Math.max(1, query.pageSize), 50);
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
// User detail
// ---------------------------------------------------------------------------

export async function getAdminUserDetail(
  userId: string,
): Promise<AdminUserDetailDTO> {
  await requireAdmin();

  const user = await findAdminUserDetail(userId);
  if (!user) throw new UserNotFoundError();

  return user;
}

// ---------------------------------------------------------------------------
// Update status
// ---------------------------------------------------------------------------

export async function updateAdminUserStatus(
  userId: string,
  newStatus: UserStatus,
): Promise<void> {
  const admin = await requireAdmin();

  // Guard: admin cannot suspend/disable themselves
  if (admin.userId === userId) {
    if (newStatus === "suspended" || newStatus === "disabled") {
      throw new SelfStatusChangeError();
    }
  }

  // Verify target user exists
  const user = await findAdminUserDetail(userId);
  if (!user) throw new UserNotFoundError();

  const updated = await updateUserStatus(userId, newStatus);
  if (!updated) throw new StatusUpdateFailedError();
}
