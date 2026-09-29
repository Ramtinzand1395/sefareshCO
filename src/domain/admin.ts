import type { UserStatus } from "@/model/user";

export const ADMIN_USER_PAGE_SIZES = [10, 20, 50] as const;

export type AdminUserKind =
  | "all"
  | "admin"
  | "cafe"
  | "supplier"
  | "unassigned";

export type AdminOnboardingFilter = "all" | "complete" | "incomplete";

export type AdminUserListQuery = {
  query: string;
  status: UserStatus | "all";
  kind: AdminUserKind;
  onboarding: AdminOnboardingFilter;
  page: number;
  pageSize: (typeof ADMIN_USER_PAGE_SIZES)[number];
};

export type AdminDashboardDto = {
  generatedAt: string;
  metrics: {
    users: { total: number; active: number; pending: number };
    cafes: { total: number; active: number };
    suppliers: { total: number; active: number; verified: number };
    incompleteOnboarding: number;
  };
  recentActivity: Array<{
    id: string;
    type: "user" | "cafe" | "supplier";
    title: string;
    description: string;
    happenedAt: string;
    href?: string;
  }>;
};

export type AdminUserListItemDto = {
  id: string;
  displayName: string;
  email: string;
  mobile?: string;
  status: UserStatus;
  onboardingCompleted: boolean;
  isAdmin: boolean;
  hasCafeMembership: boolean;
  hasSupplierMembership: boolean;
  createdAt: string;
  lastLoginAt?: string;
};

export type AdminUserListDto = {
  items: AdminUserListItemDto[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

export type AdminMembershipDto = {
  id: string;
  businessId: string;
  businessName: string;
  businessStatus: string;
  role: string;
  status: string;
  joinedAt?: string;
};

export type AdminUserDetailDto = {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  mobile?: string;
  avatarUrl?: string;
  status: UserStatus;
  isAdmin: boolean;
  onboardingCompleted: boolean;
  onboardingCompletedAt?: string;
  emailVerified: boolean;
  mobileVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  cafeMemberships: AdminMembershipDto[];
  supplierMemberships: AdminMembershipDto[];
};

function firstValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizedString(value: unknown) {
  return typeof firstValue(value) === "string"
    ? String(firstValue(value)).trim()
    : "";
}

export function parseAdminUserListQuery(
  input: Record<string, string | string[] | undefined>,
): AdminUserListQuery {
  const rawStatus = normalizedString(input.status);
  const rawKind = normalizedString(input.kind);
  const rawOnboarding = normalizedString(input.onboarding);
  const rawPage = Number.parseInt(normalizedString(input.page), 10);
  const rawPageSize = Number.parseInt(normalizedString(input.pageSize), 10);

  const statuses = ["active", "pending", "suspended", "disabled"] as const;
  const kinds = ["admin", "cafe", "supplier", "unassigned"] as const;
  const onboardingFilters = ["complete", "incomplete"] as const;

  return {
    query: normalizedString(input.q).slice(0, 100),
    status: statuses.includes(rawStatus as (typeof statuses)[number])
      ? (rawStatus as UserStatus)
      : "all",
    kind: kinds.includes(rawKind as (typeof kinds)[number])
      ? (rawKind as AdminUserKind)
      : "all",
    onboarding: onboardingFilters.includes(
      rawOnboarding as (typeof onboardingFilters)[number],
    )
      ? (rawOnboarding as AdminOnboardingFilter)
      : "all",
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize: ADMIN_USER_PAGE_SIZES.includes(
      rawPageSize as (typeof ADMIN_USER_PAGE_SIZES)[number],
    )
      ? (rawPageSize as (typeof ADMIN_USER_PAGE_SIZES)[number])
      : 20,
  };
}
