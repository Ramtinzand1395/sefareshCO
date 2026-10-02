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

/**
 * Determines whether a supplier member can respond to, edit response for, or decline an RFQ (SupplierRequest).
 * - Owner always has full permission.
 * - Explicit true in permissions grants access.
 * - Explicit false in permissions denies access.
 * - Operational commercial roles (manager, sales) have default access unless revoked.
 * - Non-commercial roles (warehouse, accountant, employee) cannot respond without explicit permission.
 */
export function canRespondToSupplierRequests(member: {
  role: string;
  permissions?: { canRespondToRequests?: boolean } | null;
}): boolean {
  if (member.role === "owner") return true;
  if (member.permissions?.canRespondToRequests === true) return true;
  if (member.permissions?.canRespondToRequests === false) return false;
  return ["manager", "sales"].includes(member.role);
}

/**
 * Determines whether a supplier member can view incoming orders.
 * - Owner always has full permission.
 * - Explicit true in permissions grants access.
 * - Explicit false in permissions denies access.
 * - Operational roles (manager, sales, warehouse) have default access unless revoked.
 * - Non-commercial/non-operational roles (accountant, employee) cannot view without explicit permission.
 */
export function canViewSupplierOrders(member: {
  role: string;
  permissions?: { canViewOrders?: boolean } | null;
}): boolean {
  if (member.role === "owner") return true;
  if (member.permissions?.canViewOrders === true) return true;
  if (member.permissions?.canViewOrders === false) return false;
  return ["manager", "sales", "warehouse"].includes(member.role);
}

/**
 * Determines whether a supplier member can update order status (confirm, reject, preparing, shipped, delivered).
 * - Owner always has full permission.
 * - Explicit true in permissions grants access.
 * - Explicit false in permissions denies access.
 * - Operational commercial and warehouse roles (manager, sales, warehouse) have default access unless revoked.
 * - Non-operational roles (accountant, employee) cannot manage orders without explicit permission.
 */
export function canManageSupplierOrders(member: {
  role: string;
  permissions?: { canUpdateOrders?: boolean } | null;
}): boolean {
  if (member.role === "owner") return true;
  if (member.permissions?.canUpdateOrders === true) return true;
  if (member.permissions?.canUpdateOrders === false) return false;
  return ["manager", "sales", "warehouse"].includes(member.role);
}

/**
 * Determines whether a supplier member can view financials, payables, and settlements.
 * - Owner always has full permission.
 * - Explicit true in permissions grants access.
 * - Explicit false in permissions denies access.
 * - Financial & commercial roles (manager, accountant, sales) have default access unless revoked.
 * - Warehouse / employee roles cannot view financials without explicit permission.
 */
export function canViewSupplierFinancials(member: {
  role: string;
  permissions?: { canViewFinancials?: boolean } | null;
}): boolean {
  if (member.role === "owner") return true;
  if (member.permissions?.canViewFinancials === true) return true;
  if (member.permissions?.canViewFinancials === false) return false;
  return ["manager", "accountant", "sales"].includes(member.role);
}
