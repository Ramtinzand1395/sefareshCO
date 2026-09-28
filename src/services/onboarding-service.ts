import { randomUUID } from "node:crypto";
import mongoose, { type ClientSession } from "mongoose";

import dbConnect from "@/lib/mongodb";
import type { OnboardingInput } from "@/src/domain/schemas/onboarding";
import {
  createCafe,
  deleteCafe,
  findCafeOwnedByUser,
} from "@/src/repositories/cafe-repository";
import { ensureCafeOwnerMembership } from "@/src/repositories/cafe-member-repository";
import {
  createSupplier,
  deleteSupplier,
  findSupplierOwnedByUser,
} from "@/src/repositories/supplier-repository";
import { ensureSupplierOwnerMembership } from "@/src/repositories/supplier-member-repository";
import {
  acquireOnboardingLock,
  completeUserOnboarding,
  findUserById,
  releaseOnboardingLock,
  updateUserProfile,
} from "@/src/repositories/user-repository";

export class OnboardingInProgressError extends Error {}
export class OnboardingAlreadyCompletedError extends Error {}
export class MobileAlreadyExistsError extends Error {}

type Destination = "/cafe" | "/supplier";

async function persistOnboarding(
  userId: string,
  lockId: string,
  input: OnboardingInput,
  session?: ClientSession,
): Promise<{ destination: Destination; createdTenantId?: string }> {
  await updateUserProfile(
    userId,
    {
      firstName: input.firstName,
      lastName: input.lastName,
      mobile: input.mobile,
    },
    session,
  );

  if (input.accountType === "buyer") {
    let cafe = await findCafeOwnedByUser(userId, session);
    let createdTenantId: string | undefined;
    if (!cafe) {
      cafe = await createCafe(
        {
          ownerUserId: userId,
          name: input.businessName,
          type: input.businessType,
          mobile: input.mobile,
          province: input.province,
          city: input.city,
        },
        session,
      );
      createdTenantId = cafe._id.toString();
    }
    try {
      await ensureCafeOwnerMembership(cafe._id.toString(), userId, session);
    } catch (error) {
      if (!session && createdTenantId) await deleteCafe(createdTenantId);
      throw error;
    }
    await completeUserOnboarding(userId, lockId, session);
    return { destination: "/cafe", createdTenantId };
  }

  let supplier = await findSupplierOwnedByUser(userId, session);
  let createdTenantId: string | undefined;
  if (!supplier) {
    supplier = await createSupplier(
      {
        ownerUserId: userId,
        businessName: input.businessName,
        mobile: input.mobile,
        province: input.province,
        city: input.city,
      },
      session,
    );
    createdTenantId = supplier._id.toString();
  }
  try {
    await ensureSupplierOwnerMembership(supplier._id.toString(), userId, session);
  } catch (error) {
    if (!session && createdTenantId) await deleteSupplier(createdTenantId);
    throw error;
  }
  await completeUserOnboarding(userId, lockId, session);
  return { destination: "/supplier", createdTenantId };
}

function transactionsUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (
    /Transaction numbers are only allowed|replica set member|mongos|does not support retryable writes/i.test(
      message,
    )
  ) {
    return true;
  }
  if (error && typeof error === "object") {
    const nested = error as {
      originalError?: unknown;
      cause?: unknown;
      errorResponse?: { originalError?: unknown };
    };
    return [nested.originalError, nested.cause, nested.errorResponse?.originalError]
      .filter(Boolean)
      .some(transactionsUnavailable);
  }
  return false;
}

function isMobileDuplicate(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const duplicate = error as {
    code?: number;
    keyPattern?: Record<string, number>;
    keyValue?: Record<string, unknown>;
  };
  return (
    duplicate.code === 11000 &&
    (Boolean(duplicate.keyPattern?.mobile) || "mobile" in (duplicate.keyValue ?? {}))
  );
}

export async function completeOnboarding(userId: string, input: OnboardingInput) {
  const currentUser = await findUserById(userId);
  if (!currentUser) throw new Error("USER_NOT_FOUND");
  if (currentUser.onboardingCompleted) throw new OnboardingAlreadyCompletedError();

  const lockId = randomUUID();
  const acquired = await acquireOnboardingLock(userId, lockId);
  if (!acquired) throw new OnboardingInProgressError();

  await dbConnect();
  const session = await mongoose.startSession();
  try {
    let result: { destination: Destination } | undefined;
    try {
      await session.withTransaction(async () => {
        result = await persistOnboarding(userId, lockId, input, session);
      });
      if (!result) throw new Error("ONBOARDING_TRANSACTION_FAILED");
      return result;
    } catch (error) {
      if (!transactionsUnavailable(error)) throw error;

      try {
        const fallbackResult = await persistOnboarding(userId, lockId, input);
        return { destination: fallbackResult.destination };
      } catch (fallbackError) {
        throw fallbackError;
      }
    }
  } catch (error) {
    if (isMobileDuplicate(error)) throw new MobileAlreadyExistsError();
    throw error;
  } finally {
    await session.endSession();
    await releaseOnboardingLock(userId, lockId);
  }
}
