import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { findActiveCafeMembership } from "@/src/repositories/cafe-member-repository";
import { findCafeById } from "@/src/repositories/cafe-repository";
import { findActiveSupplierMembership } from "@/src/repositories/supplier-member-repository";
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

export async function getCurrentCafeIdentity() {
  const user = await requireUser();
  const membership = await findActiveCafeMembership(user.id);
  if (!membership) return null;

  // Enforce Cafe-level status — suspended/rejected cafes must not access marketplace
  const cafeId = membership.cafeId.toString();
  const cafe = await findCafeById(cafeId);
  if (!cafe || cafe.status !== "active") return null;

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
  return {
    userId: user.id,
    supplierId: membership.supplierId.toString(),
    role: membership.role,
    permissions: membership.permissions,
  };
}
