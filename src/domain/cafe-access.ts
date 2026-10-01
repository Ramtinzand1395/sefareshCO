export type CafeRole =
  | "owner"
  | "manager"
  | "purchase_manager"
  | "chef"
  | "accountant"
  | "employee";

export type CafeMemberIdentity = {
  userId: string;
  cafeId: string;
  role: string;
  permissions?: {
    canCreatePurchaseRequest?: boolean;
    canApprovePurchaseRequest?: boolean;
    canManageShoppingList?: boolean;
    canCompareSuppliers?: boolean;
    canCreateOrder?: boolean;
    canViewOrders?: boolean;
    canViewCosts?: boolean;
    canManageMembers?: boolean;
    [key: string]: unknown;
  } | null;
};

/**
 * Determines whether a cafe member can create an internal purchase request.
 * - Owner always has full permission.
 * - Explicit true in permissions grants access.
 * - Explicit false in permissions denies access.
 * - Operational roles (manager, purchase_manager, chef) have default access unless revoked.
 */
export function canCreateInternalRequest(member: {
  role: string;
  permissions?: { canCreatePurchaseRequest?: boolean } | null;
}): boolean {
  if (member.role === "owner") return true;
  if (member.permissions?.canCreatePurchaseRequest === true) return true;
  if (member.permissions?.canCreatePurchaseRequest === false) return false;
  return ["manager", "purchase_manager", "chef"].includes(member.role);
}

/**
 * Determines whether a cafe member can review/approve an internal purchase request.
 * - Owner always has full permission.
 * - Explicit true in permissions grants access.
 * - Explicit false in permissions denies access.
 * - Management roles (manager, purchase_manager) have default access unless revoked.
 * - Non-management roles (chef, employee, accountant) cannot review without explicit permission.
 */
export function canReviewInternalRequest(member: {
  role: string;
  permissions?: { canApprovePurchaseRequest?: boolean } | null;
}): boolean {
  if (member.role === "owner") return true;
  if (member.permissions?.canApprovePurchaseRequest === true) return true;
  if (member.permissions?.canApprovePurchaseRequest === false) return false;
  return ["manager", "purchase_manager"].includes(member.role);
}

/**
 * Determines whether a cafe member can cancel a pending internal purchase request.
 * - Requester can cancel their own pending request.
 * - Members with review permission can cancel any pending request in the cafe.
 */
export function canCancelInternalRequest(
  member: {
    userId: string;
    role: string;
    permissions?: { canApprovePurchaseRequest?: boolean } | null;
  },
  request: {
    requestedByUserId: string;
    status: string;
  },
): boolean {
  if (request.status !== "pending") return false;
  if (member.userId === request.requestedByUserId) return true;
  return canReviewInternalRequest(member);
}
