import { Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { Cafe } from "@/model/cafe";
import { CafeMember } from "@/model/cafe-member";
import { User } from "@/model/user";
import type { CafeStatus } from "@/src/domain/schemas/admin-cafe";
import {
  escapeAdminSearch,
  normalizeAdminPagination,
} from "@/src/lib/admin-query";
import { matchedExistingDocument } from "@/src/repositories/update-result";

// ---------------------------------------------------------------------------
// DTOs – fully serializable, no ObjectId / Mongoose Document
// ---------------------------------------------------------------------------

export type AdminCafeListItemDTO = {
  id: string;
  name: string;
  type: string;
  mobile?: string;
  phone?: string;
  city?: string;
  province?: string;
  status: string;
  isVerified: boolean;
  createdAt: string;
};

export type AdminCafeMemberDTO = {
  memberId: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  status: string;
  joinedAt: string | null;
};

export type AdminCafeDetailDTO = AdminCafeListItemDTO & {
  slug?: string;
  address?: string;
  postalCode?: string;
  logoUrl?: string;
  verifiedAt: string | null;
  updatedAt: string;
  members: AdminCafeMemberDTO[];
  memberCount: number;
};

export type AdminCafeListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: CafeStatus;
};

export type AdminCafeListResult = {
  items: AdminCafeListItemDTO[];
  total: number;
};

// ---------------------------------------------------------------------------
// Internal document shapes
// ---------------------------------------------------------------------------

type CafeListDoc = {
  _id: { toString(): string };
  name?: string;
  type?: string;
  mobile?: string;
  phone?: string;
  city?: string;
  province?: string;
  status?: string;
  isVerified?: boolean;
  createdAt?: Date;
};

type CafeDetailDoc = CafeListDoc & {
  slug?: string;
  address?: string;
  postalCode?: string;
  logoUrl?: string;
  verifiedAt?: Date | null;
  updatedAt?: Date;
};

type CafeMemberLeanDoc = {
  _id: { toString(): string };
  userId: { toString(): string };
  role?: string;
  status?: string;
  joinedAt?: Date | null;
};

type UserLeanDoc = {
  _id: { toString(): string };
  firstName?: string;
  lastName?: string;
  email?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const notDeleted = { deletedAt: null };

function toListItem(doc: CafeListDoc): AdminCafeListItemDTO {
  return {
    id: doc._id.toString(),
    name: doc.name ?? "",
    type: doc.type ?? "cafe",
    mobile: doc.mobile,
    phone: doc.phone,
    city: doc.city,
    province: doc.province,
    status: doc.status ?? "pending",
    isVerified: doc.isVerified ?? false,
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function findAdminCafeList(
  query: AdminCafeListQuery,
): Promise<AdminCafeListResult> {
  await dbConnect();

  const { pageSize, skip } = normalizeAdminPagination(
    query.page,
    query.pageSize,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = { ...notDeleted };

  if (query.status) {
    filter.status = query.status;
  }

  if (query.search) {
    const escaped = escapeAdminSearch(query.search);
    if (escaped) {
      const regex = { $regex: escaped, $options: "i" };
      // Only search fields that exist in the Cafe model
      filter.$or = [
        { name: regex },
        { mobile: regex },
        { phone: regex },
        { city: regex },
      ];
    }
  }

  const projection = "name type mobile phone city province status isVerified createdAt";

  const [docs, total] = await Promise.all([
    Cafe.find(filter)
      .select(projection)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Cafe.countDocuments(filter),
  ]);

  const items = (docs as unknown as CafeListDoc[]).map(toListItem);
  return { items, total };
}

// ---------------------------------------------------------------------------
// Detail – single cafe with members (no N+1)
// ---------------------------------------------------------------------------

export async function findAdminCafeDetail(
  cafeId: string,
): Promise<AdminCafeDetailDTO | null> {
  if (!Types.ObjectId.isValid(cafeId)) return null;
  await dbConnect();

  const cafe = (await Cafe.findOne({ _id: cafeId, ...notDeleted })
    .select(
      "name type slug mobile phone province city address postalCode logoUrl status isVerified verifiedAt createdAt updatedAt",
    )
    .lean()) as unknown as CafeDetailDoc | null;

  if (!cafe) return null;

  // Fetch members (not removed), bounded
  const memberDocs = (await CafeMember.find({
    cafeId,
    status: { $ne: "removed" },
  })
    .select("userId role status joinedAt")
    .limit(100)
    .lean()) as unknown as CafeMemberLeanDoc[];

  // Resolve user info in one $in query — no N+1
  const userIds = memberDocs.map((m) => m.userId.toString());
  const userDocs =
    userIds.length > 0
      ? ((await User.find({ _id: { $in: userIds } })
          .select("firstName lastName email")
          .lean()) as unknown as UserLeanDoc[])
      : [];

  const userMap = new Map(userDocs.map((u) => [u._id.toString(), u]));

  const members: AdminCafeMemberDTO[] = memberDocs.map((m) => {
    const u = userMap.get(m.userId.toString());
    return {
      memberId: m._id.toString(),
      userId: m.userId.toString(),
      firstName: u?.firstName,
      lastName: u?.lastName,
      email: u?.email ?? "",
      role: m.role ?? "",
      status: m.status ?? "",
      joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
    };
  });

  return {
    id: cafe._id.toString(),
    name: cafe.name ?? "",
    type: cafe.type ?? "cafe",
    slug: cafe.slug,
    mobile: cafe.mobile,
    phone: cafe.phone,
    city: cafe.city,
    province: cafe.province,
    address: cafe.address,
    postalCode: cafe.postalCode,
    logoUrl: cafe.logoUrl,
    status: cafe.status ?? "pending",
    isVerified: cafe.isVerified ?? false,
    verifiedAt: cafe.verifiedAt ? cafe.verifiedAt.toISOString() : null,
    createdAt: (cafe.createdAt ?? new Date()).toISOString(),
    updatedAt: (cafe.updatedAt ?? new Date()).toISOString(),
    members,
    memberCount: members.length,
  };
}

// ---------------------------------------------------------------------------
// Update status
// ---------------------------------------------------------------------------

export async function updateCafeStatus(
  cafeId: string,
  status: CafeStatus,
): Promise<boolean> {
  if (!Types.ObjectId.isValid(cafeId)) return false;
  await dbConnect();
  const result = await Cafe.updateOne(
    { _id: cafeId, ...notDeleted },
    { $set: { status } },
  );
  return matchedExistingDocument(result);
}
