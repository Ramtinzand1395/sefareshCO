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
  createdAt: string;
  updatedAt: string;
};

export type SupplierOfferDetailDTO = SupplierOfferListItemDTO;

export type SupplierOfferListResult = {
  items: SupplierOfferListItemDTO[];
  total: number;
};

// eligible for buyer view: active offer, stock>0, active+verified supplier, active+not-deleted product+category
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

const notDeletedProduct = { deletedAt: null };

// ---------------------------------------------------------------------------
// Supplier-scoped list (paginated)
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

  // Batch-fetch product info (prevent N+1)
  const productIds = Array.from(
    new Set(rawOffers.map((o) => o.productId.toString())),
  );

  const search = query.search?.trim() ?? "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productFilter: Record<string, any> = {
    _id: { $in: productIds.map((id) => new Types.ObjectId(id)) },
    ...notDeletedProduct,
  };

  if (search) {
    const escaped = escapeAdminSearch(search);
    if (escaped) {
      productFilter.$or = [{ name: { $regex: escaped, $options: "i" } }];
    }
  }

  const productDocs = (await Product.find(productFilter)
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
    deletedAt: null,
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

  // Filter offers by matching products (for search)
  const matchingProductIds = new Set(productMap.keys());
  const filteredOffers = search
    ? rawOffers.filter((o) => matchingProductIds.has(o.productId.toString()))
    : rawOffers;

  const items: SupplierOfferListItemDTO[] = filteredOffers.map((offer) => {
    const prodInfo = productMap.get(offer.productId.toString());
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
      createdAt: (offer.createdAt ?? new Date()).toISOString(),
      updatedAt: (offer.updatedAt ?? new Date()).toISOString(),
    };
  });

  return { items, total };
}

// ---------------------------------------------------------------------------
// Single offer (scoped to supplierId for ownership)
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
    ...notDeletedProduct,
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
      deletedAt: null,
    })
      .select("name")
      .lean()) as unknown as { name: string } | null;
    categoryName = catDoc?.name;
  }

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
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
    updatedAt: (doc.updatedAt ?? new Date()).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Find by supplierId + productId (uniqueness check)
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
// Create
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
// Update (productId stays immutable)
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
// Toggle status
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
// Active product lookup for offer creation (only active + non-deleted + active category)
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
    ...notDeletedProduct,
  };

  if (trimmed) {
    const escaped = escapeAdminSearch(trimmed);
    if (escaped) {
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { sku: { $regex: escaped, $options: "i" } },
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

  // Only keep products with active non-deleted category
  const categoryIds = Array.from(
    new Set(productDocs.map((p) => p.categoryId.toString())),
  );

  const activeCategoryDocs = (await Category.find({
    _id: { $in: categoryIds.map((id) => new Types.ObjectId(id)) },
    status: "active",
    deletedAt: null,
  })
    .select("name")
    .lean()) as unknown as Array<{
    _id: { toString(): string };
    name: string;
  }>;

  const activeCategoryMap = new Map<string, string>();
  for (const c of activeCategoryDocs) {
    activeCategoryMap.set(c._id.toString(), c.name);
  }

  return productDocs
    .filter((p) => activeCategoryMap.has(p.categoryId.toString()))
    .map((p) => ({
      id: p._id.toString(),
      name: p.name,
      unit: p.unit,
      categoryName: activeCategoryMap.get(p.categoryId.toString()),
    }));
}

// ---------------------------------------------------------------------------
// Eligible offers query (for future buyer/RFQ view)
// Conditions: active offer, stock>0, active+verified supplier, active+not-deleted product+category
// ---------------------------------------------------------------------------

export async function findEligibleOffersForProduct(
  productId: string,
): Promise<EligibleOfferDTO[]> {
  if (!Types.ObjectId.isValid(productId)) return [];
  await dbConnect();

  // First verify product is active and not deleted
  const productDoc = (await Product.findOne({
    _id: new Types.ObjectId(productId),
    status: "active",
    ...notDeletedProduct,
  })
    .select("name unit categoryId")
    .lean()) as unknown as {
    name: string;
    unit: string;
    categoryId: { toString(): string };
  } | null;

  if (!productDoc) return [];

  // Verify category is active and not deleted
  const categoryDoc = (await Category.findOne({
    _id: productDoc.categoryId,
    status: "active",
    deletedAt: null,
  })
    .select("name")
    .lean()) as unknown as { name: string } | null;

  if (!categoryDoc) return [];

  // Get active offers with stock > 0
  const offerDocs = (await SupplierOffer.find({
    productId: new Types.ObjectId(productId),
    status: "active",
    stock: { $gt: 0 },
  }).lean()) as unknown as OfferLeanDoc[];

  if (offerDocs.length === 0) return [];

  // Batch-fetch supplier info (active + verified)
  const supplierIds = Array.from(
    new Set(offerDocs.map((o) => o.supplierId.toString())),
  );

  const supplierDocs = (await Supplier.find({
    _id: { $in: supplierIds.map((id) => new Types.ObjectId(id)) },
    status: "active",
    isVerified: true,
    deletedAt: null,
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
      categoryName: categoryDoc.name,
      price: o.price,
      stock: o.stock,
      minOrderQuantity: o.minOrderQuantity,
      deliveryDays: o.deliveryDays,
      status: o.status,
      createdAt: (o.createdAt ?? new Date()).toISOString(),
      updatedAt: (o.updatedAt ?? new Date()).toISOString(),
    }));
}
