import { Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { Supplier } from "@/model/supplier";
import { SupplierMember } from "@/model/supplier-member";
import { User } from "@/model/user";
import type { SupplierStatus } from "@/src/domain/schemas/admin-supplier";
import {
  escapeAdminSearch,
  normalizeAdminPagination,
} from "@/src/lib/admin-query";
import { matchedExistingDocument } from "@/src/repositories/update-result";

// ---------------------------------------------------------------------------
// DTOs – fully serializable, no ObjectId / Mongoose Document
// ---------------------------------------------------------------------------

export type AdminSupplierListItemDTO = {
  id: string;
  businessName: string;
  legalName?: string;
  mobile?: string;
  phone?: string;
  city?: string;
  province?: string;
  status: string;
  isVerified: boolean;
  verifiedAt: string | null;
  createdAt: string;
};

export type AdminSupplierMemberDTO = {
  memberId: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  status: string;
  joinedAt: string | null;
};

export type AdminSupplierDetailDTO = AdminSupplierListItemDTO & {
  nationalId?: string;
  economicCode?: string;
  address?: string;
  postalCode?: string;
  minimumOrderAmount: number;
  description?: string;
  logoUrl?: string;
  verifiedByAdminId?: string;
  members: AdminSupplierMemberDTO[];
  memberCount: number;
};

export type AdminSupplierListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: SupplierStatus;
  isVerified?: boolean;
};

export type AdminSupplierListResult = {
  items: AdminSupplierListItemDTO[];
  total: number;
};

// ---------------------------------------------------------------------------
// Internal document shapes
// ---------------------------------------------------------------------------

type SupplierListDoc = {
  _id: { toString(): string };
  businessName?: string;
  legalName?: string;
  mobile?: string;
  phone?: string;
  city?: string;
  province?: string;
  status?: string;
  isVerified?: boolean;
  verifiedAt?: Date | null;
  createdAt?: Date;
};

type SupplierDetailDoc = SupplierListDoc & {
  nationalId?: string;
  economicCode?: string;
  address?: string;
  postalCode?: string;
  minimumOrderAmount?: number;
  description?: string;
  logoUrl?: string;
  verifiedByAdminId?: { toString(): string } | null;
};

