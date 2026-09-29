import type { ClientSession } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { User } from "@/model/user";

export type SafeUserRecord = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  mobile?: string;
  status: "active" | "pending" | "suspended" | "disabled";
  onboardingCompleted: boolean;
  isAdmin: boolean;
};

type UserDocumentShape = {
  _id: { toString(): string };
  email?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  passwordHash?: string;
  mobile?: string;
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
  status?: SafeUserRecord["status"];
  onboardingCompleted?: boolean;
  isAdmin?: boolean;
};

function toSafeUser(user: UserDocumentShape): SafeUserRecord {
  return {
    id: user._id.toString(),
    email: user.email ?? "",
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    mobile: user.mobile,
    status: user.status ?? "pending",
    onboardingCompleted: user.onboardingCompleted ?? false,
    isAdmin: user.isAdmin ?? false,
  };
}

export async function findUserByEmail(email: string) {
  await dbConnect();
  const user = await User.findOne({ email, deletedAt: null }).lean();
  return user ? toSafeUser(user as unknown as UserDocumentShape) : null;
}

export async function findUserWithPassword(email: string) {
  await dbConnect();
  const user = await User.findOne({ email, deletedAt: null })
    .select("+passwordHash")
    .lean();
  if (!user) return null;
  const shaped = user as unknown as UserDocumentShape;
  return {
    ...toSafeUser(shaped),
    passwordHash: shaped.passwordHash,
    failedLoginAttempts: shaped.failedLoginAttempts ?? 0,
    lockedUntil: shaped.lockedUntil ?? null,
  };
}

export async function findUserById(userId: string) {
  await dbConnect();
  const user = await User.findOne({ _id: userId, deletedAt: null }).lean();
  return user ? toSafeUser(user as unknown as UserDocumentShape) : null;
}

export async function createCredentialsUser(email: string, passwordHash: string) {
  await dbConnect();
  const user = await User.create({
    email,
    passwordHash,
    emailVerified: false,
    status: "active",
    onboardingCompleted: false,
    authProviders: [{ provider: "credentials", linkedAt: new Date() }],
  });
  return toSafeUser(user as unknown as UserDocumentShape);
}

export async function upsertGoogleUser(input: {
  email: string;
  providerAccountId: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}) {
  await dbConnect();
  let user: unknown;
  try {
    user = await User.findOneAndUpdate(
      { email: input.email, deletedAt: null },
      {
        $set: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
          status: "active",
          lastLoginAt: new Date(),
          ...(input.firstName ? { firstName: input.firstName } : {}),
          ...(input.lastName ? { lastName: input.lastName } : {}),
          ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
        },
        $setOnInsert: {
          email: input.email,
          onboardingCompleted: false,
          isAdmin: false,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    ).lean();
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      (error as Error & { code?: number }).code !== 11000
    ) {
      throw error;
    }
    user = await User.findOne({ email: input.email, deletedAt: null }).lean();
    if (!user) throw error;
  }

  await User.updateOne(
    {
      _id: (user as unknown as UserDocumentShape)._id,
      authProviders: {
        $not: {
          $elemMatch: {
            provider: "google",
            providerAccountId: input.providerAccountId,
          },
        },
      },
    },
    {
      $push: {
        authProviders: {
          provider: "google",
          providerAccountId: input.providerAccountId,
          linkedAt: new Date(),
        },
      },
    },
  );

  return toSafeUser(user as unknown as UserDocumentShape);
}

export async function recordSuccessfulLogin(userId: string) {
  await dbConnect();
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    },
  );
}

export async function recordFailedLogin(
  userId: string,
  failedLoginAttempts: number,
  lockedUntil: Date | null,
) {
  await dbConnect();
  await User.updateOne(
    { _id: userId },
    { $set: { failedLoginAttempts, lockedUntil } },
  );
}

export async function acquireOnboardingLock(userId: string, lockId: string) {
  await dbConnect();
  const now = new Date();
  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      onboardingCompleted: { $ne: true },
      $or: [
        { onboardingLock: { $exists: false } },
        { onboardingLockExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        onboardingLock: lockId,
        onboardingLockExpiresAt: new Date(now.getTime() + 2 * 60 * 1000),
      },
    },
    { returnDocument: "after" },
  );
  return Boolean(user);
}

export async function releaseOnboardingLock(userId: string, lockId: string) {
  await dbConnect();
  await User.updateOne(
    { _id: userId, onboardingLock: lockId },
    { $unset: { onboardingLock: 1, onboardingLockExpiresAt: 1 } },
  );
}

export async function updateUserProfile(
  userId: string,
  input: { firstName: string; lastName: string; mobile: string },
  session?: ClientSession,
) {
  await dbConnect();
  await User.updateOne({ _id: userId }, { $set: input }, { session });
}

export async function completeUserOnboarding(
  userId: string,
  lockId: string,
  session?: ClientSession,
) {
  await dbConnect();
  await User.updateOne(
    { _id: userId, onboardingLock: lockId },
    {
      $set: {
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
      },
      $unset: { onboardingLock: 1, onboardingLockExpiresAt: 1 },
    },
    { session },
  );
}
