import "server-only";

import { requireAdmin } from "@/src/lib/admin-helpers";
import { adminEntityIdSchema } from "@/src/domain/schemas/admin-common";
import type { UserStatus } from "@/src/domain/schemas/admin-user";
import {
  createPaginationMeta,
  type AdminPaginationMeta,
} from "@/src/lib/admin-query";
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
export class InvalidUserIdError extends Error {}
export class SelfStatusChangeError extends Error {}

// ---------------------------------------------------------------------------
// Pagination DTO
// ---------------------------------------------------------------------------

export type AdminUserListDTO = {
  items: AdminUserListItemDTO[];
  pagination: AdminPaginationMeta;
};

function assertValidUserId(userId: string) {
  if (!adminEntityIdSchema.safeParse(userId).success) {
    throw new InvalidUserIdError();
  }
}

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

  return {
    items,
    pagination: createPaginationMeta(query.page, query.pageSize, total),
  };
}

// ---------------------------------------------------------------------------
// User detail
// ---------------------------------------------------------------------------

export async function getAdminUserDetail(
  userId: string,
): Promise<AdminUserDetailDTO> {
  await requireAdmin();
  assertValidUserId(userId);

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
  assertValidUserId(userId);

  // Guard: admin cannot suspend/disable themselves
  if (admin.userId === userId) {
    if (newStatus === "suspended" || newStatus === "disabled") {
      throw new SelfStatusChangeError();
    }
  }

  const updated = await updateUserStatus(userId, newStatus);
  if (!updated) throw new UserNotFoundError();
}
