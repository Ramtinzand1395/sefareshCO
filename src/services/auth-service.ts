import { compare, hash } from "bcryptjs";

import type { RegisterInput } from "@/src/domain/schemas/auth";
import { hasActiveBusinessAccess } from "@/src/domain/admin-access";
import {
  createCredentialsUser,
  findUserByEmail,
  findUserWithPassword,
  recordFailedLogin,
  recordSuccessfulLogin,
  upsertGoogleUser,
} from "@/src/repositories/user-repository";
import { findActiveCafeMembership } from "@/src/repositories/cafe-member-repository";
import { findActiveSupplierMembership } from "@/src/repositories/supplier-member-repository";
import { findCafeById } from "@/src/repositories/cafe-repository";
import { findSupplierById } from "@/src/repositories/supplier-repository";
import type { UserStatus } from "@/model/user";

export class EmailAlreadyExistsError extends Error {}
export class AccountUnavailableError extends Error {}

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export async function getDefaultDestination(
  userId: string,
  isAdmin = false,
  userStatus: UserStatus = "active",
): Promise<"/cafe" | "/supplier" | "/admin" | "/onboarding"> {
  if (userStatus !== "active") return "/onboarding";
  if (isAdmin) return "/admin";

  const [cafeMembership, supplierMembership] = await Promise.all([
    findActiveCafeMembership(userId),
    findActiveSupplierMembership(userId),
  ]);

  const [cafe, supplier] = await Promise.all([
    cafeMembership
      ? findCafeById(cafeMembership.cafeId.toString())
      : Promise.resolve(null),
    supplierMembership
      ? findSupplierById(supplierMembership.supplierId.toString())
      : Promise.resolve(null),
  ]);

  if (
    hasActiveBusinessAccess({
      userStatus,
      membershipStatus: cafeMembership?.status,
      businessStatus: cafe?.status,
    })
  ) {
    return "/cafe";
  }
  if (
    hasActiveBusinessAccess({
      userStatus,
      membershipStatus: supplierMembership?.status,
      businessStatus: supplier?.status,
    })
  ) {
    return "/supplier";
  }
  return "/onboarding";
}

export async function registerWithCredentials(input: RegisterInput) {
  const existingUser = await findUserByEmail(input.email);
  if (existingUser) throw new EmailAlreadyExistsError();

  const passwordHash = await hash(input.password, 12);
  try {
    return await createCredentialsUser(input.email, passwordHash);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as Error & { code?: number }).code === 11000
    ) {
      throw new EmailAlreadyExistsError();
    }
    throw error;
  }
}

export async function authenticateWithCredentials(email: string, password: string) {
  const user = await findUserWithPassword(email);
  if (!user?.passwordHash || user.status !== "active") return null;
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) return null;

  const validPassword = await compare(password, user.passwordHash);
  if (!validPassword) {
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
    await recordFailedLogin(
      user.id,
      shouldLock ? 0 : attempts,
      shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null,
    );
    return null;
  }

  await recordSuccessfulLogin(user.id);
  return {
    id: user.id,
    email: user.email,
    name: [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined,
    image: user.avatarUrl,
    onboardingCompleted: user.onboardingCompleted,
    isAdmin: user.isAdmin,
    destination: user.onboardingCompleted
      ? await getDefaultDestination(user.id, user.isAdmin, user.status)
      : "/onboarding",
  };
}

export async function authenticateWithGoogle(input: {
  email: string;
  providerAccountId: string;
  name?: string | null;
  avatarUrl?: string | null;
}) {
  const existingUser = await findUserByEmail(input.email);
  if (
    existingUser &&
    (existingUser.status === "suspended" || existingUser.status === "disabled")
  ) {
    throw new AccountUnavailableError();
  }

  const nameParts = input.name?.trim().split(/\s+/) ?? [];
  const user = await upsertGoogleUser({
    email: input.email.toLowerCase(),
    providerAccountId: input.providerAccountId,
    firstName: nameParts.at(0),
    lastName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined,
    avatarUrl: input.avatarUrl ?? undefined,
  });

  return {
    ...user,
    destination: user.onboardingCompleted
      ? await getDefaultDestination(user.id, user.isAdmin, user.status)
      : "/onboarding",
  };
}
