import { Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import {
  PurchaseRequest,
  type PurchaseRequestItemType,
  type PurchaseRequestStatus,
} from "@/model/purchase-request";
import { ShoppingList } from "@/model/shopping-list";
import { User } from "@/model/user";
import { normalizeAdminPagination } from "@/src/lib/admin-query";
import {
  generatePurchaseRequestReference,
  type PurchaseRequestDetailDTO,
  type PurchaseRequestItemDTO,
  type PurchaseRequestListItemDTO,
  type PurchaseRequestListResult,
  type PurchaseRequestProductSnapshot,
} from "@/src/domain/purchase-request";

// ---------------------------------------------------------------------------
// Internal Lean Types
// ---------------------------------------------------------------------------

type PurchaseRequestAllocationLean = {
  shoppingListItemId: { toString(): string };
  quantity: number;
};

type PurchaseRequestItemLean = {
  _id: { toString(): string };
  itemType: PurchaseRequestItemType;
  productId?: { toString(): string } | null;
  productSnapshot?: PurchaseRequestProductSnapshot | null;
  customTitle?: string | null;
  customUnit?: string | null;
  quantity: number;
  note?: string | null;
  allocations: PurchaseRequestAllocationLean[];
};

type PurchaseRequestLean = {
  _id: { toString(): string };
  cafeId: { toString(): string };
  referenceNumber: string;
  createdByUserId: { toString(): string };
  title?: string | null;
  note?: string | null;
  neededByDate?: Date | null;
  status: PurchaseRequestStatus;
  items: PurchaseRequestItemLean[];
  idempotencyKey?: string | null;
  submittedAt?: Date | null;
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

  const users = (await User.find({ _id: { $in: validIds } })
    .select("firstName lastName")
    .lean()) as Array<{
    _id: { toString(): string };
    firstName?: string;
    lastName?: string;
  }>;

  for (const u of users) {
    const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
    map.set(u._id.toString(), fullName);
  }

  return map;
}

// ---------------------------------------------------------------------------
// Helper: Map Lean Document to Serializable PurchaseRequestDetailDTO
// ---------------------------------------------------------------------------

function mapDocToDetailDTO(
  doc: PurchaseRequestLean,
  userMap: Map<string, string>,
): PurchaseRequestDetailDTO {
  const items: PurchaseRequestItemDTO[] = (doc.items || []).map((item) => {
    const dto: PurchaseRequestItemDTO = {
      id: item._id.toString(),
      itemType: item.itemType,
      quantity: item.quantity,
      note: item.note || undefined,
      allocations: (item.allocations || []).map((alloc) => ({
        shoppingListItemId: alloc.shoppingListItemId.toString(),
        quantity: alloc.quantity,
      })),
    };

    if (item.itemType === "catalog" && item.productId) {
      dto.productId = item.productId.toString();
      if (item.productSnapshot) {
        dto.productSnapshot = {
          name: item.productSnapshot.name,
          unit: item.productSnapshot.unit,
          brand: item.productSnapshot.brand || undefined,
          categoryName: item.productSnapshot.categoryName || undefined,
        };
      }
    } else {
      dto.customTitle = item.customTitle || undefined;
      dto.customUnit = item.customUnit || undefined;
    }

    return dto;
  });

  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

  return {
    id: doc._id.toString(),
    referenceNumber: doc.referenceNumber,
    cafeId: doc.cafeId.toString(),
    createdByUserId: doc.createdByUserId.toString(),
    creatorName: userMap.get(doc.createdByUserId.toString()) || undefined,
    title: doc.title || undefined,
    note: doc.note || undefined,
    neededByDate: doc.neededByDate ? doc.neededByDate.toISOString() : undefined,
    status: doc.status,
    items,
    totalQuantity,
    itemCount: items.length,
    submittedAt: doc.submittedAt ? doc.submittedAt.toISOString() : undefined,
    cancelledAt: doc.cancelledAt ? doc.cancelledAt.toISOString() : undefined,
    cancelledByUserId: doc.cancelledByUserId
      ? doc.cancelledByUserId.toString()
      : undefined,
    cancellerName: doc.cancelledByUserId
      ? userMap.get(doc.cancelledByUserId.toString()) || undefined
      : undefined,
    cancelReason: doc.cancelReason || undefined,
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : "",
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : "",
  };
}

// ---------------------------------------------------------------------------
// 1. Shopping List Lock (Concurrency Control)
// Ensures only one RFQ creation or modification runs per cafe shopping list
// ---------------------------------------------------------------------------

export async function acquireShoppingListLock(
  cafeId: string,
  lockId: string,
  ttlMs = 15000,
): Promise<boolean> {
  if (!Types.ObjectId.isValid(cafeId)) return false;

  await dbConnect();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  const updated = await ShoppingList.findOneAndUpdate(
    {
      cafeId: new Types.ObjectId(cafeId),
      status: "active",
      $or: [
        { lockId: null },
        { lockExpiresAt: null },
        { lockExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        lockId,
        lockExpiresAt: expiresAt,
      },
    },
    { returnDocument: "after" },
  );

  return Boolean(updated);
}

export async function releaseShoppingListLock(
  cafeId: string,
  lockId: string,
): Promise<void> {
  if (!Types.ObjectId.isValid(cafeId)) return;

  await dbConnect();
  await ShoppingList.updateOne(
    {
      cafeId: new Types.ObjectId(cafeId),
      status: "active",
      lockId,
    },
    {
      $set: {
        lockId: null,
        lockExpiresAt: null,
      },
    },
  );
}

// ---------------------------------------------------------------------------
// 2. Query Active Shopping List Allocations (Cafe-Scoped)
// Sums allocated quantities across all active ("draft" and "submitted") RFQs.
// Cancelled RFQs are automatically excluded.
// ---------------------------------------------------------------------------

export async function getShoppingListAllocations(
  cafeId: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!Types.ObjectId.isValid(cafeId)) return map;

  await dbConnect();

  const results = await PurchaseRequest.aggregate([
    {
      $match: {
        cafeId: new Types.ObjectId(cafeId),
        status: { $in: ["draft", "submitted"] },
      },
    },
    { $unwind: "$items" },
    { $unwind: "$items.allocations" },
    {
      $group: {
        _id: "$items.allocations.shoppingListItemId",
        totalAllocated: { $sum: "$items.allocations.quantity" },
      },
    },
  ]);

  for (const row of results) {
    if (row._id) {
      map.set(row._id.toString(), row.totalAllocated || 0);
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// 3. Find Purchase Request by Idempotency Key (Cafe-Scoped)
// ---------------------------------------------------------------------------

export async function findPurchaseRequestByIdempotencyKey(
  cafeId: string,
  idempotencyKey: string,
): Promise<PurchaseRequestDetailDTO | null> {
  if (!Types.ObjectId.isValid(cafeId) || !idempotencyKey) return null;

  await dbConnect();

  const doc = (await PurchaseRequest.findOne({
    cafeId: new Types.ObjectId(cafeId),
    idempotencyKey,
  }).lean()) as PurchaseRequestLean | null;

  if (!doc) return null;

  const userIds: string[] = [doc.createdByUserId.toString()];
  if (doc.cancelledByUserId) userIds.push(doc.cancelledByUserId.toString());
  const userMap = await batchLoadUserNames(userIds);

  return mapDocToDetailDTO(doc, userMap);
}

// ---------------------------------------------------------------------------
// 4. Create Purchase Request
// ---------------------------------------------------------------------------

export type CreatePurchaseRequestRepoParams = {
  cafeId: string;
  createdByUserId: string;
  title?: string;
  note?: string;
  neededByDate?: Date | null;
  status: "draft" | "submitted";
  idempotencyKey?: string | null;
  items: Array<{
    itemType: "catalog" | "custom";
    productId?: string;
    productSnapshot?: PurchaseRequestProductSnapshot;
    customTitle?: string;
    customUnit?: string;
    quantity: number;
    note?: string;
    allocations: Array<{
      shoppingListItemId: string;
      quantity: number;
    }>;
  }>;
};

export async function createPurchaseRequest(
  params: CreatePurchaseRequestRepoParams,
): Promise<PurchaseRequestDetailDTO> {
  if (
    !Types.ObjectId.isValid(params.cafeId) ||
    !Types.ObjectId.isValid(params.createdByUserId)
  ) {
    throw new Error("شناسه‌های ایجاد استعلام قیمت نامعتبر است");
  }

  await dbConnect();

  const cafeObjId = new Types.ObjectId(params.cafeId);
  const userObjId = new Types.ObjectId(params.createdByUserId);

  const formattedItems = params.items.map((item) => ({
    _id: new Types.ObjectId(),
    itemType: item.itemType,
    productId:
      item.itemType === "catalog" && item.productId
        ? new Types.ObjectId(item.productId)
        : null,
    productSnapshot: item.productSnapshot
      ? {
          name: item.productSnapshot.name,
          unit: item.productSnapshot.unit,
          brand: item.productSnapshot.brand || null,
          categoryName: item.productSnapshot.categoryName || null,
        }
      : null,
    customTitle: item.itemType === "custom" ? item.customTitle ?? null : null,
    customUnit: item.itemType === "custom" ? item.customUnit ?? null : null,
    quantity: item.quantity,
    note: item.note || null,
    allocations: item.allocations.map((alloc) => ({
      shoppingListItemId: new Types.ObjectId(alloc.shoppingListItemId),
      quantity: alloc.quantity,
    })),
  }));

  const now = new Date();
  const submittedAt = params.status === "submitted" ? now : null;

  // Collision-safe retry loop for referenceNumber generation
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    attempts++;
    const referenceNumber = generatePurchaseRequestReference();

    try {
      const doc = await PurchaseRequest.create({
        cafeId: cafeObjId,
        referenceNumber,
        createdByUserId: userObjId,
        title: params.title || null,
        note: params.note || null,
        neededByDate: params.neededByDate || null,
        status: params.status,
        items: formattedItems,
        idempotencyKey: params.idempotencyKey || null,
        submittedAt,
        createdAt: now,
        updatedAt: now,
      });

      const userMap = await batchLoadUserNames([params.createdByUserId]);
      return mapDocToDetailDTO(doc.toObject() as PurchaseRequestLean, userMap);
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mongoError = error as any;
      if (mongoError?.code === 11000) {
        // If collision on idempotency key, fetch the winner
        if (
          mongoError?.keyPattern?.idempotencyKey &&
          params.idempotencyKey
        ) {
          const existing = await findPurchaseRequestByIdempotencyKey(
            params.cafeId,
            params.idempotencyKey,
          );
          if (existing) return existing;
        }
        // If collision on referenceNumber, retry
        if (mongoError?.keyPattern?.referenceNumber) {
          continue;
        }
      }
      throw error;
    }
  }

  throw new Error("خطا در ایجاد شماره پیگیری یکتا برای استعلام قیمت");
}

// ---------------------------------------------------------------------------
// 5. Find Purchase Request by ID or Reference Number (Cafe-Scoped)
// ---------------------------------------------------------------------------

export async function findPurchaseRequestById(
  cafeId: string,
  idOrRef: string,
): Promise<PurchaseRequestDetailDTO | null> {
  if (!Types.ObjectId.isValid(cafeId) || !idOrRef) return null;

  await dbConnect();

  const query: Record<string, unknown> = {
    cafeId: new Types.ObjectId(cafeId),
  };

  if (Types.ObjectId.isValid(idOrRef)) {
    query._id = new Types.ObjectId(idOrRef);
  } else {
    query.referenceNumber = idOrRef.trim().toUpperCase();
  }

  const doc = (await PurchaseRequest.findOne(query).lean()) as PurchaseRequestLean | null;
  if (!doc) return null;

  const userIds: string[] = [doc.createdByUserId.toString()];
  if (doc.cancelledByUserId) userIds.push(doc.cancelledByUserId.toString());
  const userMap = await batchLoadUserNames(userIds);

  return mapDocToDetailDTO(doc, userMap);
}

// ---------------------------------------------------------------------------
// 6. List Purchase Requests by Cafe (Paginated with Deterministic Sort)
// ---------------------------------------------------------------------------

export async function listPurchaseRequestsByCafe(
  cafeId: string,
  options: {
    page: number;
    pageSize: number;
    status?: PurchaseRequestStatus;
  },
): Promise<PurchaseRequestListResult> {
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
    PurchaseRequest.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .select(
        "cafeId referenceNumber createdByUserId title status items neededByDate submittedAt cancelledAt createdAt updatedAt",
      )
      .lean() as Promise<PurchaseRequestLean[]>,
    PurchaseRequest.countDocuments(filter),
  ]);

  const userIds = Array.from(
    new Set(rawDocs.map((d) => d.createdByUserId.toString())),
  );
  const userMap = await batchLoadUserNames(userIds);

  const items: PurchaseRequestListItemDTO[] = rawDocs.map((doc) => {
    const rawItems = doc.items || [];
    const totalQuantity = rawItems.reduce(
      (sum, i) => sum + (i.quantity || 0),
      0,
    );

    return {
      id: doc._id.toString(),
      referenceNumber: doc.referenceNumber,
      cafeId: doc.cafeId.toString(),
      createdByUserId: doc.createdByUserId.toString(),
      creatorName: userMap.get(doc.createdByUserId.toString()) || undefined,
      title: doc.title || undefined,
      status: doc.status,
      itemCount: rawItems.length,
      totalQuantity,
      neededByDate: doc.neededByDate
        ? doc.neededByDate.toISOString()
        : undefined,
      submittedAt: doc.submittedAt ? doc.submittedAt.toISOString() : undefined,
      cancelledAt: doc.cancelledAt ? doc.cancelledAt.toISOString() : undefined,
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : "",
      updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : "",
    };
  });

  return { items, total };
}

// ---------------------------------------------------------------------------
// 7. Transition Purchase Request Status to "submitted"
// ---------------------------------------------------------------------------

export async function submitPurchaseRequestInRepo(
  cafeId: string,
  requestId: string,
): Promise<PurchaseRequestDetailDTO> {
  if (!Types.ObjectId.isValid(cafeId) || !Types.ObjectId.isValid(requestId)) {
    throw new Error("شناسه‌های ارسالی نامعتبر است");
  }

  await dbConnect();
  const now = new Date();

  const updatedDoc = (await PurchaseRequest.findOneAndUpdate(
    {
      _id: new Types.ObjectId(requestId),
      cafeId: new Types.ObjectId(cafeId),
      status: "draft",
    },
    {
      $set: {
        status: "submitted",
        submittedAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  ).lean()) as PurchaseRequestLean | null;

  if (updatedDoc) {
    const userMap = await batchLoadUserNames([
      updatedDoc.createdByUserId.toString(),
    ]);
    return mapDocToDetailDTO(updatedDoc, userMap);
  }

  // If not modified, check current state for idempotent behavior or invalid transition
  const current = (await PurchaseRequest.findOne({
    _id: new Types.ObjectId(requestId),
    cafeId: new Types.ObjectId(cafeId),
  }).lean()) as PurchaseRequestLean | null;

  if (!current) {
    throw new Error("استعلام قیمت مورد نظر یافت نشد");
  }

  if (current.status === "submitted") {
    // Idempotent success
    const userMap = await batchLoadUserNames([
      current.createdByUserId.toString(),
    ]);
    return mapDocToDetailDTO(current, userMap);
  }

  throw new Error(
    `امکان ارسال استعلام قیمت با وضعیت فعلی "${current.status}" وجود ندارد`,
  );
}

// ---------------------------------------------------------------------------
// 8. Transition Purchase Request Status to "cancelled" (Releases Allocations)
// ---------------------------------------------------------------------------

export async function cancelPurchaseRequestInRepo(params: {
  cafeId: string;
  requestId: string;
  cancelledByUserId: string;
  reason?: string;
}): Promise<PurchaseRequestDetailDTO> {
  if (
    !Types.ObjectId.isValid(params.cafeId) ||
    !Types.ObjectId.isValid(params.requestId) ||
    !Types.ObjectId.isValid(params.cancelledByUserId)
  ) {
    throw new Error("شناسه‌های ارسالی برای لغو نامعتبر است");
  }

  await dbConnect();
  const now = new Date();

  const updatedDoc = (await PurchaseRequest.findOneAndUpdate(
    {
      _id: new Types.ObjectId(params.requestId),
      cafeId: new Types.ObjectId(params.cafeId),
      status: { $in: ["draft", "submitted"] },
    },
    {
      $set: {
        status: "cancelled",
        cancelledAt: now,
        cancelledByUserId: new Types.ObjectId(params.cancelledByUserId),
        cancelReason: params.reason || null,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  ).lean()) as PurchaseRequestLean | null;

  if (updatedDoc) {
    const userIds = [
      updatedDoc.createdByUserId.toString(),
      params.cancelledByUserId,
    ];
    const userMap = await batchLoadUserNames(userIds);
    return mapDocToDetailDTO(updatedDoc, userMap);
  }

  // Check current document state
  const current = (await PurchaseRequest.findOne({
    _id: new Types.ObjectId(params.requestId),
    cafeId: new Types.ObjectId(params.cafeId),
  }).lean()) as PurchaseRequestLean | null;

  if (!current) {
    throw new Error("استعلام قیمت مورد نظر یافت نشد");
  }

  if (current.status === "cancelled") {
    // Idempotent success
    const userIds = [current.createdByUserId.toString()];
    if (current.cancelledByUserId) {
      userIds.push(current.cancelledByUserId.toString());
    }
    const userMap = await batchLoadUserNames(userIds);
    return mapDocToDetailDTO(current, userMap);
  }

  throw new Error("امکان لغو این استعلام قیمت وجود ندارد");
}
