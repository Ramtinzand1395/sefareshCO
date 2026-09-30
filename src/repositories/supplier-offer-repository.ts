import { Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { Category } from "@/model/category";
import { Product } from "@/model/product";
import { Supplier } from "@/model/supplier";
import { SupplierOffer } from "@/model/supplier-offer";
import type { OfferStatus } from "@/src/domain/schemas/supplier-offer";
import {
  escapeAdminSearch,
  normalizeAdminPagination,
} from "@/src/lib/admin-query";
import { matchedExistingDocument } from "@/src/repositories/update-result";

export const SUPPLIER_OFFER_MAX_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// DTOs – fully serializable, no ObjectId / Date / Mongoose Document
// ---------------------------------------------------------------------------

export type SupplierOfferListItemDTO = {
  id: string;
  supplierId: string;
  productId: string;
  productName: string;
  productUnit: string;
  categoryName?: string;
  price: number;
  stock: number;
  minOrderQuantity: number;
  deliveryDays: number;
  status: OfferStatus;
  isEligibleForPurchase: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SupplierOfferDetailDTO = SupplierOfferListItemDTO;

export type SupplierOfferListResult = {
  items: SupplierOfferListItemDTO[];
  total: number;
};

// Eligible for buyer view (RFQ / marketplace browsing in future phases)
export type EligibleOfferDTO = SupplierOfferListItemDTO & {
  supplierName: string;
};

// Internal lean doc shape
type OfferLeanDoc = {
  _id: { toString(): string };
  supplierId: { toString(): string };
  productId: { toString(): string };
  price: number;
  stock: number;
  minOrderQuantity: number;
  deliveryDays: number;
  status: OfferStatus;
  createdAt?: Date;
  updatedAt?: Date;
};

const notDeleted = { deletedAt: null };

// ---------------------------------------------------------------------------
// Category Tree Ancestors Helper
// Verifies that a category and all its ancestors are active and not deleted
// ---------------------------------------------------------------------------

export async function isCategoryBranchActive(
  categoryId: string | Types.ObjectId,
): Promise<boolean> {
  let currentId: Types.ObjectId | null =
    typeof categoryId === "string" ? new Types.ObjectId(categoryId) : categoryId;

  const visited = new Set<string>();

  while (currentId) {
    const idStr = currentId.toString();
    if (visited.has(idStr)) return false; // Cycle detected
    visited.add(idStr);

    const cat = (await Category.findOne({
      _id: currentId,
      ...notDeleted,
    })
      .select("status parentId")
      .lean()) as unknown as {
      status?: string;
      parentId?: Types.ObjectId | null;
    } | null;

    if (!cat || cat.status !== "active") {
      return false;
    }

    currentId = cat.parentId ? new Types.ObjectId(cat.parentId) : null;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Supplier-scoped list (paginated, stable sort, search on product name/sku)
// ---------------------------------------------------------------------------

export async function findSupplierOfferList(
  supplierId: string,
  query: {
    page: number;
    pageSize: number;
    search?: string;
    status?: OfferStatus;
  },
): Promise<SupplierOfferListResult> {
  if (!Types.ObjectId.isValid(supplierId)) return { items: [], total: 0 };
  await dbConnect();

  const { pageSize, skip } = normalizeAdminPagination(
    query.page,
    Math.min(query.pageSize, SUPPLIER_OFFER_MAX_PAGE_SIZE),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {
    supplierId: new Types.ObjectId(supplierId),
  };

  if (query.status) {
    filter.status = query.status;
  }

  const trimmedSearch = query.search?.trim();

  // If search is provided, search against Product first to support accurate pagination
  if (trimmedSearch) {
    const escaped = escapeAdminSearch(trimmedSearch);
    if (escaped) {
      const matchingProducts = (await Product.find({
        $or: [
          { name: { $regex: escaped, $options: "i" } },
          { sku: { $regex: escaped, $options: "i" } },
          { brand: { $regex: escaped, $options: "i" } },
        ],
        ...notDeleted,
      })
        .select("_id")
        .lean()) as unknown as Array<{ _id: Types.ObjectId }>;

      if (matchingProducts.length === 0) {
        return { items: [], total: 0 };
      }

      filter.productId = { $in: matchingProducts.map((p) => p._id) };
    }
  }

  const [offerDocs, total] = await Promise.all([
    SupplierOffer.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    SupplierOffer.countDocuments(filter),
  ]);

  const rawOffers = offerDocs as unknown as OfferLeanDoc[];
  if (rawOffers.length === 0) return { items: [], total };

  // Batch-fetch product details to avoid N+1 queries
  const productIds = Array.from(
    new Set(rawOffers.map((o) => o.productId.toString())),
  );

  const productDocs = (await Product.find({
    _id: { $in: productIds.map((id) => new Types.ObjectId(id)) },
    ...notDeleted,
  })
    .select("name unit categoryId")
    .lean()) as unknown as Array<{
    _id: { toString(): string };
    name: string;
    unit: string;
    categoryId: { toString(): string };
  }>;

  const productMap = new Map<
    string,
    { name: string; unit: string; categoryId: string }
  >();
  for (const p of productDocs) {
    productMap.set(p._id.toString(), {
      name: p.name,
      unit: p.unit,
      categoryId: p.categoryId.toString(),
    });
  }

  // Batch-fetch category names
  const categoryIds = Array.from(
    new Set([...productMap.values()].map((p) => p.categoryId)),
  );
  const categoryDocs = (await Category.find({
    _id: { $in: categoryIds.map((id) => new Types.ObjectId(id)) },
    ...notDeleted,
  })
    .select("name")
    .lean()) as unknown as Array<{
    _id: { toString(): string };
    name: string;
  }>;

  const categoryMap = new Map<string, string>();
  for (const c of categoryDocs) {
    categoryMap.set(c._id.toString(), c.name);
  }

  const items: SupplierOfferListItemDTO[] = rawOffers.map((offer) => {
    const prodInfo = productMap.get(offer.productId.toString());
    const isEligibleForPurchase =
      offer.status === "active" && offer.stock >= offer.minOrderQuantity;

    return {
      id: offer._id.toString(),
      supplierId: offer.supplierId.toString(),
      productId: offer.productId.toString(),
      productName: prodInfo?.name ?? "محصول نامشخص",
      productUnit: prodInfo?.unit ?? "",
      categoryName: prodInfo?.categoryId
        ? categoryMap.get(prodInfo.categoryId)
        : undefined,
      price: offer.price,
      stock: offer.stock,
      minOrderQuantity: offer.minOrderQuantity,
      deliveryDays: offer.deliveryDays,
      status: offer.status,
      isEligibleForPurchase,
      createdAt: (offer.createdAt ?? new Date()).toISOString(),
      updatedAt: (offer.updatedAt ?? new Date()).toISOString(),
    };
  });

  return { items, total };
}

// ---------------------------------------------------------------------------
// Single offer (strictly scoped to supplierId for tenant isolation)
// ---------------------------------------------------------------------------

export async function findSupplierOfferById(
  offerId: string,
  supplierId: string,
): Promise<SupplierOfferDetailDTO | null> {
  if (!Types.ObjectId.isValid(offerId) || !Types.ObjectId.isValid(supplierId))
    return null;
  await dbConnect();

  const doc = (await SupplierOffer.findOne({
    _id: new Types.ObjectId(offerId),
    supplierId: new Types.ObjectId(supplierId),
  }).lean()) as unknown as OfferLeanDoc | null;

  if (!doc) return null;

  const productId = doc.productId.toString();
  const productDoc = (await Product.findOne({
    _id: new Types.ObjectId(productId),
    ...notDeleted,
  })
    .select("name unit categoryId")
    .lean()) as unknown as {
    _id: { toString(): string };
    name: string;
    unit: string;
    categoryId: { toString(): string };
  } | null;

  let categoryName: string | undefined;
  if (productDoc?.categoryId) {
    const catDoc = (await Category.findOne({
      _id: productDoc.categoryId,
      ...notDeleted,
    })
      .select("name")
      .lean()) as unknown as { name: string } | null;
    categoryName = catDoc?.name;
  }

  const isEligibleForPurchase =
    doc.status === "active" && doc.stock >= doc.minOrderQuantity;

  return {
    id: doc._id.toString(),
    supplierId: doc.supplierId.toString(),
    productId,
    productName: productDoc?.name ?? "محصول نامشخص",
    productUnit: productDoc?.unit ?? "",
    categoryName,
    price: doc.price,
    stock: doc.stock,
    minOrderQuantity: doc.minOrderQuantity,
    deliveryDays: doc.deliveryDays,
    status: doc.status,
    isEligibleForPurchase,
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
    updatedAt: (doc.updatedAt ?? new Date()).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Find by supplierId + productId (uniqueness check before creation)
// ---------------------------------------------------------------------------

export async function findOfferBySupplierAndProduct(
  supplierId: string,
  productId: string,
): Promise<{ id: string } | null> {
  if (
    !Types.ObjectId.isValid(supplierId) ||
    !Types.ObjectId.isValid(productId)
  )
    return null;
  await dbConnect();

  const doc = (await SupplierOffer.findOne({
    supplierId: new Types.ObjectId(supplierId),
    productId: new Types.ObjectId(productId),
  })
    .select("_id")
    .lean()) as unknown as { _id: { toString(): string } } | null;

  return doc ? { id: doc._id.toString() } : null;
}

// ---------------------------------------------------------------------------
// Create SupplierOffer
// ---------------------------------------------------------------------------

export async function createSupplierOffer(data: {
  supplierId: string;
  productId: string;
  price: number;
  stock: number;
  minOrderQuantity: number;
  deliveryDays: number;
  status: OfferStatus;
}): Promise<string> {
  await dbConnect();

  const created = await SupplierOffer.create({
    supplierId: new Types.ObjectId(data.supplierId),
    productId: new Types.ObjectId(data.productId),
    price: data.price,
    stock: data.stock,
    minOrderQuantity: data.minOrderQuantity,
    deliveryDays: data.deliveryDays,
    status: data.status,
  });

  return created._id.toString();
}

// ---------------------------------------------------------------------------
// Update SupplierOffer (productId is strictly immutable)
// ---------------------------------------------------------------------------

export async function updateSupplierOffer(
  offerId: string,
  supplierId: string,
  data: {
    price: number;
    stock: number;
    minOrderQuantity: number;
    deliveryDays: number;
  },
): Promise<boolean> {
  if (!Types.ObjectId.isValid(offerId) || !Types.ObjectId.isValid(supplierId))
    return false;
  await dbConnect();

  const result = await SupplierOffer.updateOne(
    {
      _id: new Types.ObjectId(offerId),
      supplierId: new Types.ObjectId(supplierId), // ownership enforced
    },
    {
      $set: {
        price: data.price,
        stock: data.stock,
        minOrderQuantity: data.minOrderQuantity,
        deliveryDays: data.deliveryDays,
      },
    },
  );

  return matchedExistingDocument(result);
}

// ---------------------------------------------------------------------------
// Toggle SupplierOffer status
// ---------------------------------------------------------------------------

export async function updateSupplierOfferStatus(
  offerId: string,
  supplierId: string,
  status: OfferStatus,
): Promise<boolean> {
  if (!Types.ObjectId.isValid(offerId) || !Types.ObjectId.isValid(supplierId))
    return false;
  await dbConnect();

  const result = await SupplierOffer.updateOne(
    {
      _id: new Types.ObjectId(offerId),
      supplierId: new Types.ObjectId(supplierId), // ownership enforced
    },
    { $set: { status } },
  );

  return matchedExistingDocument(result);
}

// ---------------------------------------------------------------------------
// Active products lookup for supplier to add to their offers
// (Only active + not deleted product, whose category and ancestor branch are active)
// ---------------------------------------------------------------------------

export async function findActiveProductsForOffer(
  search: string,
  limit = 20,
): Promise<
  Array<{ id: string; name: string; unit: string; categoryName?: string }>
> {
  await dbConnect();

  const trimmed = search.trim();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {
    status: "active",
    ...notDeleted,
  };

  if (trimmed) {
    const escaped = escapeAdminSearch(trimmed);
    if (escaped) {
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { sku: { $regex: escaped, $options: "i" } },
        { brand: { $regex: escaped, $options: "i" } },
      ];
    }
  }

  const productDocs = (await Product.find(filter)
    .select("name unit categoryId")
    .limit(Math.min(limit, 20))
    .lean()) as unknown as Array<{
    _id: { toString(): string };
    name: string;
    unit: string;
    categoryId: { toString(): string };
  }>;

  if (productDocs.length === 0) return [];

  // Filter products by verifying active category branch
  const eligibleProducts: Array<{
    id: string;
    name: string;
    unit: string;
    categoryName?: string;
  }> = [];

  const categoryCache = new Map<string, { active: boolean; name?: string }>();

  for (const prod of productDocs) {
    const catId = prod.categoryId.toString();
    let catInfo = categoryCache.get(catId);

    if (!catInfo) {
      const activeBranch = await isCategoryBranchActive(catId);
      let catName: string | undefined;
      if (activeBranch) {
        const catDoc = (await Category.findOne({
          _id: new Types.ObjectId(catId),
          ...notDeleted,
        })
          .select("name")
          .lean()) as unknown as { name?: string } | null;
        catName = catDoc?.name;
      }
      catInfo = { active: activeBranch, name: catName };
      categoryCache.set(catId, catInfo);
    }

    if (catInfo.active) {
      eligibleProducts.push({
        id: prod._id.toString(),
        name: prod.name,
        unit: prod.unit,
        categoryName: catInfo.name,
      });
    }
  }

  return eligibleProducts;
}

// ---------------------------------------------------------------------------
// Common eligibility condition for future buyer / RFQ consumption:
// 1. Offer is active
// 2. Offer stock >= minOrderQuantity
// 3. Supplier is active, verified, not deleted
// 4. Product is active, not deleted
// 5. Category and all its ancestors are active and not deleted
// ---------------------------------------------------------------------------

export async function findEligibleOffersForProduct(
  productId: string,
): Promise<EligibleOfferDTO[]> {
  if (!Types.ObjectId.isValid(productId)) return [];
  await dbConnect();

  // 1. Product must be active and not deleted
  const productDoc = (await Product.findOne({
    _id: new Types.ObjectId(productId),
    status: "active",
    ...notDeleted,
  })
    .select("name unit categoryId")
    .lean()) as unknown as {
    name: string;
    unit: string;
    categoryId: Types.ObjectId;
  } | null;

  if (!productDoc) return [];

  // 2. Category branch must be active
  const isBranchActive = await isCategoryBranchActive(productDoc.categoryId);
  if (!isBranchActive) return [];

  const catDoc = (await Category.findOne({
    _id: productDoc.categoryId,
    ...notDeleted,
  })
    .select("name")
    .lean()) as unknown as { name: string } | null;

  // 3. Offers must be active with stock >= minOrderQuantity (no reservation in this phase)
  const offerDocs = (await SupplierOffer.find({
    productId: new Types.ObjectId(productId),
    status: "active",
    $expr: { $gte: ["$stock", "$minOrderQuantity"] },
  }).lean()) as unknown as OfferLeanDoc[];

  if (offerDocs.length === 0) return [];

  // 4. Supplier must be active, verified, not deleted
  const supplierIds = Array.from(
    new Set(offerDocs.map((o) => o.supplierId.toString())),
  );

  const supplierDocs = (await Supplier.find({
    _id: { $in: supplierIds.map((id) => new Types.ObjectId(id)) },
    status: "active",
    isVerified: true,
    ...notDeleted,
  })
    .select("businessName")
    .lean()) as unknown as Array<{
    _id: { toString(): string };
    businessName: string;
  }>;

  const supplierMap = new Map<string, string>();
  for (const s of supplierDocs) {
    supplierMap.set(s._id.toString(), s.businessName);
  }

  return offerDocs
    .filter((o) => supplierMap.has(o.supplierId.toString()))
    .map((o) => ({
      id: o._id.toString(),
      supplierId: o.supplierId.toString(),
      supplierName: supplierMap.get(o.supplierId.toString()) ?? "",
      productId,
      productName: productDoc.name,
      productUnit: productDoc.unit,
      categoryName: catDoc?.name,
      price: o.price,
      stock: o.stock,
      minOrderQuantity: o.minOrderQuantity,
      deliveryDays: o.deliveryDays,
      status: o.status,
      isEligibleForPurchase: true,
      createdAt: (o.createdAt ?? new Date()).toISOString(),
      updatedAt: (o.updatedAt ?? new Date()).toISOString(),
    }));
}
