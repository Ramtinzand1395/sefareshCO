import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasActiveBusinessAccess } from "@/src/domain/admin-access";
import { findActiveCafeMembership } from "@/src/repositories/cafe-member-repository";
import { findCafeById } from "@/src/repositories/cafe-repository";
import { findActiveSupplierMembership } from "@/src/repositories/supplier-member-repository";
import { findSupplierById } from "@/src/repositories/supplier-repository";
import { findUserById } from "@/src/repositories/user-repository";

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return findUserById(session.user.id);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdminUser() {
  const user = await requireUser();
  if (!user.isAdmin || user.status !== "active") redirect("/");
  return user;
}

export async function getCurrentCafeIdentity() {
  const user = await requireUser();
  const membership = await findActiveCafeMembership(user.id);
  if (!membership) return null;

  const cafeId = membership.cafeId.toString();
  const cafe = await findCafeById(cafeId);
  if (
    !hasActiveBusinessAccess({
      userStatus: user.status,
      membershipStatus: membership.status,
      businessStatus: cafe?.status,
    })
  ) {
    return null;
  }

  return {
    userId: user.id,
    cafeId,
    role: membership.role,
    permissions: membership.permissions,
  };
}

export async function getCurrentSupplierIdentity() {
  const user = await requireUser();
  const membership = await findActiveSupplierMembership(user.id);
  if (!membership) return null;
  const supplierId = membership.supplierId.toString();
  const supplier = await findSupplierById(supplierId);
  if (
    !hasActiveBusinessAccess({
      userStatus: user.status,
      membershipStatus: membership.status,
      businessStatus: supplier?.status,
    })
  ) {
    return null;
  }

  return {
    userId: user.id,
    supplierId,
    role: membership.role,
    permissions: membership.permissions,
  };
}
