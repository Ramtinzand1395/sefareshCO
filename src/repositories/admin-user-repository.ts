import dbConnect from "@/lib/mongodb";
import { User } from "@/model/user";
import { CafeMember } from "@/model/cafe-member";
import { SupplierMember } from "@/model/supplier-member";
import { Cafe } from "@/model/cafe";
import { Supplier } from "@/model/supplier";
import type { UserStatus } from "@/src/domain/schemas/admin-user";

// ---------------------------------------------------------------------------
// DTO types – fully serializable, no ObjectId / Mongoose Document
// ---------------------------------------------------------------------------

export type AdminUserListItemDTO = {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  mobile?: string;
  status: string;
  isAdmin: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export type AdminUserDetailDTO = AdminUserListItemDTO & {
  mobileVerified: boolean;
  emailVerified: boolean;
  avatarUrl?: string;
  cafeMemberships: AdminCafeMembershipDTO[];
  supplierMemberships: AdminSupplierMembershipDTO[];
};

export type AdminCafeMembershipDTO = {
  cafeId: string;
  cafeName: string;
  role: string;
  status: string;
};

export type AdminSupplierMembershipDTO = {
  supplierId: string;
  supplierName: string;
  role: string;
  status: string;
};

export type AdminUserListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: UserStatus;
  isAdmin?: boolean;
};

export type AdminUserListResult = {
  items: AdminUserListItemDTO[];
  total: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_PAGE_SIZE = 50;
const notDeleted = { deletedAt: null };

/** Escape user-supplied text so it can be used inside a RegExp safely. */
function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type UserListDoc = {
  _id: { toString(): string };
  firstName?: string;
  lastName?: string;
  email?: string;
  mobile?: string;
  status?: string;
  isAdmin?: boolean;
  onboardingCompleted?: boolean;
  createdAt?: Date;
  lastLoginAt?: Date | null;
};

function toListItem(doc: UserListDoc): AdminUserListItemDTO {
  return {
    id: doc._id.toString(),
    firstName: doc.firstName,
    lastName: doc.lastName,
    email: doc.email ?? "",
    mobile: doc.mobile,
    status: doc.status ?? "pending",
    isAdmin: doc.isAdmin ?? false,
    onboardingCompleted: doc.onboardingCompleted ?? false,
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
    lastLoginAt: doc.lastLoginAt ? doc.lastLoginAt.toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// List with pagination / search / filters
// ---------------------------------------------------------------------------

export async function findAdminUserList(
  query: AdminUserListQuery,
): Promise<AdminUserListResult> {
  await dbConnect();

  const page = Math.max(1, query.page);
  const pageSize = Math.min(Math.max(1, query.pageSize), MAX_PAGE_SIZE);
  const skip = (page - 1) * pageSize;

  // Build filter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = { ...notDeleted };

  if (query.status) {
    filter.status = query.status;
  }

  if (query.isAdmin !== undefined) {
    filter.isAdmin = query.isAdmin;
  }

  if (query.search) {
    const escaped = escapeRegex(query.search.trim());
    if (escaped) {
      const regex = { $regex: escaped, $options: "i" };
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { mobile: regex },
      ];
    }
  }

  const projection =
    "firstName lastName email mobile status isAdmin onboardingCompleted createdAt lastLoginAt";

  const [docs, total] = await Promise.all([
    User.find(filter)
      .select(projection)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    User.countDocuments(filter),
  ]);

  const items = (docs as unknown as UserListDoc[]).map(toListItem);

  return { items, total };
}

// ---------------------------------------------------------------------------
// Detail – single user with memberships (avoids N+1 via Promise.all)
// ---------------------------------------------------------------------------

type UserDetailDoc = UserListDoc & {
  mobileVerified?: boolean;
  emailVerified?: boolean;
  avatarUrl?: string;
};

type CafeMemberDoc = {
  cafeId: { toString(): string };
  role?: string;
  status?: string;
};

type SupplierMemberDoc = {
  supplierId: { toString(): string };
  role?: string;
  status?: string;
};

type CafeDoc = {
  _id: { toString(): string };
  name?: string;
};

type SupplierDoc = {
  _id: { toString(): string };
  businessName?: string;
};

export async function findAdminUserDetail(
  userId: string,
): Promise<AdminUserDetailDTO | null> {
  await dbConnect();

  const user = (await User.findOne({ _id: userId, ...notDeleted })
    .select(
      "firstName lastName email mobile status isAdmin onboardingCompleted createdAt lastLoginAt mobileVerified emailVerified avatarUrl",
    )
    .lean()) as unknown as UserDetailDoc | null;

  if (!user) return null;

  // Fetch memberships in parallel
  const [cafeMemberDocs, supplierMemberDocs] = await Promise.all([
    CafeMember.find({ userId, status: { $ne: "removed" } })
      .select("cafeId role status")
      .lean() as Promise<unknown>,
    SupplierMember.find({ userId, status: { $ne: "removed" } })
      .select("supplierId role status")
      .lean() as Promise<unknown>,
  ]);

  const cafeMembers = cafeMemberDocs as CafeMemberDoc[];
  const supplierMembers = supplierMemberDocs as SupplierMemberDoc[];

  // Resolve entity names in parallel (avoid N+1)
  const cafeIds = cafeMembers.map((m) => m.cafeId.toString());
  const supplierIds = supplierMembers.map((m) => m.supplierId.toString());

  const [cafeDocs, supplierDocs] = await Promise.all([
    cafeIds.length > 0
      ? (Cafe.find({ _id: { $in: cafeIds } })
          .select("name")
          .lean() as Promise<unknown>)
      : Promise.resolve([]),
    supplierIds.length > 0
      ? (Supplier.find({ _id: { $in: supplierIds } })
          .select("businessName")
          .lean() as Promise<unknown>)
      : Promise.resolve([]),
  ]);

  const cafeMap = new Map(
    (cafeDocs as CafeDoc[]).map((c) => [c._id.toString(), c.name ?? ""]),
  );
  const supplierMap = new Map(
    (supplierDocs as SupplierDoc[]).map((s) => [
      s._id.toString(),
      s.businessName ?? "",
    ]),
  );

  const cafeMemberships: AdminCafeMembershipDTO[] = cafeMembers.map((m) => ({
    cafeId: m.cafeId.toString(),
    cafeName: cafeMap.get(m.cafeId.toString()) ?? "",
    role: m.role ?? "",
    status: m.status ?? "",
  }));

  const supplierMemberships: AdminSupplierMembershipDTO[] =
    supplierMembers.map((m) => ({
      supplierId: m.supplierId.toString(),
      supplierName: supplierMap.get(m.supplierId.toString()) ?? "",
      role: m.role ?? "",
      status: m.status ?? "",
    }));

  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email ?? "",
    mobile: user.mobile,
    status: user.status ?? "pending",
    isAdmin: user.isAdmin ?? false,
    onboardingCompleted: user.onboardingCompleted ?? false,
    createdAt: (user.createdAt ?? new Date()).toISOString(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    mobileVerified: user.mobileVerified ?? false,
    emailVerified: user.emailVerified ?? false,
    avatarUrl: user.avatarUrl,
    cafeMemberships,
    supplierMemberships,
  };
}

// ---------------------------------------------------------------------------
// Update status
// ---------------------------------------------------------------------------

export async function updateUserStatus(userId: string, status: UserStatus) {
  await dbConnect();
  const result = await User.updateOne(
    { _id: userId, ...notDeleted },
    { $set: { status } },
  );
  return result.modifiedCount > 0;
}
