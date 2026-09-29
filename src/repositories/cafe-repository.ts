import type { ClientSession } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { Cafe } from "@/model/cafe";

export async function findCafeOwnedByUser(userId: string, session?: ClientSession) {
  await dbConnect();
  return Cafe.findOne({ ownerUserId: userId, deletedAt: null }).session(session ?? null);
}

export async function createCafe(
  input: {
    ownerUserId: string;
    name: string;
    type: string;
    mobile: string;
    province: string;
    city: string;
  },
  session?: ClientSession,
) {
  await dbConnect();
  const [cafe] = await Cafe.create([{ ...input, status: "active" }], { session });
  return cafe;
}

export async function deleteCafe(cafeId: string) {
  await dbConnect();
  await Cafe.deleteOne({ _id: cafeId });
}

export async function findCafeById(cafeId: string) {
  await dbConnect();
  const doc = await Cafe.findOne({ _id: cafeId, deletedAt: null })
    .select("status")
    .lean() as { _id: unknown; status?: string } | null;
  if (!doc) return null;
  return { status: (doc.status ?? "pending") as "pending" | "active" | "suspended" | "rejected" };
}
