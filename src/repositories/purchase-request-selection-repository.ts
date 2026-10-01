import { Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { PurchaseRequest } from "@/model/purchase-request";
import { PurchaseRequestSelection } from "@/model/purchase-request-selection";
import { Supplier } from "@/model/supplier";
import { SupplierRequest } from "@/model/supplier-request";
import { SupplierResponse } from "@/model/supplier-response";
import { User } from "@/model/user";
import type {
  CalculatedSelectionItem,
  CalculatedSelectionTotals,
  CalculatedSupplierGroup,
} from "@/src/domain/purchase-request-selection-totals";

export type SaveSelectionRepoInput = {
  purchaseRequestId: string;
  cafeId: string;
  selectedByUserId: string;
  expectedVersion?: number;
  items: CalculatedSelectionItem[];
  supplierGroups: CalculatedSupplierGroup[];
  totals: CalculatedSelectionTotals;
};

export type SaveSelectionRepoResult = {
  success: boolean;
  conflict?: boolean;
  currentVersion?: number;
  id?: string;
  version?: number;
};

/**
 * 1. Find Selection by RFQ ID and Cafe ID (tenant-scoped)
 */
export async function findSelectionByPurchaseRequestId(
  cafeId: string,
  purchaseRequestId: string,
) {
  if (
    !Types.ObjectId.isValid(cafeId) ||
    !Types.ObjectId.isValid(purchaseRequestId)
  ) {
    return null;
  }

  await dbConnect();

  return PurchaseRequestSelection.findOne({
    cafeId: new Types.ObjectId(cafeId),
    purchaseRequestId: new Types.ObjectId(purchaseRequestId),
  }).lean();
}

/**
 * 2. Batch load all comparison entities in minimal queries (No N+1)
 */
export async function findComparisonDataBatch(
  cafeId: string,
  purchaseRequestId: string,
) {
  if (
    !Types.ObjectId.isValid(cafeId) ||
    !Types.ObjectId.isValid(purchaseRequestId)
  ) {
    return null;
  }

  await dbConnect();

  const rfqObjId = new Types.ObjectId(purchaseRequestId);
  const cafeObjId = new Types.ObjectId(cafeId);

  // 1. Fetch PurchaseRequest strictly scoped to Cafe
  const rfqDoc = await PurchaseRequest.findOne({
    _id: rfqObjId,
    cafeId: cafeObjId,
  }).lean();

  if (!rfqDoc) {
    return null;
  }

  // 2. Concurrently fetch child SupplierRequests, SupplierResponses, and existing Selection
  const [supplierRequests, supplierResponses, existingSelection] =
    await Promise.all([
      SupplierRequest.find({
        purchaseRequestId: rfqObjId,
        cafeId: cafeObjId,
      }).lean(),
      SupplierResponse.find({
        purchaseRequestId: rfqObjId,
        cafeId: cafeObjId,
      }).lean(),
      PurchaseRequestSelection.findOne({
        purchaseRequestId: rfqObjId,
        cafeId: cafeObjId,
      }).lean(),
    ]);

  // 3. Batch fetch Supplier business names in 1 query
  const supplierIds = new Set<string>();
  for (const sr of supplierRequests) {
    supplierIds.add(sr.supplierId.toString());
  }
  for (const resp of supplierResponses) {
    supplierIds.add(resp.supplierId.toString());
  }

  const supplierNameMap = new Map<string, string>();
  if (supplierIds.size > 0) {
    const suppliers = await Supplier.find({
      _id: { $in: Array.from(supplierIds).map((id) => new Types.ObjectId(id)) },
    })
      .select("businessName")
      .lean();

    for (const s of suppliers) {
      supplierNameMap.set(s._id.toString(), s.businessName);
    }
  }

  // 4. If existing selection exists, fetch selectedBy user's display name
  let selectedByUserName: string | undefined;
  if (existingSelection?.selectedByUserId) {
    const userDoc = (await User.findById(existingSelection.selectedByUserId)
      .select("firstName lastName")
      .lean()) as { firstName?: string; lastName?: string } | null;
    if (userDoc) {
      selectedByUserName =
        [userDoc.firstName, userDoc.lastName].filter(Boolean).join(" ") ||
        undefined;
    }
  }

  return {
    rfqDoc,
    supplierRequests,
    supplierResponses,
    existingSelection,
    supplierNameMap,
    selectedByUserName,
  };
}

/**
 * 3. Save selection atomically with optimistic concurrency control and replace semantics.
 * If expectedVersion is supplied and does not match existing version, a conflict is returned.
 * Increments version on update, or creates with version = 1.
 */
export async function saveSelectionInRepo(
  input: SaveSelectionRepoInput,
): Promise<SaveSelectionRepoResult> {
  if (
    !Types.ObjectId.isValid(input.cafeId) ||
    !Types.ObjectId.isValid(input.purchaseRequestId) ||
    !Types.ObjectId.isValid(input.selectedByUserId)
  ) {
    return { success: false };
  }

  await dbConnect();

  const rfqObjId = new Types.ObjectId(input.purchaseRequestId);
  const cafeObjId = new Types.ObjectId(input.cafeId);
  const userObjId = new Types.ObjectId(input.selectedByUserId);
  const now = new Date();

  // Map calculated items to DB schema format
  const dbItems = input.items.map((i) => ({
    _id: new Types.ObjectId(),
    purchaseRequestItemId: new Types.ObjectId(i.purchaseRequestItemId),
    supplierRequestId: new Types.ObjectId(i.supplierRequestId),
    supplierResponseId: new Types.ObjectId(i.supplierResponseId),
    supplierId: new Types.ObjectId(i.supplierId),
    supplierName: i.supplierName,
    selectedQuantity: i.selectedQuantity,
    unitPrice: i.unitPrice,
    itemSubtotal: i.itemSubtotal,
    supplierResponseUpdatedAt: i.supplierResponseUpdatedAt,
  }));

  const dbSupplierGroups = input.supplierGroups.map((g) => ({
    supplierId: new Types.ObjectId(g.supplierId),
    supplierName: g.supplierName,
    supplierResponseId: new Types.ObjectId(g.supplierResponseId),
    deliveryDays: g.deliveryDays,
    shippingCost: g.shippingCost,
    itemsSubtotal: g.itemsSubtotal,
    supplierTotal: g.supplierTotal,
  }));

  // Fetch current existing selection for optimistic concurrency check
  const existing = await PurchaseRequestSelection.findOne({
    purchaseRequestId: rfqObjId,
    cafeId: cafeObjId,
  }).lean();

  if (existing) {
    // Concurrency check: if client provided expectedVersion, ensure it matches
    if (
      input.expectedVersion !== undefined &&
      existing.version !== input.expectedVersion
    ) {
      return {
        success: false,
        conflict: true,
        currentVersion: existing.version,
      };
    }

    // Atomic update with version increment and replace semantics
    const updateQuery: Record<string, unknown> = {
      _id: existing._id,
      version: existing.version, // atomic precondition
    };

    const updated = await PurchaseRequestSelection.findOneAndUpdate(
      updateQuery,
      {
        $inc: { version: 1 },
        $set: {
          selectedByUserId: userObjId,
          items: dbItems,
          supplierGroups: dbSupplierGroups,
          totals: input.totals,
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    ).lean();

    if (!updated) {
      // Version collision between find and update!
      const rechecked = await PurchaseRequestSelection.findById(existing._id)
        .select("version")
        .lean();
      return {
        success: false,
        conflict: true,
        currentVersion: rechecked?.version ?? existing.version,
      };
    }

    return {
      success: true,
      id: updated._id.toString(),
      version: updated.version,
    };
  } else {
    // No prior selection exists
    if (input.expectedVersion !== undefined && input.expectedVersion !== 1) {
      return {
        success: false,
        conflict: true,
        currentVersion: 0,
      };
    }

    try {
      const created = await PurchaseRequestSelection.create({
        purchaseRequestId: rfqObjId,
        cafeId: cafeObjId,
        selectedByUserId: userObjId,
        version: 1,
        items: dbItems,
        supplierGroups: dbSupplierGroups,
        totals: input.totals,
        createdAt: now,
        updatedAt: now,
      });

      return {
        success: true,
        id: created._id.toString(),
        version: created.version,
      };
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mongoError = err as any;
      if (mongoError?.code === 11000) {
        // Concurrent insert won the race; recheck current document
        const concurrentDoc = await PurchaseRequestSelection.findOne({
          purchaseRequestId: rfqObjId,
          cafeId: cafeObjId,
        })
          .select("version")
          .lean();

        return {
          success: false,
          conflict: true,
          currentVersion: concurrentDoc?.version,
        };
      }
      throw err;
    }
  }
}
