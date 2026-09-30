import { Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { Category } from "@/model/category";
import { Product } from "@/model/product";
import { Supplier } from "@/model/supplier";
import { SupplierOffer } from "@/model/supplier-offer";
import type { BuyerCatalogQueryInput } from "@/src/domain/schemas/cafe-catalog";
import { escapeAdminSearch } from "@/src/lib/admin-query";
import { isCategoryBranchActive } from "@/src/repositories/supplier-offer-repository";

// ---------------------------------------------------------------------------
// DTOs – 100% serializable (strings, numbers, booleans; no Date / ObjectId / Mongoose Doc)
// ---------------------------------------------------------------------------

export type BuyerCatalogItemDTO = {
  id: string;
  name: string;
  slug: string;
  brand?: string;
  unit: string;
  imageUrl?: string;
  categoryName?: string;
  minPrice: number;
  supplierCount: number;
  createdAt: string;
};

export type BuyerCatalogCategoryDTO = {
  id: string;
  name: string;
};

export type BuyerCatalogResult = {
  items: BuyerCatalogItemDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  availableCategories: BuyerCatalogCategoryDTO[];
};

export type BuyerOfferComparisonDTO = {
  offerId: string;
  supplierId: string;
  supplierBusinessName: string;
  price: number;
  productUnit: string;
  stock: number;
  minOrderQuantity: number;
  deliveryDays: number;
  updatedAt: string;
};

export type ProductComparisonProductDTO = {
  id: string;
  name: string;
  slug: string;
  brand?: string;
  unit: string;
  description?: string;
  images: string[];
  categoryName?: string;
};

export type ProductComparisonRepoResult =
  | { state: "not_found_or_inactive" }
  | {
      state: "available";
      product: ProductComparisonProductDTO;
      offers: BuyerOfferComparisonDTO[];
    };

const notDeleted = { deletedAt: null };

// ---------------------------------------------------------------------------
// 1. In-memory Active Category Branches and Cycles Validator
// Batch query to evaluate all active categories without N+1 queries
// ---------------------------------------------------------------------------

export async function validateActiveCategoryBranches(): Promise<{
  validCategoryIds: string[];
  validCategoryMap: Map<string, string>;
  validDescendantsMap: Map<string, string[]>;
}> {
  await dbConnect();

  const allActiveCategories = (await Category.find({
    status: "active",
    ...notDeleted,
  })
    .select("_id parentId name")
    .lean()) as unknown as Array<{
    _id: Types.ObjectId;
    parentId?: Types.ObjectId | null;
    name: string;
  }>;

  const catMap = new Map<
    string,
    { parentId: string | null; name: string }
  >();
  for (const c of allActiveCategories) {
    catMap.set(c._id.toString(), {
      parentId: c.parentId ? c.parentId.toString() : null,
      name: c.name,
    });
  }

  const validCategoryIds: string[] = [];
  const validCategoryMap = new Map<string, string>();
  const childrenMap = new Map<string, string[]>();

  // Determine validity of each category by climbing up its parent chain
  for (const [id, info] of catMap.entries()) {
    let currentId: string | null = id;
    const visited = new Set<string>();
    let isValid = true;

    while (currentId) {
      if (visited.has(currentId)) {
        // Cycle detected
        isValid = false;
        break;
      }
      visited.add(currentId);

      const parentInfo = catMap.get(currentId);
      if (!parentInfo) {
        // Parent is missing, inactive, or soft-deleted
        isValid = false;
        break;
      }

      currentId = parentInfo.parentId;
    }

    if (isValid) {
      validCategoryIds.push(id);
      validCategoryMap.set(id, info.name);

      if (info.parentId) {
        const existing = childrenMap.get(info.parentId) ?? [];
        existing.push(id);
        childrenMap.set(info.parentId, existing);
      }
    }
  }

  // Pre-calculate valid descendants for tree-based category filtering
  const validDescendantsMap = new Map<string, string[]>();
  for (const id of validCategoryIds) {
    const descendants: string[] = [];
    const queue = [...(childrenMap.get(id) ?? [])];
    const seen = new Set<string>();

    while (queue.length > 0) {
      const child = queue.shift()!;
      if (!seen.has(child) && validCategoryMap.has(child)) {
        seen.add(child);
        descendants.push(child);
        const furtherChildren = childrenMap.get(child) ?? [];
        queue.push(...furtherChildren);
      }
    }

    validDescendantsMap.set(id, descendants);
  }

  return { validCategoryIds, validCategoryMap, validDescendantsMap };
}

// ---------------------------------------------------------------------------
// 2. Active & Verified Suppliers Lookup
// ---------------------------------------------------------------------------

export async function getEligibleSupplierIds(): Promise<Types.ObjectId[]> {
  await dbConnect();
  const suppliers = (await Supplier.find({
    status: "active",
    isVerified: true,
    ...notDeleted,
  })
    .select("_id")
    .lean()) as unknown as Array<{ _id: Types.ObjectId }>;

  return suppliers.map((s) => s._id);
}

// ---------------------------------------------------------------------------
// 3. Buyer Catalog Query
// Shows each product only once, lowest eligible offer price, supplier count,
// filtering out products without eligible offers BEFORE pagination & count.
// ---------------------------------------------------------------------------

export async function findBuyerCatalog(
  query: BuyerCatalogQueryInput,
): Promise<BuyerCatalogResult> {
  await dbConnect();

  const { validCategoryIds, validCategoryMap, validDescendantsMap } =
    await validateActiveCategoryBranches();

  const availableCategories: BuyerCatalogCategoryDTO[] = validCategoryIds.map(
    (id) => ({
      id,
      name: validCategoryMap.get(id) ?? "",
    }),
  );

  const eligibleSupplierIds = await getEligibleSupplierIds();
  if (eligibleSupplierIds.length === 0 || validCategoryIds.length === 0) {
    return {
      items: [],
      total: 0,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: 0,
      availableCategories,
    };
  }

  // Determine category IDs to match
  let targetCategoryIds: string[] = validCategoryIds;
  if (query.categoryId) {
    if (!validCategoryMap.has(query.categoryId)) {
      // Selected category is invalid, deleted, or cycle-broken
      return {
        items: [],
        total: 0,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: 0,
        availableCategories,
      };
    }
    const descendants = validDescendantsMap.get(query.categoryId) ?? [];
    targetCategoryIds = [query.categoryId, ...descendants];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productMatch: Record<string, any> = {
    status: "active",
    ...notDeleted,
    categoryId: {
      $in: targetCategoryIds.map((id) => new Types.ObjectId(id)),
    },
  };

  const trimmedSearch = query.search?.trim();
  if (trimmedSearch) {
    const escaped = escapeAdminSearch(trimmedSearch);
    if (escaped) {
      productMatch.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { brand: { $regex: escaped, $options: "i" } },
      ];
    }
  }

  const pageSize = Math.min(Math.max(query.pageSize, 1), 48);
  const page = Math.max(query.page, 1);
  const skip = (page - 1) * pageSize;

  const sortStage: Record<string, 1 | -1> =
    query.sort === "price_asc"
      ? { minPrice: 1, createdAt: -1, _id: -1 }
      : query.sort === "price_desc"
        ? { minPrice: -1, createdAt: -1, _id: -1 }
        : { createdAt: -1, _id: -1 };

  type FacetResult = {
    total: Array<{ count: number }>;
    items: Array<{
      _id: Types.ObjectId;
      name: string;
      slug: string;
      brand?: string;
      unit: string;
      images?: string[];
      categoryId: Types.ObjectId;
      minPrice: number;
      supplierCount: number;
      createdAt?: Date;
    }>;
  };

  const [aggregationOutput] = (await Product.aggregate([
    { $match: productMatch },
    {
      $lookup: {
        from: "supplieroffers",
        let: { prodId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$productId", "$$prodId"] },
                  { $eq: ["$status", "active"] },
                  { $in: ["$supplierId", eligibleSupplierIds] },
                  { $gte: ["$stock", "$minOrderQuantity"] },
                ],
              },
            },
          },
          {
            $project: {
              price: 1,
              supplierId: 1,
            },
          },
        ],
        as: "eligibleOffers",
      },
    },
    // Strictly keep only products that have at least one eligible offer
    {
      $match: {
        "eligibleOffers.0": { $exists: true },
      },
    },
    {
      $addFields: {
        minPrice: { $min: "$eligibleOffers.price" },
        // Unique compound index { supplierId: 1, productId: 1 } guarantees 1 offer per supplier
        supplierCount: { $size: "$eligibleOffers" },
      },
    },
    {
      $facet: {
        total: [{ $count: "count" }],
        items: [
          { $sort: sortStage },
          { $skip: skip },
          { $limit: pageSize },
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              brand: 1,
              unit: 1,
              images: 1,
              categoryId: 1,
              minPrice: 1,
              supplierCount: 1,
              createdAt: 1,
            },
          },
        ],
      },
    },
  ])) as [FacetResult];

  const total = aggregationOutput?.total?.[0]?.count ?? 0;
  const rawItems = aggregationOutput?.items ?? [];
  const totalPages = Math.ceil(total / pageSize);

  const items: BuyerCatalogItemDTO[] = rawItems.map((item) => {
    const catIdStr = item.categoryId.toString();
    const firstImage =
      Array.isArray(item.images) && typeof item.images[0] === "string"
        ? item.images[0]
        : undefined;

    return {
      id: item._id.toString(),
      name: item.name,
      slug: item.slug,
      brand: item.brand || undefined,
      unit: item.unit,
      imageUrl: firstImage,
      categoryName: validCategoryMap.get(catIdStr),
      minPrice: item.minPrice,
      supplierCount: item.supplierCount,
      createdAt: (item.createdAt ?? new Date()).toISOString(),
    };
  });

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    availableCategories,
  };
}