type SupplierMemberLeanDoc = {
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

function toListItem(doc: SupplierListDoc): AdminSupplierListItemDTO {
  return {
    id: doc._id.toString(),
    businessName: doc.businessName ?? "",
    legalName: doc.legalName,
    mobile: doc.mobile,
    phone: doc.phone,
    city: doc.city,
    province: doc.province,
    status: doc.status ?? "pending",
    isVerified: doc.isVerified ?? false,
    verifiedAt: doc.verifiedAt ? doc.verifiedAt.toISOString() : null,
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// List with pagination / search / filters
// ---------------------------------------------------------------------------

export async function findAdminSupplierList(
  query: AdminSupplierListQuery,
): Promise<AdminSupplierListResult> {
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

  if (query.isVerified !== undefined) {
    filter.isVerified = query.isVerified;
  }

  if (query.search) {
    const escaped = escapeAdminSearch(query.search);
    if (escaped) {
      const regex = { $regex: escaped, $options: "i" };
      filter.$or = [
        { businessName: regex },
        { legalName: regex },
        { mobile: regex },
        { phone: regex },
        { nationalId: regex },
        { city: regex },
      ];
    }
  }

  const projection =
    "businessName legalName mobile phone city province status isVerified verifiedAt createdAt";

  const [docs, total] = await Promise.all([
    Supplier.find(filter)
      .select(projection)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Supplier.countDocuments(filter),
  ]);

  const items = (docs as unknown as SupplierListDoc[]).map(toListItem);
  return { items, total };
}

// ---------------------------------------------------------------------------
// Detail – single supplier with members (no N+1)
// ---------------------------------------------------------------------------

export async function findAdminSupplierDetail(
  supplierId: string,
): Promise<AdminSupplierDetailDTO | null> {
  if (!Types.ObjectId.isValid(supplierId)) return null;
  await dbConnect();

  const supplier = (await Supplier.findOne({
    _id: supplierId,
    ...notDeleted,
  })
    .select(
      "businessName legalName nationalId economicCode mobile phone province city address postalCode status isVerified verifiedAt verifiedByAdminId minimumOrderAmount description logoUrl createdAt",
    )
    .lean()) as unknown as SupplierDetailDoc | null;

  if (!supplier) return null;

  // Fetch members — not removed
  const memberDocs = (await SupplierMember.find({
    supplierId,
    status: { $ne: "removed" },
  })
    .select("userId role status joinedAt")
    .lean()) as unknown as SupplierMemberLeanDoc[];

  // Resolve user info in one $in query (no N+1)
  const userIds = memberDocs.map((m) => m.userId.toString());
  const userDocs =
    userIds.length > 0
      ? ((await User.find({ _id: { $in: userIds } })
          .select("firstName lastName email")
          .lean()) as unknown as UserLeanDoc[])
      : [];

  const userMap = new Map(
    userDocs.map((u) => [u._id.toString(), u]),
  );

  const members: AdminSupplierMemberDTO[] = memberDocs.map((m) => {
    const u = userMap.get(m.userId.toString());
    return {
      memberId: m._id.toString(),
      userId: m.userId.toString(),
      firstName: u?.firstName,
      lastName: u?.lastName,
      // never expose passwordHash; email is safe for admin view
      email: u?.email ?? "",
      role: m.role ?? "",
      status: m.status ?? "",
      joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
    };
  });

  return {
    id: supplier._id.toString(),
    businessName: supplier.businessName ?? "",
    legalName: supplier.legalName,
    nationalId: supplier.nationalId,
    economicCode: supplier.economicCode,
    mobile: supplier.mobile,
    phone: supplier.phone,
    city: supplier.city,
    province: supplier.province,
    address: supplier.address,
    postalCode: supplier.postalCode,
    status: supplier.status ?? "pending",
    isVerified: supplier.isVerified ?? false,
    verifiedAt: supplier.verifiedAt ? supplier.verifiedAt.toISOString() : null,
    verifiedByAdminId: supplier.verifiedByAdminId?.toString(),
    minimumOrderAmount: supplier.minimumOrderAmount ?? 0,
    description: supplier.description,
    logoUrl: supplier.logoUrl,
    createdAt: (supplier.createdAt ?? new Date()).toISOString(),
    members,
    memberCount: members.length,
  };
}

// ---------------------------------------------------------------------------
// Update status
// ---------------------------------------------------------------------------

export async function updateSupplierStatus(
  supplierId: string,
  status: SupplierStatus,
): Promise<boolean> {
  if (!Types.ObjectId.isValid(supplierId)) return false;
  await dbConnect();
  const result = await Supplier.updateOne(
    { _id: supplierId, ...notDeleted },
    { $set: { status } },
  );
  return matchedExistingDocument(result);
}

// ---------------------------------------------------------------------------
// Update verification
// ---------------------------------------------------------------------------

export async function updateSupplierVerification(
  supplierId: string,
  isVerified: boolean,
  adminId: string,
): Promise<boolean> {
  if (!Types.ObjectId.isValid(supplierId)) return false;
  if (!Types.ObjectId.isValid(adminId)) {
    throw new TypeError("Invalid admin identifier");
  }
  await dbConnect();
  const result = await Supplier.updateOne(
    { _id: supplierId, ...notDeleted },
    {
      $set: {
        isVerified,
        verifiedAt: isVerified ? new Date() : null,
        // Store which admin performed the action (audit trail)
        verifiedByAdminId: isVerified ? adminId : null,
      },
    },
  );
  return matchedExistingDocument(result);
}
