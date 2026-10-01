import { Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { PurchaseRequest } from "@/model/purchase-request";
import { Supplier } from "@/model/supplier";
import { SupplierRequest } from "@/model/supplier-request";
import {
  SupplierResponse,
  type SupplierResponseItemStatus,
} from "@/model/supplier-response";
import type {
  SupplierResponseCafeViewDTO,
  SupplierResponseSupplierViewDTO,
} from "@/src/domain/supplier-response";

export type CreateSupplierResponseRepoInput = {
  supplierRequestId: string;
  purchaseRequestId: string;
  supplierId: string;
  cafeId: string;
  respondedByUserId: string;
  deliveryDays: number;
  shippingCost: number;
  itemSubtotal: number;
  estimatedTotal: number;
  items: Array<{
    purchaseRequestItemId: string;
    productId: string;
    status: SupplierResponseItemStatus;
    unitPrice?: number | null;
    confirmedQuantity?: number;
    itemSubtotal?: number;
    note?: string | null;
  }>;
  note?: string | null;
  respondedAt?: Date;
};

export type UpdateSupplierResponseRepoInput = {
  deliveryDays: number;
  shippingCost: number;
  itemSubtotal: number;
  estimatedTotal: number;
  items: Array<{
    purchaseRequestItemId: string;
    productId: string;
    status: SupplierResponseItemStatus;
    unitPrice?: number | null;
    confirmedQuantity?: number;
    itemSubtotal?: number;
    note?: string | null;
  }>;
  note?: string | null;
};

/**
 * 1. Create a SupplierResponse document and atomically update SupplierRequest status to responded.
 * Compound unique index on { supplierRequestId: 1 } prevents duplicates.
 * Returns null or throws duplicate error code 11000 for handling.
 */
export async function createSupplierResponse(
  input: CreateSupplierResponseRepoInput,
): Promise<{ id: string; isDuplicate?: boolean }> {
  await dbConnect();

  const now = input.respondedAt || new Date();

  try {
    const doc = await SupplierResponse.create({
      supplierRequestId: new Types.ObjectId(input.supplierRequestId),
      purchaseRequestId: new Types.ObjectId(input.purchaseRequestId),
      supplierId: new Types.ObjectId(input.supplierId),
      cafeId: new Types.ObjectId(input.cafeId),
      respondedByUserId: new Types.ObjectId(input.respondedByUserId),
      deliveryDays: input.deliveryDays,
      shippingCost: input.shippingCost,
      itemSubtotal: input.itemSubtotal,
      estimatedTotal: input.estimatedTotal,
      items: input.items.map((i) => ({
        _id: new Types.ObjectId(),
        purchaseRequestItemId: new Types.ObjectId(i.purchaseRequestItemId),
        productId: new Types.ObjectId(i.productId),
        status: i.status,
        unitPrice: i.status === "quoted" ? i.unitPrice : null,
        confirmedQuantity: i.status === "quoted" ? i.confirmedQuantity || 0 : 0,
        itemSubtotal: i.status === "quoted" ? i.itemSubtotal || 0 : 0,
        note: i.note || null,
      })),
      note: input.note || null,
      respondedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Mark parent SupplierRequest status to responded
    await SupplierRequest.updateOne(
      {
        _id: new Types.ObjectId(input.supplierRequestId),
        status: "pending",
      },
      {
        $set: {
          status: "responded",
          respondedAt: now,
          updatedAt: now,
        },
      },
    );

    return { id: doc._id.toString() };
  } catch (error: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mongoError = error as any;
    if (mongoError?.code === 11000) {
      // Duplicate response for supplierRequestId
      const existing = (await SupplierResponse.findOne({
        supplierRequestId: new Types.ObjectId(input.supplierRequestId),
      })
        .select("_id")
        .lean()) as { _id: Types.ObjectId } | null;

      return {
        id: existing ? existing._id.toString() : "",
        isDuplicate: true,
      };
    }
    throw error;
  }
}

/**
 * 2. Update an existing SupplierResponse document. Preserves original respondedAt.
 */
export async function updateSupplierResponse(
  supplierRequestId: string,
  supplierId: string,
  input: UpdateSupplierResponseRepoInput,
): Promise<{ success: boolean; id?: string }> {
  if (
    !Types.ObjectId.isValid(supplierRequestId) ||
    !Types.ObjectId.isValid(supplierId)
  ) {
    return { success: false };
  }

  await dbConnect();

  const now = new Date();
  const updatedDoc = (await SupplierResponse.findOneAndUpdate(
    {
      supplierRequestId: new Types.ObjectId(supplierRequestId),
      supplierId: new Types.ObjectId(supplierId),
    },
    {
      $set: {
        deliveryDays: input.deliveryDays,
        shippingCost: input.shippingCost,
        itemSubtotal: input.itemSubtotal,
        estimatedTotal: input.estimatedTotal,
        items: input.items.map((i) => ({
          _id: new Types.ObjectId(),
          purchaseRequestItemId: new Types.ObjectId(i.purchaseRequestItemId),
          productId: new Types.ObjectId(i.productId),
          status: i.status,
          unitPrice: i.status === "quoted" ? i.unitPrice : null,
          confirmedQuantity:
            i.status === "quoted" ? i.confirmedQuantity || 0 : 0,
          itemSubtotal: i.status === "quoted" ? i.itemSubtotal || 0 : 0,
          note: i.note || null,
        })),
        note: input.note || null,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  ).lean()) as { _id: Types.ObjectId } | null;

  if (!updatedDoc) {
    return { success: false };
  }

  // Touch SupplierRequest updatedAt
  await SupplierRequest.updateOne(
    { _id: new Types.ObjectId(supplierRequestId) },
    { $set: { updatedAt: now } },
  );

  return { success: true, id: updatedDoc._id.toString() };
}

/**
 * 3. Find raw SupplierResponse by supplierRequestId
 */
export async function findSupplierResponseBySupplierRequestId(
  supplierRequestId: string,
) {
  if (!Types.ObjectId.isValid(supplierRequestId)) return null;
  await dbConnect();

  return SupplierResponse.findOne({
    supplierRequestId: new Types.ObjectId(supplierRequestId),
  }).lean();
}

/**
 * 4. Find single SupplierResponse strictly scoped to a Supplier
 */
export async function findSupplierResponseForSupplier(
  supplierId: string,
  supplierRequestId: string,
): Promise<SupplierResponseSupplierViewDTO | null> {
  if (
    !Types.ObjectId.isValid(supplierId) ||
    !Types.ObjectId.isValid(supplierRequestId)
  ) {
    return null;
  }

  await dbConnect();

  type RawItem = {
    purchaseRequestItemId: Types.ObjectId;
    productId: Types.ObjectId;
    status: SupplierResponseItemStatus;
    unitPrice?: number | null;
    confirmedQuantity: number;
    itemSubtotal: number;
    note?: string | null;
  };

  type RawDoc = {
    _id: Types.ObjectId;
    supplierRequestId: Types.ObjectId;
    purchaseRequestId: Types.ObjectId;
    supplierId: Types.ObjectId;
    items: RawItem[];
    itemSubtotal: number;
    shippingCost: number;
    estimatedTotal: number;
    deliveryDays: number;
    note?: string | null;
    respondedAt: Date;
    updatedAt: Date;
  };

  const doc = (await SupplierResponse.findOne({
    supplierRequestId: new Types.ObjectId(supplierRequestId),
    supplierId: new Types.ObjectId(supplierId),
  }).lean()) as unknown as RawDoc | null;

  if (!doc) return null;

  // Hydrate RFQ referenceNumber and item snapshots from SupplierRequest in 1 query
  const [rfqDoc, reqDoc] = await Promise.all([
    PurchaseRequest.findById(doc.purchaseRequestId)
      .select("referenceNumber")
      .lean() as unknown as Promise<{ referenceNumber: string } | null>,
    SupplierRequest.findById(doc.supplierRequestId)
      .select("items")
      .lean() as unknown as Promise<{
      items: Array<{
        purchaseRequestItemId: Types.ObjectId;
        quantity: number;
        productSnapshot?: {
          name: string;
          unit: string;
          brand?: string | null;
          categoryName?: string | null;
        };
      }>;
    } | null>,
  ]);

  const reqItemMap = new Map<
    string,
    {
      requestedQuantity: number;
      name: string;
      unit: string;
      brand?: string;
      categoryName?: string;
    }
  >();

  if (reqDoc) {
    for (const it of reqDoc.items) {
      reqItemMap.set(it.purchaseRequestItemId.toString(), {
        requestedQuantity: it.quantity,
        name: it.productSnapshot?.name || "کالای کاتالوگ",
        unit: it.productSnapshot?.unit || "",
        brand: it.productSnapshot?.brand || undefined,
        categoryName: it.productSnapshot?.categoryName || undefined,
      });
    }
  }

  return {
    id: doc._id.toString(),
    supplierRequestId: doc.supplierRequestId.toString(),
    purchaseRequestId: doc.purchaseRequestId.toString(),
    referenceNumber: rfqDoc?.referenceNumber || "RFQ-نامشخص",
    supplierId: doc.supplierId.toString(),
    itemCount: doc.items.length,
    items: doc.items.map((item) => {
      const snap = reqItemMap.get(item.purchaseRequestItemId.toString());
      return {
        purchaseRequestItemId: item.purchaseRequestItemId.toString(),
        productId: item.productId.toString(),
        name: snap?.name || "کالای کاتالوگ",
        unit: snap?.unit || "",
        brand: snap?.brand,
        categoryName: snap?.categoryName,
        requestedQuantity: snap?.requestedQuantity || 0,
        status: item.status,
        unitPrice: item.unitPrice ?? undefined,
        confirmedQuantity: item.confirmedQuantity,
        itemSubtotal: item.itemSubtotal,
        note: item.note || undefined,
      };
    }),
    itemSubtotal: doc.itemSubtotal,
    shippingCost: doc.shippingCost,
    estimatedTotal: doc.estimatedTotal,
    deliveryDays: doc.deliveryDays,
    note: doc.note || undefined,
    respondedAt: (doc.respondedAt || new Date()).toISOString(),
    updatedAt: (doc.updatedAt || new Date()).toISOString(),
  };
}

/**
 * 5. Batch read all SupplierResponses for a Cafe RFQ (Cafe-scoped inspection & future comparison).
 * Executed in batch queries without per-response loops (No N+1).
 */
export async function findSupplierResponsesForCafeRFQ(
  cafeId: string,
  purchaseRequestId: string,
): Promise<SupplierResponseCafeViewDTO[]> {
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
    status: SupplierResponseItemStatus;
    unitPrice?: number | null;
    confirmedQuantity: number;
    itemSubtotal: number;
    note?: string | null;
  };

  type RawDoc = {
    _id: Types.ObjectId;
    supplierRequestId: Types.ObjectId;
    supplierId: Types.ObjectId;
    items: RawItem[];
    itemSubtotal: number;
    shippingCost: number;
    estimatedTotal: number;
    deliveryDays: number;
    respondedAt: Date;
    updatedAt: Date;
  };

  const docs = (await SupplierResponse.find({
    cafeId: new Types.ObjectId(cafeId),
    purchaseRequestId: new Types.ObjectId(purchaseRequestId),
  })
    .sort({ createdAt: -1 })
    .lean()) as unknown as RawDoc[];

  if (docs.length === 0) return [];

  // Batch fetch supplier business names in 1 query
  const supplierIds = Array.from(
    new Set(docs.map((d) => d.supplierId.toString())),
  );
  const supplierDocs = (await Supplier.find({
    _id: { $in: supplierIds.map((id) => new Types.ObjectId(id)) },
  })
    .select("businessName")
    .lean()) as unknown as Array<{
    _id: Types.ObjectId;
    businessName: string;
  }>;

  const supplierNameMap = new Map<string, string>();
  for (const s of supplierDocs) {
    supplierNameMap.set(s._id.toString(), s.businessName);
  }

  // Batch fetch SupplierRequests to hydrate item names/units from snapshots in 1 query
  const supplierRequestIds = docs.map((d) => d.supplierRequestId);
  const reqDocs = (await SupplierRequest.find({
    _id: { $in: supplierRequestIds },
  })
    .select("items")
    .lean()) as unknown as Array<{
    _id: Types.ObjectId;
    items: Array<{
      purchaseRequestItemId: Types.ObjectId;
      productSnapshot?: {
        name: string;
        unit: string;
      };
    }>;
  }>;

  const itemSnapshotMap = new Map<
    string,
    { name: string; unit: string }
  >();

  for (const r of reqDocs) {
    for (const it of r.items) {
      itemSnapshotMap.set(it.purchaseRequestItemId.toString(), {
        name: it.productSnapshot?.name || "کالای کاتالوگ",
        unit: it.productSnapshot?.unit || "",
      });
    }
  }

  return docs.map((doc) => ({
    id: doc._id.toString(),
    supplierRequestId: doc.supplierRequestId.toString(),
    supplierId: doc.supplierId.toString(),
    supplierName:
      supplierNameMap.get(doc.supplierId.toString()) ?? "تأمین‌کننده ناشناس",
    status: "responded",
    itemCount: doc.items.length,
    items: doc.items.map((item) => {
      const snap = itemSnapshotMap.get(item.purchaseRequestItemId.toString());
      return {
        purchaseRequestItemId: item.purchaseRequestItemId.toString(),
        productId: item.productId.toString(),
        name: snap?.name || "کالای کاتالوگ",
        unit: snap?.unit || "",
        status: item.status,
        unitPrice: item.unitPrice ?? undefined,
        confirmedQuantity: item.confirmedQuantity,
        itemSubtotal: item.itemSubtotal,
        note: item.note || undefined,
      };
    }),
    itemSubtotal: doc.itemSubtotal,
    shippingCost: doc.shippingCost,
    estimatedTotal: doc.estimatedTotal,
    deliveryDays: doc.deliveryDays,
    respondedAt: (doc.respondedAt || new Date()).toISOString(),
    updatedAt: (doc.updatedAt || new Date()).toISOString(),
  }));
}
