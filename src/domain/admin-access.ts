export type AccountStatus = "active" | "pending" | "suspended" | "disabled";

export function isActiveAdmin(user: {
  isAdmin: boolean;
  status: AccountStatus;
}) {
  return user.isAdmin && user.status === "active";
}

export function hasActiveBusinessAccess(input: {
  userStatus: AccountStatus;
  membershipStatus?: string | null;
  businessStatus?: string | null;
}) {
  return (
    input.userStatus === "active" &&
    input.membershipStatus === "active" &&
    input.businessStatus === "active"
  );
}
