import type { ClientSession } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { Supplier } from "@/model/supplier";

export async function findSupplierOwnedByUser(userId: string, session?: ClientSession) {
  await dbConnect();
  return Supplier.findOne({ ownerUserId: userId, deletedAt: null }).session(session ?? null);
}

export async function createSupplier(
  input: {
    ownerUserId: string;
    businessName: string;
    mobile: string;
    province: string;
    city: string;
  },
  session?: ClientSession,
) {
  await dbConnect();
  const [supplier] = await Supplier.create([{ ...input, status: "active" }], { session });
  return supplier;
}

export async function deleteSupplier(supplierId: string) {
  await dbConnect();
  await Supplier.deleteOne({ _id: supplierId });
}

export async function findSupplierById(supplierId: string) {
  await dbConnect();
  const doc = (await Supplier.findOne({ _id: supplierId, deletedAt: null })
    .select("status")
    .lean()) as { _id: unknown; status?: string } | null;
  if (!doc) return null;
  return {
    status: (doc.status ?? "pending") as
      | "pending"
      | "active"
      | "suspended"
      | "rejected",
  };
}
