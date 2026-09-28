import type { ClientSession } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { SupplierMember } from "@/model/supplier-member";

export const OWNER_SUPPLIER_PERMISSIONS = {
  canManageProducts: true,
  canManageOffers: true,
  canViewRequests: true,
  canRespondToRequests: true,
  canViewOrders: true,
  canUpdateOrders: true,
  canViewFinancials: true,
  canManageMembers: true,
} as const;

export async function findActiveSupplierMembership(userId: string) {
  await dbConnect();
  return SupplierMember.findOne({ userId, status: "active" })
    .sort({ joinedAt: 1 })
    .lean();
}

export async function ensureSupplierOwnerMembership(
  supplierId: string,
  userId: string,
  session?: ClientSession,
) {
  await dbConnect();
  return SupplierMember.findOneAndUpdate(
    { supplierId, userId },
    {
      $set: {
        role: "owner",
        status: "active",
        permissions: OWNER_SUPPLIER_PERMISSIONS,
        joinedAt: new Date(),
      },
      $setOnInsert: { supplierId, userId },
    },
    {
      upsert: true,
      returnDocument: "after",
      session,
      setDefaultsOnInsert: true,
    },
  );
}
