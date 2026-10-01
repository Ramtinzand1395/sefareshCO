export type SupplierRole =
  | "owner"
  | "manager"
  | "sales"
  | "warehouse"
  | "accountant"
  | "employee";

export type SupplierMemberIdentity = {
  userId: string;
  supplierId: string;
  role: string;
  permissions?: {
    canManageProducts?: boolean;
    canManageOffers?: boolean;
    canViewRequests?: boolean;
    canRespondToRequests?: boolean;
    canViewOrders?: boolean;
    canUpdateOrders?: boolean;
    canViewFinancials?: boolean;
    canManageMembers?: boolean;
    [key: string]: unknown;
  } | null;
};

/**
 * Determines whether a supplier member can view incoming RFQ requests (SupplierRequest).
 * - Owner always has full permission.
 * - Explicit true in permissions grants access.
 * - Explicit false in permissions denies access.
 * - Operational roles (manager, sales) have default access unless revoked.
 * - Non-commercial roles (warehouse, accountant, employee) cannot view requests without explicit permission.
 */
export function canViewSupplierRequests(member: {
  role: string;
  permissions?: { canViewRequests?: boolean } | null;
}): boolean {
  if (member.role === "owner") return true;
  if (member.permissions?.canViewRequests === true) return true;
  if (member.permissions?.canViewRequests === false) return false;
  return ["manager", "sales"].includes(member.role);
}
