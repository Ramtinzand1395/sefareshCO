import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { isActiveAdmin } from "@/src/domain/admin-access";
import { findUserById } from "@/src/repositories/user-repository";

export type AdminIdentity = {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

/**
 * Server-only admin authorization guard.
 *
 * 1. Reads the current session
 * 2. Verifies the user is authenticated
 * 3. Resolves the real user from the database (never trusts session alone)
 * 4. Checks `isAdmin === true`
 * 5. Requires the account itself to be active
 * 6. Returns a minimal, serializable identity
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await findUserById(session.user.id);
  if (!user) redirect("/login");

  if (!isActiveAdmin(user)) redirect("/login");

  return {
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}
