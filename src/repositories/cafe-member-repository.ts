import type { ClientSession } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { CafeMember } from "@/model/cafe-member";

export const OWNER_CAFE_PERMISSIONS = {
  canCreatePurchaseRequest: true,
  canApprovePurchaseRequest: true,
  canManageShoppingList: true,
  canCompareSuppliers: true,
  canCreateOrder: true,
  canViewOrders: true,
  canViewCosts: true,
  canManageMembers: true,
} as const;

export async function findActiveCafeMembership(userId: string) {
  await dbConnect();
  return CafeMember.findOne({ userId, status: "active" }).sort({ joinedAt: 1 }).lean();
}

export async function ensureCafeOwnerMembership(
  cafeId: string,
  userId: string,
  session?: ClientSession,
) {
  await dbConnect();
  return CafeMember.findOneAndUpdate(
    { cafeId, userId },
    {
      $set: {
        role: "owner",
        status: "active",
        permissions: OWNER_CAFE_PERMISSIONS,
        joinedAt: new Date(),
      },
      $setOnInsert: { cafeId, userId },
    },
    {
      upsert: true,
      returnDocument: "after",
      session,
      setDefaultsOnInsert: true,
    },
  );
}
