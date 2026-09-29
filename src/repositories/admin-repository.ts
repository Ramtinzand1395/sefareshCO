import type { PipelineStage } from "mongoose";
import { Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { Cafe } from "@/model/cafe";
import { CafeMember } from "@/model/cafe-member";
import { Supplier } from "@/model/supplier";
import { SupplierMember } from "@/model/supplier-member";
import { User, type UserStatus } from "@/model/user";
import type { AdminUserListQuery } from "@/src/domain/admin";

type RecentRecord = {
  _id: Types.ObjectId;
  createdAt?: Date;
};

type RecentUserRecord = RecentRecord & {
  firstName?: string;
  lastName?: string;
  email?: string;
};

type RecentCafeRecord = RecentRecord & { name?: string; city?: string };
type RecentSupplierRecord = RecentRecord & {
  businessName?: string;
  city?: string;
};

export type AdminDashboardRecord = {
  counts: {
    users: { total: number; active: number; pending: number };
    cafes: { total: number; active: number };
    suppliers: { total: number; active: number; verified: number };
    incompleteOnboarding: number;
  };
  recentUsers: RecentUserRecord[];
  recentCafes: RecentCafeRecord[];
  recentSuppliers: RecentSupplierRecord[];
};

export type AdminUserListRecord = {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  mobile?: string;
  status: UserStatus;
  onboardingCompleted: boolean;
  isAdmin: boolean;
  cafeMembershipCount: number;
  supplierMembershipCount: number;
  createdAt: Date;
  lastLoginAt?: Date;
};

export type AdminUserDetailRecord = {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  mobile?: string;
  avatarUrl?: string;
  status: UserStatus;
  isAdmin: boolean;
  onboardingCompleted: boolean;
  onboardingCompletedAt?: Date;
  emailVerified: boolean;
  mobileVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  cafeMemberships: Array<{
    id: string;
    cafeId: string;
    cafeName: string;
    cafeStatus: string;
    role: string;
    status: string;
    joinedAt?: Date;
  }>;
  supplierMemberships: Array<{
    id: string;
    supplierId: string;
    supplierName: string;
    supplierStatus: string;
    role: string;
    status: string;
    joinedAt?: Date;
  }>;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getAdminDashboardRecord(): Promise<AdminDashboardRecord> {
  await dbConnect();
  const activeRecord = { deletedAt: null };

  const [
    userTotal,
    activeUsers,
    pendingUsers,
    incompleteOnboarding,
    cafeTotal,
    activeCafes,
    supplierTotal,
    activeSuppliers,
    verifiedSuppliers,
    recentUsers,
    recentCafes,
    recentSuppliers,
  ] = await Promise.all([
    User.countDocuments(activeRecord),
    User.countDocuments({ ...activeRecord, status: "active" }),
    User.countDocuments({ ...activeRecord, status: "pending" }),
    User.countDocuments({ ...activeRecord, onboardingCompleted: { $ne: true } }),
    Cafe.countDocuments(activeRecord),
    Cafe.countDocuments({ ...activeRecord, status: "active" }),
    Supplier.countDocuments(activeRecord),
    Supplier.countDocuments({ ...activeRecord, status: "active" }),
    Supplier.countDocuments({ ...activeRecord, isVerified: true }),
    User.find(activeRecord)
      .select("_id firstName lastName email createdAt")
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    Cafe.find(activeRecord)
      .select("_id name city createdAt")
      .sort({ createdAt: -1 })
      .limit(4)
      .lean(),
    Supplier.find(activeRecord)
      .select("_id businessName city createdAt")
      .sort({ createdAt: -1 })
      .limit(4)
      .lean(),
  ]);

  return {
    counts: {
      users: { total: userTotal, active: activeUsers, pending: pendingUsers },
      cafes: { total: cafeTotal, active: activeCafes },
      suppliers: {
        total: supplierTotal,
        active: activeSuppliers,
        verified: verifiedSuppliers,
      },
      incompleteOnboarding,
    },
    recentUsers: recentUsers as unknown as RecentUserRecord[],
    recentCafes: recentCafes as unknown as RecentCafeRecord[],
    recentSuppliers: recentSuppliers as unknown as RecentSupplierRecord[],
  };
}

export async function listAdminUsers(query: AdminUserListQuery) {
  await dbConnect();

  const match: Record<string, unknown> = { deletedAt: null };
  if (query.status !== "all") match.status = query.status;
  if (query.onboarding !== "all") {
    match.onboardingCompleted = query.onboarding === "complete";
  }
  if (query.query) {
    const search = new RegExp(escapeRegex(query.query), "i");
    match.$or = [
      { firstName: search },
      { lastName: search },
      { email: search },
      { mobile: search },
    ];
  }

  const pipeline: PipelineStage[] = [
    { $match: match },
    {
      $lookup: {
        from: CafeMember.collection.name,
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$userId", "$$userId"] },
                  { $eq: ["$status", "active"] },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: "cafeMemberships",
      },
    },
    {
      $lookup: {
        from: SupplierMember.collection.name,
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$userId", "$$userId"] },
                  { $eq: ["$status", "active"] },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: "supplierMemberships",
      },
    },
    {
      $set: {
        cafeMembershipCount: { $size: "$cafeMemberships" },
        supplierMembershipCount: { $size: "$supplierMemberships" },
      },
    },
  ];

  if (query.kind === "admin") pipeline.push({ $match: { isAdmin: true } });
  if (query.kind === "cafe") {
    pipeline.push({ $match: { cafeMembershipCount: { $gt: 0 } } });
  }
  if (query.kind === "supplier") {
    pipeline.push({ $match: { supplierMembershipCount: { $gt: 0 } } });
  }
  if (query.kind === "unassigned") {
    pipeline.push({
      $match: {
        isAdmin: { $ne: true },
        cafeMembershipCount: 0,
        supplierMembershipCount: 0,
      },
    });
  }

  pipeline.push({
    $facet: {
      items: [
        { $sort: { createdAt: -1, _id: -1 } },
        { $skip: (query.page - 1) * query.pageSize },
        { $limit: query.pageSize },
        {
          $project: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            email: { $ifNull: ["$email", ""] },
            mobile: 1,
            status: { $ifNull: ["$status", "pending"] },
            onboardingCompleted: { $ifNull: ["$onboardingCompleted", false] },
            isAdmin: { $ifNull: ["$isAdmin", false] },
            cafeMembershipCount: 1,
            supplierMembershipCount: 1,
            createdAt: 1,
            lastLoginAt: 1,
          },
        },
      ],
      metadata: [{ $count: "total" }],
    },
  });

  const [result] = await User.aggregate<{
    items: Array<{
      _id: Types.ObjectId;
      firstName?: string;
      lastName?: string;
      email: string;
      mobile?: string;
      status: UserStatus;
      onboardingCompleted: boolean;
      isAdmin: boolean;
      cafeMembershipCount: number;
      supplierMembershipCount: number;
      createdAt: Date;
      lastLoginAt?: Date;
    }>;
    metadata: Array<{ total: number }>;
  }>(pipeline);

  return {
    items: (result?.items ?? []).map((user) => ({
      ...user,
      id: user._id.toString(),
    })) as AdminUserListRecord[],
    total: result?.metadata[0]?.total ?? 0,
  };
}

export async function findAdminUserDetail(
  userId: string,
): Promise<AdminUserDetailRecord | null> {
  if (!Types.ObjectId.isValid(userId)) return null;
  await dbConnect();

  const user = await User.findOne({ _id: userId, deletedAt: null })
    .select(
      "_id firstName lastName email mobile avatarUrl status isAdmin onboardingCompleted onboardingCompletedAt emailVerified mobileVerified createdAt updatedAt lastLoginAt",
    )
    .lean();
  if (!user) return null;

  const [cafeMemberships, supplierMemberships] = await Promise.all([
    CafeMember.find({ userId })
      .select("_id cafeId role status joinedAt")
      .sort({ createdAt: -1 })
      .lean(),
    SupplierMember.find({ userId })
      .select("_id supplierId role status joinedAt")
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const cafeIds = cafeMemberships.map((membership) => membership.cafeId);
  const supplierIds = supplierMemberships.map(
    (membership) => membership.supplierId,
  );
  const [cafes, suppliers] = await Promise.all([
    Cafe.find({ _id: { $in: cafeIds } })
      .select("_id name status")
      .lean(),
    Supplier.find({ _id: { $in: supplierIds } })
      .select("_id businessName status")
      .lean(),
  ]);

  const cafeMap = new Map(
    cafes.map((cafe) => [cafe._id.toString(), cafe] as const),
  );
  const supplierMap = new Map(
    suppliers.map((supplier) => [supplier._id.toString(), supplier] as const),
  );
  const shaped = user as typeof user & {
    status?: UserStatus;
    createdAt: Date;
    updatedAt: Date;
  };

  return {
    id: shaped._id.toString(),
    firstName: shaped.firstName,
    lastName: shaped.lastName,
    email: shaped.email ?? "",
    mobile: shaped.mobile,
    avatarUrl: shaped.avatarUrl,
    status: shaped.status ?? "pending",
    isAdmin: shaped.isAdmin ?? false,
    onboardingCompleted: shaped.onboardingCompleted ?? false,
    onboardingCompletedAt: shaped.onboardingCompletedAt,
    emailVerified: shaped.emailVerified ?? false,
    mobileVerified: shaped.mobileVerified ?? false,
    createdAt: shaped.createdAt,
    updatedAt: shaped.updatedAt,
    lastLoginAt: shaped.lastLoginAt,
    cafeMemberships: cafeMemberships.map((membership) => {
      const cafeId = membership.cafeId.toString();
      const cafe = cafeMap.get(cafeId);
      return {
        id: membership._id.toString(),
        cafeId,
        cafeName: cafe?.name ?? "کافه حذف‌شده",
        cafeStatus: cafe?.status ?? "deleted",
        role: membership.role,
        status: membership.status,
        joinedAt: membership.joinedAt,
      };
    }),
    supplierMemberships: supplierMemberships.map((membership) => {
      const supplierId = membership.supplierId.toString();
      const supplier = supplierMap.get(supplierId);
      return {
        id: membership._id.toString(),
        supplierId,
        supplierName: supplier?.businessName ?? "تأمین‌کننده حذف‌شده",
        supplierStatus: supplier?.status ?? "deleted",
        role: membership.role,
        status: membership.status,
        joinedAt: membership.joinedAt,
      };
    }),
  };
}
