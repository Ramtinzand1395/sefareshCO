import { Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { Product } from "@/model/product";
import { PurchaseRequest } from "@/model/purchase-request";
import { Supplier } from "@/model/supplier";
import { SupplierOffer } from "@/model/supplier-offer";
import {
  SupplierRequest,
  type SupplierRequestStatus,
} from "@/model/supplier-request";
import type {
  SupplierRequestCafeViewDTO,
  SupplierRequestProductSnapshot,
  SupplierRequestSupplierViewDTO,
} from "@/src/domain/supplier-request";
import { normalizeAdminPagination } from "@/src/lib/admin-query";
import { isCategoryBranchActive } from "@/src/repositories/supplier-offer-repository";

const notDeleted = { deletedAt: null };

export type BatchCatalogProductInfo = {
  id: string;
  name: string;
  unit: string;
  brand?: string;
  categoryId?: string;
  isEligible: boolean;
};

export type BatchSupplierOfferInfo = {
  id: string;
  supplierId: string;
  productId: string;
  price: number;
  stock: number;
  minOrderQuantity: number;
  status: string;
};

export type BatchSupplierInfo = {
  id: string;
  businessName: string;
  status: string;
  isVerified: boolean;
  isEligible: boolean;
};

export type BatchMatchingLookupData = {
  productMap: Map<string, BatchCatalogProductInfo>;
  offers: BatchSupplierOfferInfo[];
  supplierMap: Map<string, BatchSupplierInfo>;
};

/**
 * 1. Batch lookup of products, offers, and suppliers for matching
 * Executed in 3 batch queries without per-item or per-supplier loops (No N+1)
 */
export async function findBatchMatchingDataForProductIds(
  productIds: string[],
): Promise<BatchMatchingLookupData> {
  if (productIds.length === 0) {
    return {
      productMap: new Map(),
      offers: [],
      supplierMap: new Map(),
    };
  }

  await dbConnect();

  const validObjIds = productIds
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  if (validObjIds.length === 0) {
    return {
      productMap: new Map(),
      offers: [],
      supplierMap: new Map(),
    };
  }

  // 1. Batch fetch active, non-deleted products
  const productDocs = (await Product.find({
    _id: { $in: validObjIds },
    status: "active",
    ...notDeleted,
  })
    .select("name unit brand categoryId")
    .lean()) as unknown as Array<{
    _id: Types.ObjectId;
    name: string;
    unit: string;
    brand?: string | null;
    categoryId?: Types.ObjectId | null;
  }>;

  const productMap = new Map<string, BatchCatalogProductInfo>();
  for (const p of productDocs) {
    const isBranchActive = p.categoryId
      ? await isCategoryBranchActive(p.categoryId)
      : true;

    productMap.set(p._id.toString(), {
      id: p._id.toString(),
      name: p.name,
      unit: p.unit,
      brand: p.brand || undefined,
      categoryId: p.categoryId ? p.categoryId.toString() : undefined,
      isEligible: isBranchActive,
    });
  }

  // 2. Batch fetch offers for these products (active offers with stock >= 0)
  const eligibleProductObjIds = Array.from(productMap.entries())
    .filter(([, info]) => info.isEligible)
    .map(([id]) => new Types.ObjectId(id));

  if (eligibleProductObjIds.length === 0) {
    return {
      productMap,
      offers: [],
      supplierMap: new Map(),
    };
  }

  const offerDocs = (await SupplierOffer.find({
    productId: { $in: eligibleProductObjIds },
  }).lean()) as unknown as Array<{
    _id: Types.ObjectId;
    supplierId: Types.ObjectId;
    productId: Types.ObjectId;
    price: number;
    stock: number;
    minOrderQuantity: number;
    status: string;
  }>;

  const offers: BatchSupplierOfferInfo[] = offerDocs.map((o) => ({
    id: o._id.toString(),
    supplierId: o.supplierId.toString(),
    productId: o.productId.toString(),
    price: o.price,
    stock: o.stock,
    minOrderQuantity: o.minOrderQuantity,
    status: o.status,
  }));

  // 3. Batch fetch suppliers for these offers
  const supplierIds = Array.from(new Set(offers.map((o) => o.supplierId)));
  const supplierObjIds = supplierIds
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  const supplierMap = new Map<string, BatchSupplierInfo>();
  if (supplierObjIds.length > 0) {
    const supplierDocs = (await Supplier.find({
      _id: { $in: supplierObjIds },
    })
      .select("businessName status isVerified deletedAt")
      .lean()) as unknown as Array<{
      _id: Types.ObjectId;
      businessName: string;
      status: string;
      isVerified: boolean;
      deletedAt?: Date | null;
    }>;

    for (const s of supplierDocs) {
      const isEligible =
        s.status === "active" &&
        s.isVerified === true &&
        (!s.deletedAt || s.deletedAt === null);

      supplierMap.set(s._id.toString(), {
        id: s._id.toString(),
        businessName: s.businessName,
        status: s.status,
        isVerified: s.isVerified,
        isEligible,
      });
    }
  }

  return { productMap, offers, supplierMap };
}

/**
 * 2. Find existing SupplierRequests for a given PurchaseRequest
 */
export async function findExistingSupplierRequestsByPurchaseRequest(
  purchaseRequestId: string,
): Promise<
  Array<{
    id: string;
    supplierId: string;
    status: SupplierRequestStatus;
  }>
> {
  if (!Types.ObjectId.isValid(purchaseRequestId)) return [];
  await dbConnect();

  const docs = (await SupplierRequest.find({
    purchaseRequestId: new Types.ObjectId(purchaseRequestId),
  })
    .select("_id supplierId status")
    .lean()) as unknown as Array<{
    _id: Types.ObjectId;
    supplierId: Types.ObjectId;
    status: SupplierRequestStatus;
  }>;

  return docs.map((d) => ({
    id: d._id.toString(),
    supplierId: d.supplierId.toString(),
    status: d.status,
  }));
}

export type CreateSupplierRequestRepoInput = {
  purchaseRequestId: string;
  supplierId: string;
  cafeId: string;
  items: Array<{
    purchaseRequestItemId: string;
    productId: string;
    matchedSupplierOfferId?: string | null;
    quantity: number;
    productSnapshot: SupplierRequestProductSnapshot;
    note?: string | null;
  }>;
};

/**
 * 3. Bulk create SupplierRequests idempotently.
 * Uses compound unique index { purchaseRequestId, supplierId } to prevent duplicate requests.
 * Safely ignores duplicate key errors (code 11000) for re-runs.
 */
export async function createSupplierRequestsIdempotently(
  requests: CreateSupplierRequestRepoInput[],
): Promise<{
  createdCount: number;
  skippedCount: number;
}> {
  if (requests.length === 0) {
    return { createdCount: 0, skippedCount: 0 };
  }

  await dbConnect();
  let createdCount = 0;
  let skippedCount = 0;
  const now = new Date();

  for (const req of requests) {
    try {
      await SupplierRequest.create({
        purchaseRequestId: new Types.ObjectId(req.purchaseRequestId),
        supplierId: new Types.ObjectId(req.supplierId),
        cafeId: new Types.ObjectId(req.cafeId),
        status: "pending",
        sentAt: now,
        items: req.items.map((item) => ({
          _id: new Types.ObjectId(),
          purchaseRequestItemId: new Types.ObjectId(item.purchaseRequestItemId),
          productId: new Types.ObjectId(item.productId),
          matchedSupplierOfferId: item.matchedSupplierOfferId
            ? new Types.ObjectId(item.matchedSupplierOfferId)
            : null,
          quantity: item.quantity,
          productSnapshot: {
            name: item.productSnapshot.name,
            unit: item.productSnapshot.unit,
            brand: item.productSnapshot.brand || null,
            categoryName: item.productSnapshot.categoryName || null,
          },
          note: item.note || null,
        })),
        createdAt: now,
        updatedAt: now,
      });
      createdCount++;
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mongoError = error as any;
      if (mongoError?.code === 11000) {
        // Unique index collision: SupplierRequest for this purchaseRequestId + supplierId already exists
        skippedCount++;
        continue;
      }
      throw error;
    }
  }

  return { createdCount, skippedCount };
}

/**
 * 4. List SupplierRequests for a specific RFQ from Cafe side
 */
export async function findSupplierRequestsForCafeRFQ(
  cafeId: string,
  purchaseRequestId: string,
): Promise<SupplierRequestCafeViewDTO[]> {
  if (
    !Types.ObjectId.isValid(cafeId) ||
    !Types.ObjectId.isValid(purchaseRequestId)
  ) {
    return [];
  }

  await dbConnect();

  type RawItem = {
    purchaseRequestItemId: Types.ObjectId;
    productId: Types.ObjectId;
    quantity: number;
    productSnapshot: {
      name: string;
      unit: string;
    };
  };

  type RawSupplierRequest = {
    _id: Types.ObjectId;
    supplierId: Types.ObjectId;
    status: SupplierRequestStatus;
    items: RawItem[];
    createdAt?: Date;
    sentAt?: Date;
    cancelledAt?: Date | null;
  };

  const docs = (await SupplierRequest.find({
    cafeId: new Types.ObjectId(cafeId),
    purchaseRequestId: new Types.ObjectId(purchaseRequestId),
  })
    .sort({ createdAt: -1 })
    .lean()) as unknown as RawSupplierRequest[];

  if (docs.length === 0) return [];

  const supplierIds = Array.from(
    new Set(docs.map((d) => d.supplierId.toString())),
  );
  const suppliers = (await Supplier.find({
    _id: { $in: supplierIds.map((id) => new Types.ObjectId(id)) },
  })
    .select("businessName")
    .lean()) as unknown as Array<{
    _id: Types.ObjectId;
    businessName: string;
  }>;

  const supplierNameMap = new Map<string, string>();
  for (const s of suppliers) {
    supplierNameMap.set(s._id.toString(), s.businessName);
  }

  return docs.map((doc) => ({
    id: doc._id.toString(),
    supplierId: doc.supplierId.toString(),
    supplierName:
      supplierNameMap.get(doc.supplierId.toString()) ?? "تأمین‌کننده ناشناس",
    status: doc.status,
    itemCount: doc.items.length,
    items: doc.items.map((item) => ({
      purchaseRequestItemId: item.purchaseRequestItemId.toString(),
      productId: item.productId.toString(),
      name: item.productSnapshot?.name ?? "کالای کاتالوگ",
      unit: item.productSnapshot?.unit ?? "",
      quantity: item.quantity,
    })),
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
    sentAt: doc.sentAt ? doc.sentAt.toISOString() : undefined,
    cancelledAt: doc.cancelledAt ? doc.cancelledAt.toISOString() : undefined,
  }));
}

/**
 * 5. List SupplierRequests strictly scoped to a Supplier (Supplier Inbox)
 */
export async function findSupplierRequestsForSupplierInbox(
  supplierId: string,
  options: {
    page: number;
    pageSize: number;
    status?: SupplierRequestStatus;
  },
): Promise<{
  items: SupplierRequestSupplierViewDTO[];
  total: number;
}> {
  if (!Types.ObjectId.isValid(supplierId)) {
    return { items: [], total: 0 };
  }

  await dbConnect();

  const { pageSize, skip } = normalizeAdminPagination(
    options.page,
    options.pageSize,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {
    supplierId: new Types.ObjectId(supplierId),
  };

  if (options.status) {
    filter.status = options.status;
  }

  type RawItem = {
    purchaseRequestItemId: Types.ObjectId;
    productId: Types.ObjectId;
    quantity: number;
    note?: string | null;
    productSnapshot: {
      name: string;
      unit: string;
      brand?: string | null;
      categoryName?: string | null;
    };
  };

  type RawDoc = {
    _id: Types.ObjectId;
    purchaseRequestId: Types.ObjectId;
    status: SupplierRequestStatus;
    items: RawItem[];
    createdAt?: Date;
    sentAt?: Date;
    cancelledAt?: Date | null;
  };

  const [total, docs] = await Promise.all([
    SupplierRequest.countDocuments(filter),
    SupplierRequest.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean() as unknown as Promise<RawDoc[]>,
  ]);

  if (docs.length === 0) {
    return { items: [], total };
  }

  // Hydrate parent RFQ referenceNumber and neededByDate without leaking cafe details
  const rfqIds = Array.from(
    new Set(docs.map((d) => d.purchaseRequestId.toString())),
  );
  const rfqDocs = (await PurchaseRequest.find({
    _id: { $in: rfqIds.map((id) => new Types.ObjectId(id)) },
  })
    .select("referenceNumber neededByDate")
    .lean()) as unknown as Array<{
    _id: Types.ObjectId;
    referenceNumber: string;
    neededByDate?: Date | null;
  }>;

  const rfqMap = new Map<
    string,
    { referenceNumber: string; neededByDate?: Date | null }
  >();
  for (const rfq of rfqDocs) {
    rfqMap.set(rfq._id.toString(), {
      referenceNumber: rfq.referenceNumber,
      neededByDate: rfq.neededByDate,
    });
  }

  const items: SupplierRequestSupplierViewDTO[] = docs.map((doc) => {
    const rfqInfo = rfqMap.get(doc.purchaseRequestId.toString());
    return {
      id: doc._id.toString(),
      referenceNumber: rfqInfo?.referenceNumber ?? "RFQ-نامشخص",
      status: doc.status,
      neededByDate: rfqInfo?.neededByDate
        ? rfqInfo.neededByDate.toISOString()
        : undefined,
      itemCount: doc.items.length,
      items: doc.items.map((item) => ({
        purchaseRequestItemId: item.purchaseRequestItemId.toString(),
        productId: item.productId.toString(),
        name: item.productSnapshot?.name ?? "کالای کاتالوگ",
        unit: item.productSnapshot?.unit ?? "",
        brand: item.productSnapshot?.brand || undefined,
        categoryName: item.productSnapshot?.categoryName || undefined,
        quantity: item.quantity,
        note: item.note || undefined,
      })),
      createdAt: (doc.createdAt ?? new Date()).toISOString(),
      sentAt: doc.sentAt ? doc.sentAt.toISOString() : undefined,
      cancelledAt: doc.cancelledAt ? doc.cancelledAt.toISOString() : undefined,
    };
  });

  return { items, total };
}

/**
 * 6. Get single SupplierRequest strictly scoped to a Supplier
 */
export async function findSupplierRequestByIdForSupplier(
  supplierId: string,
  requestId: string,
): Promise<SupplierRequestSupplierViewDTO | null> {
  if (
    !Types.ObjectId.isValid(supplierId) ||
    !Types.ObjectId.isValid(requestId)
  ) {
    return null;
  }

  await dbConnect();

  type RawItem = {
    purchaseRequestItemId: Types.ObjectId;
    productId: Types.ObjectId;
    quantity: number;
    note?: string | null;
    productSnapshot: {
      name: string;
      unit: string;
      brand?: string | null;
      categoryName?: string | null;
    };
  };

  type RawDoc = {
    _id: Types.ObjectId;
    purchaseRequestId: Types.ObjectId;
    status: SupplierRequestStatus;
    items: RawItem[];
    createdAt?: Date;
    sentAt?: Date;
    cancelledAt?: Date | null;
  };

  const doc = (await SupplierRequest.findOne({
    _id: new Types.ObjectId(requestId),
    supplierId: new Types.ObjectId(supplierId), // Supplier ownership strictly enforced
  }).lean()) as unknown as RawDoc | null;

  if (!doc) return null;

  const parentRfq = (await PurchaseRequest.findById(doc.purchaseRequestId)
    .select("referenceNumber neededByDate")
    .lean()) as unknown as {
    referenceNumber: string;
    neededByDate?: Date | null;
  } | null;

  return {
    id: doc._id.toString(),
    referenceNumber: parentRfq?.referenceNumber ?? "RFQ-نامشخص",
    status: doc.status,
    neededByDate: parentRfq?.neededByDate
      ? parentRfq.neededByDate.toISOString()
      : undefined,
    itemCount: doc.items.length,
    items: doc.items.map((item) => ({
      purchaseRequestItemId: item.purchaseRequestItemId.toString(),
      productId: item.productId.toString(),
      name: item.productSnapshot?.name ?? "کالای کاتالوگ",
      unit: item.productSnapshot?.unit ?? "",
      brand: item.productSnapshot?.brand || undefined,
      categoryName: item.productSnapshot?.categoryName || undefined,
      quantity: item.quantity,
      note: item.note || undefined,
    })),
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
    sentAt: doc.sentAt ? doc.sentAt.toISOString() : undefined,
    cancelledAt: doc.cancelledAt ? doc.cancelledAt.toISOString() : undefined,
  };
}

/**
 * 7. Cancel pending SupplierRequests when parent PurchaseRequest is cancelled
 */
export async function cancelSupplierRequestsByPurchaseRequest(
  purchaseRequestId: string,
  cancelledAt: Date = new Date(),
): Promise<number> {
  if (!Types.ObjectId.isValid(purchaseRequestId)) return 0;
  await dbConnect();

  const result = await SupplierRequest.updateMany(
    {
      purchaseRequestId: new Types.ObjectId(purchaseRequestId),
      status: "pending",
    },
    {
      $set: {
        status: "cancelled",
        cancelledAt,
        updatedAt: cancelledAt,
      },
    },
  );

  return result.modifiedCount || 0;
}
