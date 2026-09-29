import dbConnect from "@/lib/mongodb";
import { User } from "@/model/user";
import { Cafe } from "@/model/cafe";
import { Supplier } from "@/model/supplier";

// ---------------------------------------------------------------------------
// DTO types – fully serializable, no ObjectId / Mongoose Document
// ---------------------------------------------------------------------------

export type UserCountsDTO = {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  disabled: number;
};

export type CafeCountsDTO = {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  rejected: number;
};

export type SupplierCountsDTO = {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  rejected: number;
  verified: number;
  unverified: number;
};

export type RecentUserDTO = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: string;
  createdAt: string;
};

export type RecentCafeDTO = {
  id: string;
  name: string;
  city?: string;
  status: string;
  createdAt: string;
};

export type RecentSupplierDTO = {
  id: string;
  businessName: string;
  city?: string;
  status: string;
  isVerified: boolean;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Counts – executed in parallel via Promise.all by the caller
// ---------------------------------------------------------------------------

const notDeleted = { deletedAt: null };

export async function getUserCounts(): Promise<UserCountsDTO> {
  await dbConnect();
  const [total, active, pending, suspended, disabled] = await Promise.all([
    User.countDocuments(notDeleted),
    User.countDocuments({ ...notDeleted, status: "active" }),
    User.countDocuments({ ...notDeleted, status: "pending" }),
    User.countDocuments({ ...notDeleted, status: "suspended" }),
    User.countDocuments({ ...notDeleted, status: "disabled" }),
  ]);
  return { total, active, pending, suspended, disabled };
}

export async function getCafeCounts(): Promise<CafeCountsDTO> {
  await dbConnect();
  const [total, active, pending, suspended, rejected] = await Promise.all([
    Cafe.countDocuments(notDeleted),
    Cafe.countDocuments({ ...notDeleted, status: "active" }),
    Cafe.countDocuments({ ...notDeleted, status: "pending" }),
    Cafe.countDocuments({ ...notDeleted, status: "suspended" }),
    Cafe.countDocuments({ ...notDeleted, status: "rejected" }),
  ]);
  return { total, active, pending, suspended, rejected };
}

export async function getSupplierCounts(): Promise<SupplierCountsDTO> {
  await dbConnect();
  const [total, active, pending, suspended, rejected, verified, unverified] =
    await Promise.all([
      Supplier.countDocuments(notDeleted),
      Supplier.countDocuments({ ...notDeleted, status: "active" }),
      Supplier.countDocuments({ ...notDeleted, status: "pending" }),
      Supplier.countDocuments({ ...notDeleted, status: "suspended" }),
      Supplier.countDocuments({ ...notDeleted, status: "rejected" }),
      Supplier.countDocuments({ ...notDeleted, isVerified: true }),
      Supplier.countDocuments({ ...notDeleted, isVerified: false }),
    ]);
  return { total, active, pending, suspended, rejected, verified, unverified };
}

// ---------------------------------------------------------------------------
// Recent activity – limited, sorted, projected
// ---------------------------------------------------------------------------

type UserDoc = {
  _id: { toString(): string };
  email?: string;
  firstName?: string;
  lastName?: string;
  status?: string;
  createdAt?: Date;
};

type CafeDoc = {
  _id: { toString(): string };
  name?: string;
  city?: string;
  status?: string;
  createdAt?: Date;
};

type SupplierDoc = {
  _id: { toString(): string };
  businessName?: string;
  city?: string;
  status?: string;
  isVerified?: boolean;
  createdAt?: Date;
};

export async function getLatestUsers(limit = 5): Promise<RecentUserDTO[]> {
  await dbConnect();
  const docs = (await User.find(notDeleted)
    .select("email firstName lastName status createdAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()) as unknown as UserDoc[];

  return docs.map((doc) => ({
    id: doc._id.toString(),
    email: doc.email ?? "",
    firstName: doc.firstName,
    lastName: doc.lastName,
    status: doc.status ?? "pending",
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
  }));
}

export async function getLatestCafes(limit = 5): Promise<RecentCafeDTO[]> {
  await dbConnect();
  const docs = (await Cafe.find(notDeleted)
    .select("name city status createdAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()) as unknown as CafeDoc[];

  return docs.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name ?? "",
    city: doc.city,
    status: doc.status ?? "pending",
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
  }));
}

export async function getLatestSuppliers(
  limit = 5,
): Promise<RecentSupplierDTO[]> {
  await dbConnect();
  const docs = (await Supplier.find(notDeleted)
    .select("businessName city status isVerified createdAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()) as unknown as SupplierDoc[];

  return docs.map((doc) => ({
    id: doc._id.toString(),
    businessName: doc.businessName ?? "",
    city: doc.city,
    status: doc.status ?? "pending",
    isVerified: doc.isVerified ?? false,
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
  }));
}
