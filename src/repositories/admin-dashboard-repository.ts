import dbConnect from "@/lib/mongodb";
import { Cafe } from "@/model/cafe";
import { Supplier } from "@/model/supplier";
import { User } from "@/model/user";

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

export type SupplierCountsDTO = CafeCountsDTO & {
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

export type AdminDashboardOverviewRecord = {
  users: UserCountsDTO;
  cafes: CafeCountsDTO;
  suppliers: SupplierCountsDTO;
  latestUsers: RecentUserDTO[];
  latestCafes: RecentCafeDTO[];
  latestSuppliers: RecentSupplierDTO[];
};

type AggregateResult<TCounts, TLatest> = Array<{
  counts: TCounts[];
  latest: TLatest[];
}>;

type UserAggregateRow = {
  _id: { toString(): string };
  email?: string;
  firstName?: string;
  lastName?: string;
  status?: string;
  createdAt?: Date;
};

type CafeAggregateRow = {
  _id: { toString(): string };
  name?: string;
  city?: string;
  status?: string;
  createdAt?: Date;
};

type SupplierAggregateRow = {
  _id: { toString(): string };
  businessName?: string;
  city?: string;
  status?: string;
  isVerified?: boolean;
  createdAt?: Date;
};

const notDeleted = { deletedAt: null };
const epoch = new Date(0);

function statusCount(status: string) {
  return { $sum: { $cond: [{ $eq: ["$status", status] }, 1, 0] } };
}

export async function getAdminDashboardOverviewRecord(
  recentLimit = 5,
): Promise<AdminDashboardOverviewRecord> {
  await dbConnect();

  const [userResult, cafeResult, supplierResult] = await Promise.all([
    User.aggregate([
      { $match: notDeleted },
      {
        $facet: {
          counts: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                active: statusCount("active"),
                pending: statusCount("pending"),
                suspended: statusCount("suspended"),
                disabled: statusCount("disabled"),
              },
            },
          ],
          latest: [
            { $sort: { createdAt: -1, _id: -1 } },
            { $limit: recentLimit },
            {
              $project: {
                email: 1,
                firstName: 1,
                lastName: 1,
                status: 1,
                createdAt: 1,
              },
            },
          ],
        },
      },
    ]) as Promise<AggregateResult<UserCountsDTO, UserAggregateRow>>,
    Cafe.aggregate([
      { $match: notDeleted },
      {
        $facet: {
          counts: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                active: statusCount("active"),
                pending: statusCount("pending"),
                suspended: statusCount("suspended"),
                rejected: statusCount("rejected"),
              },
            },
          ],
          latest: [
            { $sort: { createdAt: -1, _id: -1 } },
            { $limit: recentLimit },
            { $project: { name: 1, city: 1, status: 1, createdAt: 1 } },
          ],
        },
      },
    ]) as Promise<AggregateResult<CafeCountsDTO, CafeAggregateRow>>,
    Supplier.aggregate([
      { $match: notDeleted },
      {
        $facet: {
          counts: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                active: statusCount("active"),
                pending: statusCount("pending"),
                suspended: statusCount("suspended"),
                rejected: statusCount("rejected"),
                verified: {
                  $sum: { $cond: [{ $eq: ["$isVerified", true] }, 1, 0] },
                },
                unverified: {
                  $sum: { $cond: [{ $ne: ["$isVerified", true] }, 1, 0] },
                },
              },
            },
          ],
          latest: [
            { $sort: { createdAt: -1, _id: -1 } },
            { $limit: recentLimit },
            {
              $project: {
                businessName: 1,
                city: 1,
                status: 1,
                isVerified: 1,
                createdAt: 1,
              },
            },
          ],
        },
      },
    ]) as Promise<AggregateResult<SupplierCountsDTO, SupplierAggregateRow>>,
  ]);

  const userCounts = userResult[0]?.counts[0];
  const cafeCounts = cafeResult[0]?.counts[0];
  const supplierCounts = supplierResult[0]?.counts[0];

  return {
    users: {
      total: userCounts?.total ?? 0,
      active: userCounts?.active ?? 0,
      pending: userCounts?.pending ?? 0,
      suspended: userCounts?.suspended ?? 0,
      disabled: userCounts?.disabled ?? 0,
    },
    cafes: {
      total: cafeCounts?.total ?? 0,
      active: cafeCounts?.active ?? 0,
      pending: cafeCounts?.pending ?? 0,
      suspended: cafeCounts?.suspended ?? 0,
      rejected: cafeCounts?.rejected ?? 0,
    },
    suppliers: {
      total: supplierCounts?.total ?? 0,
      active: supplierCounts?.active ?? 0,
      pending: supplierCounts?.pending ?? 0,
      suspended: supplierCounts?.suspended ?? 0,
      rejected: supplierCounts?.rejected ?? 0,
      verified: supplierCounts?.verified ?? 0,
      unverified: supplierCounts?.unverified ?? 0,
    },
    latestUsers: (userResult[0]?.latest ?? []).map((doc) => ({
      id: doc._id.toString(),
      email: doc.email ?? "",
      firstName: doc.firstName,
      lastName: doc.lastName,
      status: doc.status ?? "pending",
      createdAt: (doc.createdAt ?? epoch).toISOString(),
    })),
    latestCafes: (cafeResult[0]?.latest ?? []).map((doc) => ({
      id: doc._id.toString(),
      name: doc.name ?? "",
      city: doc.city,
      status: doc.status ?? "pending",
      createdAt: (doc.createdAt ?? epoch).toISOString(),
    })),
    latestSuppliers: (supplierResult[0]?.latest ?? []).map((doc) => ({
      id: doc._id.toString(),
      businessName: doc.businessName ?? "",
      city: doc.city,
      status: doc.status ?? "pending",
      isVerified: doc.isVerified ?? false,
      createdAt: (doc.createdAt ?? epoch).toISOString(),
    })),
  };
}
