import { Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { Category } from "@/model/category";
import { Product } from "@/model/product";
import type {
  ProductAttributeItem,
  ProductStatus,
} from "@/src/domain/schemas/admin-catalog";
import {
  escapeAdminSearch,
  normalizeAdminPagination,
} from "@/src/lib/admin-query";
import { matchedExistingDocument } from "@/src/repositories/update-result";

// ---------------------------------------------------------------------------
// DTOs – fully serializable, no ObjectId / Mongoose Document
// ---------------------------------------------------------------------------

export type AdminProductListItemDTO = {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  categoryName?: string;
  brand?: string;
  unit: string;
  barcode?: string;
  sku?: string;
  status: ProductStatus;
  images: string[];
  createdAt: string;
};

export type AdminProductDetailDTO = AdminProductListItemDTO & {
  description?: string;
  attributes: ProductAttributeItem[];
  updatedAt: string;
};

export type AdminProductListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: ProductStatus;
  categoryId?: string;
};

export type AdminProductListResult = {
  items: AdminProductListItemDTO[];
  total: number;
};

// ---------------------------------------------------------------------------
// Internal document shapes
// ---------------------------------------------------------------------------

type ProductLeanDoc = {
  _id: { toString(): string };
  name: string;
  slug: string;
  categoryId: { toString(): string };
  brand?: string;
  unit: string;
  description?: string;
  barcode?: string;
  sku?: string;
  status: ProductStatus;
  images?: string[];
  attributes?: Array<{ name: string; value: string }>;
  createdAt?: Date;
  updatedAt?: Date;
};

const notDeleted = { deletedAt: null };

// ---------------------------------------------------------------------------
// List with pagination / search / filters
// ---------------------------------------------------------------------------

