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

/**
 * Determines whether a cafe member can view the cafe's shopping list.
 * Any active member belonging to the cafe is allowed to view the shopping list.
 */
export function canViewShoppingList(member: {
  role: string;
  permissions?: { canManageShoppingList?: boolean } | null;
}): boolean {
  return [
    "owner",
    "manager",
    "purchase_manager",
    "chef",
    "accountant",
    "employee",
  ].includes(member.role);
}

/**
 * Determines whether a cafe member can manage (add, edit, remove, transfer) the shopping list.
 * - Owner always has full permission.
 * - Explicit true in permissions grants access.
 * - Explicit false in permissions denies access.
 * - Operational management roles (manager, purchase_manager) have default access unless revoked.
 * - Non-management roles (chef, employee, accountant) cannot manage without explicit permission.
 */
export function canManageShoppingList(member: {
  role: string;
  permissions?: { canManageShoppingList?: boolean } | null;
}): boolean {
  if (member.role === "owner") return true;
  if (member.permissions?.canManageShoppingList === true) return true;
  if (member.permissions?.canManageShoppingList === false) return false;
  return ["manager", "purchase_manager"].includes(member.role);
}

/**
 * Determines whether a cafe member can create an official PurchaseRequest / RFQ.
 * - Owner always has full permission.
 * - Explicit true in permissions grants access.
 * - Explicit false in permissions denies access.
 * - Operational management roles (manager, purchase_manager) have default access unless revoked.
 * - Non-management roles (chef, employee, accountant) cannot create RFQs without explicit permission.
 */
export function canCreatePurchaseRequest(member: {
  role: string;
  permissions?: { canCreatePurchaseRequest?: boolean } | null;
}): boolean {
  if (member.role === "owner") return true;
  if (member.permissions?.canCreatePurchaseRequest === true) return true;
  if (member.permissions?.canCreatePurchaseRequest === false) return false;
  return ["manager", "purchase_manager"].includes(member.role);
}

/**
 * Determines whether a cafe member can view PurchaseRequests / RFQs of the cafe.
 * Any active member belonging to the cafe is allowed to view RFQs.
 */
export function canViewPurchaseRequests(member: {
  role: string;
  permissions?: { [key: string]: unknown } | null;
}): boolean {
  return [
    "owner",
    "manager",
    "purchase_manager",
    "chef",
    "accountant",
    "employee",
  ].includes(member.role);
}

/**
 * Determines whether a cafe member can cancel a PurchaseRequest.
 * - Already cancelled requests cannot be cancelled.
 * - Owner can cancel any active request.
 * - Members with canCreatePurchaseRequest can cancel draft or submitted requests.
 * - Requester/creator can cancel their own draft requests.
 */
export function canCancelPurchaseRequest(
  member: {
    userId: string;
    role: string;
    permissions?: { canCreatePurchaseRequest?: boolean } | null;
  },
  request: {
    createdByUserId: string;
    status: string;
  },
): boolean {
  if (request.status === "cancelled") return false;
  if (member.role === "owner") return true;
  if (request.status === "draft" && member.userId === request.createdByUserId) {
    return true;
  }
  return canCreatePurchaseRequest(member);
}

/**
 * Determines whether a cafe member can compare quotes and manage supplier selections for RFQs.
 * - Owner always has full permission.
 * - Explicit true in permissions grants access.
 * - Explicit false in permissions denies access.
 * - Operational management roles (manager, purchase_manager) have default access unless revoked.
 * - Non-management roles (chef, employee, accountant) cannot manage selections without explicit permission.
 */
export function canCompareSuppliers(member: {
  role: string;
  permissions?: { canCompareSuppliers?: boolean } | null;
}): boolean {
  if (member.role === "owner") return true;
  if (member.permissions?.canCompareSuppliers === true) return true;
  if (member.permissions?.canCompareSuppliers === false) return false;
  return ["manager", "purchase_manager"].includes(member.role);
}

/**
 * Determines whether a cafe member can confirm purchases and create orders from RFQ selections.
 * - Owner always has full permission.
 * - Explicit true in permissions grants access.
 * - Explicit false in permissions denies access.
 * - Operational management roles (manager, purchase_manager) have default access unless revoked.
 * - Non-management roles (chef, employee, accountant) cannot create orders without explicit permission.
 */
export function canCreateOrder(member: {
  role: string;
  permissions?: { canCreateOrder?: boolean } | null;
}): boolean {
  if (member.role === "owner") return true;
  if (member.permissions?.canCreateOrder === true) return true;
  if (member.permissions?.canCreateOrder === false) return false;
  return ["manager", "purchase_manager"].includes(member.role);
}

/**
 * Determines whether a cafe member can view the cafe's orders.
 * - Any active cafe member can view orders unless explicitly revoked.
 */
export function canViewCafeOrders(member: {
  role: string;
  permissions?: { canViewOrders?: boolean } | null;
}): boolean {
  if (member.permissions?.canViewOrders === false) return false;
  return [
    "owner",
    "manager",
    "purchase_manager",
    "chef",
    "accountant",
    "employee",
  ].includes(member.role);
}

/**
 * Determines whether a cafe member can cancel an order placed by the cafe.
 * - Only orders in 'placed' status can be cancelled by the cafe.
 * - Owner can cancel any placed order.
 * - Creator of the order can cancel their own placed order.
 * - Members with canCreateOrder permission can cancel placed orders.
 */
export function canCancelCafeOrder(
  member: {
    userId: string;
    role: string;
    permissions?: { canCreateOrder?: boolean } | null;
  },
  order: {
    createdByUserId: string;
    status?: string;
  },
): boolean {
  if (order.status && order.status !== "placed") return false;
  if (member.role === "owner") return true;
  if (member.userId === order.createdByUserId) return true;
  return canCreateOrder(member);
}

/**
 * Determines whether a cafe member can view payments for the cafe's orders.
 * Any active member belonging to the cafe is allowed to view payment statuses unless explicitly denied.
 */
export function canViewCafePayments(member: {
  role: string;
  permissions?: { canViewCosts?: boolean; [key: string]: unknown } | null;
}): boolean {
  if (member.permissions?.canViewCosts === false) return false;
  return [
    "owner",
    "manager",
    "purchase_manager",
    "accountant",
    "chef",
    "employee",
  ].includes(member.role);
}

/**
 * Determines whether a cafe member can initiate a payment attempt for a cafe order.
 * - Owner always has full permission.
 * - Explicit true in permissions grants access.
 * - Explicit false in permissions denies access.
 * - Commercial/managerial roles (manager, purchase_manager, accountant) have default access.
 * - Non-commercial roles (chef, employee) cannot initiate payments without explicit permission.
 */
export function canInitiateCafePayment(member: {
  role: string;
  permissions?: {
    canCreateOrder?: boolean;
    canInitiatePayment?: boolean;
    [key: string]: unknown;
  } | null;
}): boolean {
  if (member.role === "owner") return true;
  if (
    member.permissions?.canInitiatePayment === true ||
    member.permissions?.canCreateOrder === true
  ) {
    return true;
  }
  if (
    member.permissions?.canInitiatePayment === false ||
    member.permissions?.canCreateOrder === false
  ) {
    return false;
  }
  return ["manager", "purchase_manager", "accountant"].includes(member.role);
}
