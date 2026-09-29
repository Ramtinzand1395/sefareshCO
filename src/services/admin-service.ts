import "server-only";

import type {
  AdminDashboardDto,
  AdminMembershipDto,
  AdminUserDetailDto,
  AdminUserListDto,
  AdminUserListQuery,
} from "@/src/domain/admin";
import {
  findAdminUserDetail,
  getAdminDashboardRecord,
  listAdminUsers,
} from "@/src/repositories/admin-repository";
import { findUserById } from "@/src/repositories/user-repository";

export class AdminAccessDeniedError extends Error {}

async function assertActiveAdmin(actorUserId: string) {
  const actor = await findUserById(actorUserId);
  if (!actor?.isAdmin || actor.status !== "active") {
    throw new AdminAccessDeniedError("ADMIN_ACCESS_DENIED");
  }
}

function toIso(value?: Date | null) {
  return value?.toISOString();
}

function displayName(input: {
  firstName?: string;
  lastName?: string;
  email?: string;
}) {
  return (
    [input.firstName, input.lastName].filter(Boolean).join(" ") ||
    input.email ||
    "کاربر بدون نام"
  );
}

export async function getAdminDashboard(
  actorUserId: string,
): Promise<AdminDashboardDto> {
  await assertActiveAdmin(actorUserId);
  const record = await getAdminDashboardRecord();

  const recentActivity: AdminDashboardDto["recentActivity"] = [
    ...record.recentUsers.map((user) => ({
      id: `user-${user._id.toString()}`,
      type: "user" as const,
      title: displayName(user),
      description: "کاربر جدید به سامانه پیوست",
      happenedAt: toIso(user.createdAt) ?? new Date(0).toISOString(),
      href: `/admin/users/${user._id.toString()}`,
    })),
    ...record.recentCafes.map((cafe) => ({
      id: `cafe-${cafe._id.toString()}`,
      type: "cafe" as const,
      title: cafe.name || "کافه بدون نام",
      description: cafe.city ? `کافه جدید در ${cafe.city}` : "کافه جدید ثبت شد",
      happenedAt: toIso(cafe.createdAt) ?? new Date(0).toISOString(),
    })),
    ...record.recentSuppliers.map((supplier) => ({
      id: `supplier-${supplier._id.toString()}`,
      type: "supplier" as const,
      title: supplier.businessName || "تأمین‌کننده بدون نام",
      description: supplier.city
        ? `تأمین‌کننده جدید در ${supplier.city}`
        : "تأمین‌کننده جدید ثبت شد",
      happenedAt: toIso(supplier.createdAt) ?? new Date(0).toISOString(),
    })),
  ]
    .sort((a, b) => b.happenedAt.localeCompare(a.happenedAt))
    .slice(0, 8);

  return {
    generatedAt: new Date().toISOString(),
    metrics: record.counts,
    recentActivity,
  };
}

export async function getAdminUsers(
  actorUserId: string,
  query: AdminUserListQuery,
): Promise<AdminUserListDto> {
  await assertActiveAdmin(actorUserId);
  const result = await listAdminUsers(query);
  return {
    items: result.items.map((user) => ({
      id: user.id,
      displayName: displayName(user),
      email: user.email,
      mobile: user.mobile,
      status: user.status,
      onboardingCompleted: user.onboardingCompleted,
      isAdmin: user.isAdmin,
      hasCafeMembership: user.cafeMembershipCount > 0,
      hasSupplierMembership: user.supplierMembershipCount > 0,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: toIso(user.lastLoginAt),
    })),
    total: result.total,
    totalPages: Math.max(1, Math.ceil(result.total / query.pageSize)),
    page: query.page,
    pageSize: query.pageSize,
  };
}

function toMembershipDto(
  membership: {
    id: string;
    role: string;
    status: string;
    joinedAt?: Date;
  },
  business: { id: string; name: string; status: string },
): AdminMembershipDto {
  return {
    id: membership.id,
    businessId: business.id,
    businessName: business.name,
    businessStatus: business.status,
    role: membership.role,
    status: membership.status,
    joinedAt: toIso(membership.joinedAt),
  };
}

export async function getAdminUserDetail(
  actorUserId: string,
  userId: string,
): Promise<AdminUserDetailDto | null> {
  await assertActiveAdmin(actorUserId);
  const user = await findAdminUserDetail(userId);
  if (!user) return null;

  return {
    id: user.id,
    displayName: displayName(user),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    mobile: user.mobile,
    avatarUrl: user.avatarUrl,
    status: user.status,
    isAdmin: user.isAdmin,
    onboardingCompleted: user.onboardingCompleted,
    onboardingCompletedAt: toIso(user.onboardingCompletedAt),
    emailVerified: user.emailVerified,
    mobileVerified: user.mobileVerified,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: toIso(user.lastLoginAt),
    cafeMemberships: user.cafeMemberships.map((membership) =>
      toMembershipDto(membership, {
        id: membership.cafeId,
        name: membership.cafeName,
        status: membership.cafeStatus,
      }),
    ),
    supplierMemberships: user.supplierMemberships.map((membership) =>
      toMembershipDto(membership, {
        id: membership.supplierId,
        name: membership.supplierName,
        status: membership.supplierStatus,
      }),
    ),
  };
}