export async function findAdminProductList(
  query: AdminProductListQuery,
): Promise<AdminProductListResult> {
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

  if (query.categoryId && Types.ObjectId.isValid(query.categoryId)) {
    filter.categoryId = new Types.ObjectId(query.categoryId);
  }

  if (query.search) {
    const escaped = escapeAdminSearch(query.search);
    if (escaped) {
      const regex = { $regex: escaped, $options: "i" };
      filter.$or = [
        { name: regex },
        { slug: regex },
        { brand: regex },
        { sku: regex },
        { barcode: regex },
      ];
    }
  }

  const projection =
    "name slug categoryId brand unit barcode sku status images createdAt";

  const [docs, total] = await Promise.all([
    Product.find(filter)
      .select(projection)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Product.countDocuments(filter),
  ]);

  const rawDocs = docs as unknown as ProductLeanDoc[];

  if (rawDocs.length === 0) {
    return { items: [], total };
  }

  // Resolve category names in one batch query to prevent N+1 queries
  const categoryIds = Array.from(
    new Set(rawDocs.map((d) => d.categoryId.toString())),
  );

  const categoryDocs = (await Category.find({
    _id: { $in: categoryIds.map((id) => new Types.ObjectId(id)) },
    ...notDeleted,
  })
    .select("name")
    .lean()) as unknown as Array<{ _id: { toString(): string }; name: string }>;

  const categoryMap = new Map<string, string>();
  for (const c of categoryDocs) {
    categoryMap.set(c._id.toString(), c.name);
  }

  const items: AdminProductListItemDTO[] = rawDocs.map((doc) => {
    const catIdStr = doc.categoryId.toString();
    return {
      id: doc._id.toString(),
      name: doc.name,
      slug: doc.slug,
      categoryId: catIdStr,
      categoryName: categoryMap.get(catIdStr),
      brand: doc.brand,
      unit: doc.unit,
      barcode: doc.barcode,
      sku: doc.sku,
      status: doc.status,
      images: Array.isArray(doc.images) ? doc.images : [],
      createdAt: (doc.createdAt ?? new Date()).toISOString(),
    };
  });

  return { items, total };
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export async function findAdminProductDetail(
  productId: string,
): Promise<AdminProductDetailDTO | null> {
  if (!Types.ObjectId.isValid(productId)) return null;
  await dbConnect();

  const doc = (await Product.findOne({
    _id: new Types.ObjectId(productId),
    ...notDeleted,
  })
    .select(
      "name slug categoryId brand unit description barcode sku status images attributes createdAt updatedAt",
    )
    .lean()) as unknown as ProductLeanDoc | null;

  if (!doc) return null;

  const catIdStr = doc.categoryId.toString();
  const catDoc = (await Category.findOne({
    _id: new Types.ObjectId(catIdStr),
    ...notDeleted,
  })
    .select("name")
    .lean()) as unknown as { name?: string } | null;

  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    categoryId: catIdStr,
    categoryName: catDoc?.name,
    brand: doc.brand,
    unit: doc.unit,
    description: doc.description,
    barcode: doc.barcode,
    sku: doc.sku,
    status: doc.status,
    images: Array.isArray(doc.images) ? doc.images : [],
    attributes: Array.isArray(doc.attributes)
      ? doc.attributes.map((a) => ({ name: a.name, value: a.value }))
      : [],
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
    updatedAt: (doc.updatedAt ?? new Date()).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Unique field lookups
// ---------------------------------------------------------------------------

export async function findProductBySlug(
  slug: string,
  excludeId?: string,
): Promise<{ id: string; name: string } | null> {
  await dbConnect();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = { slug: slug.toLowerCase(), ...notDeleted };
  if (excludeId && Types.ObjectId.isValid(excludeId)) {
    query._id = { $ne: new Types.ObjectId(excludeId) };
  }

  const doc = (await Product.findOne(query)
    .select("name")
    .lean()) as unknown as { _id: { toString(): string }; name: string } | null;

  return doc ? { id: doc._id.toString(), name: doc.name } : null;
}

export async function findProductBySku(
  sku: string,
  excludeId?: string,
): Promise<{ id: string; name: string } | null> {
  if (!sku.trim()) return null;
  await dbConnect();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = { sku: sku.trim(), ...notDeleted };
  if (excludeId && Types.ObjectId.isValid(excludeId)) {
    query._id = { $ne: new Types.ObjectId(excludeId) };
  }

  const doc = (await Product.findOne(query)
    .select("name")
    .lean()) as unknown as { _id: { toString(): string }; name: string } | null;

  return doc ? { id: doc._id.toString(), name: doc.name } : null;
}

export async function findProductByBarcode(
  barcode: string,
  excludeId?: string,
): Promise<{ id: string; name: string } | null> {
  if (!barcode.trim()) return null;
  await dbConnect();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = { barcode: barcode.trim(), ...notDeleted };
  if (excludeId && Types.ObjectId.isValid(excludeId)) {
    query._id = { $ne: new Types.ObjectId(excludeId) };
  }

  const doc = (await Product.findOne(query)
    .select("name")
    .lean()) as unknown as { _id: { toString(): string }; name: string } | null;

  return doc ? { id: doc._id.toString(), name: doc.name } : null;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createProduct(data: {
  name: string;
  slug: string;
  categoryId: string;
  brand?: string;
  unit: string;
  description?: string;
  barcode?: string;
  sku?: string;
  status?: ProductStatus;
  images?: string[];
  attributes?: ProductAttributeItem[];
}): Promise<string> {
  await dbConnect();

  const created = await Product.create({
    name: data.name.trim(),
    slug: data.slug.trim().toLowerCase(),
    categoryId: new Types.ObjectId(data.categoryId),
    brand: data.brand?.trim() || undefined,
    unit: data.unit.trim(),
    description: data.description?.trim() || undefined,
    barcode: data.barcode?.trim() || undefined,
    sku: data.sku?.trim() || undefined,
    status: data.status ?? "draft",
    images: data.images ?? [],
    attributes: data.attributes ?? [],
  });

  return created._id.toString();
}

export async function updateProduct(
  productId: string,
  data: {
    name: string;
    slug: string;
    categoryId: string;
    brand?: string;
    unit: string;
    description?: string;
    barcode?: string;
    sku?: string;
    status: ProductStatus;
    images?: string[];
    attributes?: ProductAttributeItem[];
  },
): Promise<boolean> {
  if (!Types.ObjectId.isValid(productId)) return false;
  await dbConnect();

  const result = await Product.updateOne(
    { _id: new Types.ObjectId(productId), ...notDeleted },
    {
      $set: {
        name: data.name.trim(),
        slug: data.slug.trim().toLowerCase(),
        categoryId: new Types.ObjectId(data.categoryId),
        brand: data.brand?.trim() || undefined,
        unit: data.unit.trim(),
        description: data.description?.trim() || undefined,
        barcode: data.barcode?.trim() || undefined,
        sku: data.sku?.trim() || undefined,
        status: data.status,
        images: data.images ?? [],
        attributes: data.attributes ?? [],
      },
    },
  );

  return matchedExistingDocument(result);
}

export async function updateProductStatus(
  productId: string,
  status: ProductStatus,
): Promise<boolean> {
  if (!Types.ObjectId.isValid(productId)) return false;
  await dbConnect();

  const result = await Product.updateOne(
    { _id: new Types.ObjectId(productId), ...notDeleted },
    { $set: { status } },
  );

  return matchedExistingDocument(result);
}