// ---------------------------------------------------------------------------
// 4. Product Comparison Data Lookup
// Fetches product details and all its eligible commercial offers
// ---------------------------------------------------------------------------

export async function findProductForComparison(
  productId: string,
): Promise<ProductComparisonRepoResult> {
  if (!Types.ObjectId.isValid(productId)) {
    return { state: "not_found_or_inactive" };
  }
  await dbConnect();

  type ProductLean = {
    _id: Types.ObjectId;
    name: string;
    slug: string;
    brand?: string;
    unit: string;
    description?: string;
    images?: string[];
    categoryId: Types.ObjectId;
    status: string;
    deletedAt?: Date | null;
  };

  const productDoc = (await Product.findOne({
    _id: new Types.ObjectId(productId),
    status: "active",
    ...notDeleted,
  }).lean()) as unknown as ProductLean | null;

  if (!productDoc) {
    return { state: "not_found_or_inactive" };
  }

  // Verify category and its entire ancestor branch are active
  const isBranchActive = await isCategoryBranchActive(productDoc.categoryId);
  if (!isBranchActive) {
    return { state: "not_found_or_inactive" };
  }

  // Resolve category name
  const catDoc = (await Category.findOne({
    _id: productDoc.categoryId,
    ...notDeleted,
  })
    .select("name")
    .lean()) as unknown as { name?: string } | null;

  // Find active offers with stock >= minOrderQuantity
  type OfferLean = {
    _id: Types.ObjectId;
    supplierId: Types.ObjectId;
    price: number;
    stock: number;
    minOrderQuantity: number;
    deliveryDays: number;
    updatedAt?: Date;
  };

  const rawOffers = (await SupplierOffer.find({
    productId: new Types.ObjectId(productId),
    status: "active",
    $expr: { $gte: ["$stock", "$minOrderQuantity"] },
  }).lean()) as unknown as OfferLean[];

  const productDTO: ProductComparisonProductDTO = {
    id: productDoc._id.toString(),
    name: productDoc.name,
    slug: productDoc.slug,
    brand: productDoc.brand || undefined,
    unit: productDoc.unit,
    description: productDoc.description || undefined,
    images: Array.isArray(productDoc.images) ? productDoc.images : [],
    categoryName: catDoc?.name,
  };

  if (rawOffers.length === 0) {
    return {
      state: "available",
      product: productDTO,
      offers: [],
    };
  }

  // Batch-fetch active & verified suppliers (NO sensitive fields: mobile, nationalId, etc.)
  const supplierIds = Array.from(
    new Set(rawOffers.map((o) => o.supplierId.toString())),
  );

  const supplierDocs = (await Supplier.find({
    _id: { $in: supplierIds.map((id) => new Types.ObjectId(id)) },
    status: "active",
    isVerified: true,
    ...notDeleted,
  })
    .select("businessName")
    .lean()) as unknown as Array<{
    _id: Types.ObjectId;
    businessName: string;
  }>;

  const supplierMap = new Map<string, string>();
  for (const s of supplierDocs) {
    supplierMap.set(s._id.toString(), s.businessName);
  }

  const eligibleOffers: BuyerOfferComparisonDTO[] = rawOffers
    .filter((o) => supplierMap.has(o.supplierId.toString()))
    .map((o) => ({
      offerId: o._id.toString(),
      supplierId: o.supplierId.toString(),
      supplierBusinessName:
        supplierMap.get(o.supplierId.toString()) ?? "تأمین‌کننده ناشناس",
      price: o.price,
      productUnit: productDoc.unit,
      stock: o.stock,
      minOrderQuantity: o.minOrderQuantity,
      deliveryDays: o.deliveryDays,
      updatedAt: (o.updatedAt ?? new Date()).toISOString(),
    }));

  return {
    state: "available",
    product: productDTO,
    offers: eligibleOffers,
  };
}
