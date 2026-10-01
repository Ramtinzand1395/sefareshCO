import { Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import {
  InternalPurchaseRequest,
  type InternalRequestItemStatus,
  type InternalRequestStatus,
} from "@/model/internal-purchase-request";
import { Product } from "@/model/product";
import { User } from "@/model/user";
import { normalizeAdminPagination } from "@/src/lib/admin-query";

// ---------------------------------------------------------------------------
// DTOs – fully serializable, no ObjectId, Date, or Mongoose Documents
// ---------------------------------------------------------------------------

export type InternalRequestItemDTO = {
  id: string;
  itemType: "catalog" | "custom";
  productId?: string;
  productName?: string;
  productUnit?: string;
  customTitle?: string;
  customUnit?: string;
  requestedQuantity: number;
  approvedQuantity: number;
  status: InternalRequestItemStatus;
  note?: string;
};

export type InternalPurchaseRequestDetailDTO = {
  id: string;
  cafeId: string;
  requestedByUserId: string;
  requesterName?: string;
  title?: string;
  description?: string;
  status: InternalRequestStatus;
  items: InternalRequestItemDTO[];
  reviewedByUserId?: string;
  reviewerName?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  cancelledByUserId?: string;
  cancelledAt?: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type InternalPurchaseRequestListItemDTO = {
  id: string;
  cafeId: string;
  requestedByUserId: string;
  requesterName?: string;
  title?: string;
  description?: string;
  status: InternalRequestStatus;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type InternalPurchaseRequestListResult = {
  items: InternalPurchaseRequestListItemDTO[];
  total: number;
};

// ---------------------------------------------------------------------------
// Internal types for Mongoose Lean Documents
// ---------------------------------------------------------------------------

type InternalRequestItemLean = {
  _id: { toString(): string };
  itemType: "catalog" | "custom";
  productId?: { toString(): string } | null;
  customTitle?: string | null;
  customUnit?: string | null;
  requestedQuantity: number;
  approvedQuantity: number;
  status: InternalRequestItemStatus;
  note?: string | null;
};

type InternalPurchaseRequestLean = {
  _id: { toString(): string };
  cafeId: { toString(): string };
  requestedByUserId: { toString(): string };
  title?: string | null;
  description?: string | null;
  status: InternalRequestStatus;
  items: InternalRequestItemLean[];
  reviewedByUserId?: { toString(): string } | null;
  reviewedAt?: Date | null;
  reviewNotes?: string | null;
  cancelledByUserId?: { toString(): string } | null;
  cancelledAt?: Date | null;
  cancelReason?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

// ---------------------------------------------------------------------------
// Helper: Batch load user names (firstName + lastName)
// ---------------------------------------------------------------------------

async function batchLoadUserNames(
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const validIds = userIds
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  if (validIds.length === 0) return map;

  const users = await User.find({ _id: { $in: validIds } })
    .select("firstName lastName")
    .lean() as Array<{ _id: { toString(): string }; firstName?: string; lastName?: string }>;

  for (const u of users) {
    const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
    map.set(u._id.toString(), name || "کاربر");
  }

  return map;
}

// ---------------------------------------------------------------------------
// Helper: Batch load product metadata (name + unit)
// ---------------------------------------------------------------------------

async function batchLoadProducts(
  productIds: string[],
): Promise<Map<string, { name: string; unit: string }>> {
  const map = new Map<string, { name: string; unit: string }>();
  const validIds = productIds
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  if (validIds.length === 0) return map;

  const products = await Product.find({ _id: { $in: validIds } })
    .select("name unit")
    .lean() as Array<{ _id: { toString(): string }; name?: string; unit?: string }>;

  for (const p of products) {
    map.set(p._id.toString(), {
      name: p.name || "",
      unit: p.unit || "",
    });
  }

  return map;
}

// ---------------------------------------------------------------------------
// 1. Create Internal Purchase Request
// ---------------------------------------------------------------------------

export async function createInternalPurchaseRequest(data: {
  cafeId: string;
  requestedByUserId: string;
  title?: string;
  description?: string;
  items: Array<{
    itemType: "catalog" | "custom";
    productId?: string;
    customTitle?: string;
    customUnit?: string;
    requestedQuantity: number;
    note?: string;
  }>;
}): Promise<string> {
  await dbConnect();

  const formattedItems = data.items.map((item) => ({
    itemType: item.itemType,
    productId:
      item.itemType === "catalog" && item.productId
        ? new Types.ObjectId(item.productId)
        : null,
    customTitle: item.itemType === "custom" ? item.customTitle : null,
    customUnit: item.itemType === "custom" ? item.customUnit : null,
    requestedQuantity: item.requestedQuantity,
    approvedQuantity: 0,
    status: "pending",
    note: item.note ?? null,
  }));

  const doc = await InternalPurchaseRequest.create({
    cafeId: new Types.ObjectId(data.cafeId),
    requestedByUserId: new Types.ObjectId(data.requestedByUserId),
    title: data.title ?? null,
    description: data.description ?? null,
    status: "pending",
    items: formattedItems,
  });

  return doc._id.toString();
}

// ---------------------------------------------------------------------------
// 2. Find Internal Purchase Requests by Cafe (Paginated with stable sort)
// ---------------------------------------------------------------------------

export async function findInternalPurchaseRequestsByCafe(
  cafeId: string,
  options: {
    page: number;
    pageSize: number;
    status?: InternalRequestStatus;
  },
): Promise<InternalPurchaseRequestListResult> {
  if (!Types.ObjectId.isValid(cafeId)) {
    return { items: [], total: 0 };
  }

  await dbConnect();

  const { pageSize, skip } = normalizeAdminPagination(
    options.page,
    options.pageSize,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {
    cafeId: new Types.ObjectId(cafeId),
  };

  if (options.status) {
    filter.status = options.status;
  }

  const [rawDocs, total] = await Promise.all([
    InternalPurchaseRequest.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .select("cafeId requestedByUserId title description status items createdAt updatedAt")
      .lean() as Promise<InternalPurchaseRequestLean[]>,
    InternalPurchaseRequest.countDocuments(filter),
  ]);

  const userIds = Array.from(
    new Set(rawDocs.map((d) => d.requestedByUserId.toString())),
  );
  const userMap = await batchLoadUserNames(userIds);

  const items: InternalPurchaseRequestListItemDTO[] = rawDocs.map((doc) => ({
    id: doc._id.toString(),
    cafeId: doc.cafeId.toString(),
    requestedByUserId: doc.requestedByUserId.toString(),
    requesterName: userMap.get(doc.requestedByUserId.toString()),
    title: doc.title || undefined,
    description: doc.description || undefined,
    status: doc.status,
    itemCount: Array.isArray(doc.items) ? doc.items.length : 0,
    createdAt: doc.createdAt?.toISOString() ?? "",
    updatedAt: doc.updatedAt?.toISOString() ?? "",
  }));

  return { items, total };
}

// ---------------------------------------------------------------------------
// 3. Find Internal Purchase Request Detail by ID (Cafe-Scoped)
// ---------------------------------------------------------------------------

export async function findInternalPurchaseRequestById(
  cafeId: string,
  requestId: string,
): Promise<InternalPurchaseRequestDetailDTO | null> {
  if (!Types.ObjectId.isValid(cafeId) || !Types.ObjectId.isValid(requestId)) {
    return null;
  }

  await dbConnect();

  const doc = (await InternalPurchaseRequest.findOne({
    _id: new Types.ObjectId(requestId),
    cafeId: new Types.ObjectId(cafeId),
  }).lean()) as InternalPurchaseRequestLean | null;

  if (!doc) return null;

  // Collect user IDs for batch lookup
  const userIds: string[] = [doc.requestedByUserId.toString()];
  if (doc.reviewedByUserId) userIds.push(doc.reviewedByUserId.toString());
  if (doc.cancelledByUserId) userIds.push(doc.cancelledByUserId.toString());
  const userMap = await batchLoadUserNames(userIds);

  // Collect catalog product IDs for batch lookup
  const catalogProductIds: string[] = [];
  for (const item of doc.items) {
    if (item.itemType === "catalog" && item.productId) {
      catalogProductIds.push(item.productId.toString());
    }
  }
  const productMap = await batchLoadProducts(catalogProductIds);

  const itemsDTO: InternalRequestItemDTO[] = doc.items.map((item) => {
    const base: InternalRequestItemDTO = {
      id: item._id.toString(),
      itemType: item.itemType,
      requestedQuantity: item.requestedQuantity,
      approvedQuantity: item.approvedQuantity,
      status: item.status,
      note: item.note || undefined,
    };

    if (item.itemType === "catalog" && item.productId) {
      const pid = item.productId.toString();
      base.productId = pid;
      const productInfo = productMap.get(pid);
      if (productInfo) {
        base.productName = productInfo.name;
        base.productUnit = productInfo.unit;
      }
    } else {
      base.customTitle = item.customTitle || undefined;
      base.customUnit = item.customUnit || undefined;
    }

    return base;
  });

  return {
    id: doc._id.toString(),
    cafeId: doc.cafeId.toString(),
    requestedByUserId: doc.requestedByUserId.toString(),
    requesterName: userMap.get(doc.requestedByUserId.toString()),
    title: doc.title || undefined,
    description: doc.description || undefined,
    status: doc.status,
    items: itemsDTO,
    reviewedByUserId: doc.reviewedByUserId?.toString() || undefined,
    reviewerName: doc.reviewedByUserId
      ? userMap.get(doc.reviewedByUserId.toString())
      : undefined,
    reviewedAt: doc.reviewedAt?.toISOString() || undefined,
    reviewNotes: doc.reviewNotes || undefined,
    cancelledByUserId: doc.cancelledByUserId?.toString() || undefined,
    cancelledAt: doc.cancelledAt?.toISOString() || undefined,
    cancelReason: doc.cancelReason || undefined,
    createdAt: doc.createdAt?.toISOString() ?? "",
    updatedAt: doc.updatedAt?.toISOString() ?? "",
  };
}

// ---------------------------------------------------------------------------
// 4. Atomic Review Internal Purchase Request
// Precondition: status must be "pending" and cafeId must match.
// ---------------------------------------------------------------------------

export async function atomicReviewInternalPurchaseRequest(params: {
  cafeId: string;
  requestId: string;
  reviewerUserId: string;
  derivedStatus: "approved" | "partially_approved" | "rejected";
  reviewNotes?: string;
  reviewedItems: Array<{
    id: string;
    approvedQuantity: number;
    status: InternalRequestItemStatus;
    note?: string;
  }>;
}): Promise<boolean> {
  if (
    !Types.ObjectId.isValid(params.cafeId) ||
    !Types.ObjectId.isValid(params.requestId) ||
    !Types.ObjectId.isValid(params.reviewerUserId)
  ) {
    return false;
  }

  await dbConnect();

  // Find doc first with status precondition
  const existing = await InternalPurchaseRequest.findOne({
    _id: new Types.ObjectId(params.requestId),
    cafeId: new Types.ObjectId(params.cafeId),
    status: "pending",
  });

  if (!existing) return false;

  const reviewMap = new Map(
    params.reviewedItems.map((r) => [r.id, r]),
  );

  // Update existing items in place
  for (const item of existing.items) {
    const review = reviewMap.get(item._id.toString());
    if (review) {
      item.approvedQuantity = review.approvedQuantity;
      item.status = review.status;
      if (review.note !== undefined) {
        item.note = review.note;
      }
    }
  }

  existing.status = params.derivedStatus;
  existing.reviewedByUserId = new Types.ObjectId(params.reviewerUserId);
  existing.reviewedAt = new Date();
  existing.reviewNotes = params.reviewNotes ?? null;

  // Save with optimistic concurrency / version check or pending condition
  const result = await InternalPurchaseRequest.updateOne(
    {
      _id: existing._id,
      cafeId: existing.cafeId,
      status: "pending",
    },
    {
      $set: {
        status: existing.status,
        items: existing.items,
        reviewedByUserId: existing.reviewedByUserId,
        reviewedAt: existing.reviewedAt,
        reviewNotes: existing.reviewNotes,
      },
    },
  );

  return result.modifiedCount > 0;
}

// ---------------------------------------------------------------------------
// 5. Atomic Cancel Internal Purchase Request
// Precondition: status must be "pending" and cafeId must match.
// ---------------------------------------------------------------------------

export async function atomicCancelInternalPurchaseRequest(params: {
  cafeId: string;
  requestId: string;
  cancelledByUserId: string;
  cancelReason?: string;
}): Promise<boolean> {
  if (
    !Types.ObjectId.isValid(params.cafeId) ||
    !Types.ObjectId.isValid(params.requestId) ||
    !Types.ObjectId.isValid(params.cancelledByUserId)
  ) {
    return false;
  }

  await dbConnect();

  const result = await InternalPurchaseRequest.updateOne(
    {
      _id: new Types.ObjectId(params.requestId),
      cafeId: new Types.ObjectId(params.cafeId),
      status: "pending",
    },
    {
      $set: {
        status: "cancelled",
        cancelledByUserId: new Types.ObjectId(params.cancelledByUserId),
        cancelledAt: new Date(),
        cancelReason: params.cancelReason ?? null,
      },
    },
  );

  return result.modifiedCount > 0;
}
