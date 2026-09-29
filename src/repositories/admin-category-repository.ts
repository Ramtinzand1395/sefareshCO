import { Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { Category } from "@/model/category";
import { Product } from "@/model/product";
import type { CategoryStatus } from "@/src/domain/schemas/admin-catalog";
import {
  escapeAdminSearch,
  normalizeAdminPagination,
} from "@/src/lib/admin-query";
import { matchedExistingDocument } from "@/src/repositories/update-result";

// ---------------------------------------------------------------------------
// DTOs – fully serializable, no ObjectId / Mongoose Document
// ---------------------------------------------------------------------------

export type AdminCategoryListItemDTO = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId: string | null;
  parentName?: string;
  status: CategoryStatus;
  displayOrder: number;
  icon?: string;
  image?: string;
  productCount: number;
  childrenCount: number;
  createdAt: string;
};

export type AdminCategorySimpleDTO = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  status: CategoryStatus;
};

export type AdminCategoryDetailDTO = AdminCategoryListItemDTO & {
  updatedAt: string;
};

export type AdminCategoryListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: CategoryStatus;
  parentId?: string | null;
};

export type AdminCategoryListResult = {
  items: AdminCategoryListItemDTO[];
  total: number;
};

// ---------------------------------------------------------------------------
// Internal document shapes
// ---------------------------------------------------------------------------

type CategoryLeanDoc = {
  _id: { toString(): string };
  name: string;
  slug: string;
  description?: string;
  parentId?: { toString(): string } | null;
  status: CategoryStatus;
  displayOrder?: number;
  icon?: string;
  image?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

const notDeleted = { deletedAt: null };

// ---------------------------------------------------------------------------
// List with pagination / search / filters
// ---------------------------------------------------------------------------

export async function findAdminCategoryList(
  query: AdminCategoryListQuery,
): Promise<AdminCategoryListResult> {
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

  if (query.parentId !== undefined) {
    filter.parentId =
      query.parentId === null || query.parentId === ""
        ? null
        : new Types.ObjectId(query.parentId);
  }

  if (query.search) {
    const escaped = escapeAdminSearch(query.search);
    if (escaped) {
      const regex = { $regex: escaped, $options: "i" };
      filter.$or = [{ name: regex }, { slug: regex }, { description: regex }];
    }
  }

  const projection =
    "name slug description parentId status displayOrder icon image createdAt";

  const [docs, total] = await Promise.all([
    Category.find(filter)
      .select(projection)
      .sort({ displayOrder: 1, createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Category.countDocuments(filter),
  ]);

  const rawDocs = docs as unknown as CategoryLeanDoc[];

  if (rawDocs.length === 0) {
    return { items: [], total };
  }

  const categoryIds = rawDocs.map((d) => d._id.toString());
  const parentIds = Array.from(
    new Set(
      rawDocs
        .map((d) => d.parentId?.toString())
        .filter((id): id is string => Boolean(id)),
    ),
  );

  // Batch query parent names and product counts to prevent N+1 queries
  const [parentDocs, productCounts, childrenCounts] = await Promise.all([
    parentIds.length > 0
      ? Category.find({ _id: { $in: parentIds }, ...notDeleted })
          .select("name")
          .lean()
      : [],
    Product.aggregate([
      {
        $match: {
          categoryId: { $in: categoryIds.map((id) => new Types.ObjectId(id)) },
          ...notDeleted,
        },
      },
      {
        $group: {
          _id: "$categoryId",
          count: { $sum: 1 },
        },
      },
    ]),
    Category.aggregate([
      {
        $match: {
          parentId: { $in: categoryIds.map((id) => new Types.ObjectId(id)) },
          ...notDeleted,
        },
      },
      {
        $group: {
          _id: "$parentId",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const parentMap = new Map<string, string>();
  for (const p of parentDocs as unknown as Array<{
    _id: { toString(): string };
    name: string;
  }>) {
    parentMap.set(p._id.toString(), p.name);
  }

  const productCountMap = new Map<string, number>();
  for (const pc of productCounts as Array<{
    _id: { toString(): string };
    count: number;
  }>) {
    productCountMap.set(pc._id.toString(), pc.count);
  }

  const childrenCountMap = new Map<string, number>();
  for (const cc of childrenCounts as Array<{
    _id: { toString(): string };
    count: number;
  }>) {
    childrenCountMap.set(cc._id.toString(), cc.count);
  }

  const items: AdminCategoryListItemDTO[] = rawDocs.map((doc) => {
    const id = doc._id.toString();
    const parentIdStr = doc.parentId ? doc.parentId.toString() : null;

    return {
      id,
      name: doc.name,
      slug: doc.slug,
      description: doc.description,
      parentId: parentIdStr,
      parentName: parentIdStr ? parentMap.get(parentIdStr) : undefined,
      status: doc.status,
      displayOrder: doc.displayOrder ?? 0,
      icon: doc.icon,
      image: doc.image,
      productCount: productCountMap.get(id) ?? 0,
      childrenCount: childrenCountMap.get(id) ?? 0,
      createdAt: (doc.createdAt ?? new Date()).toISOString(),
    };
  });

  return { items, total };
}

// ---------------------------------------------------------------------------
// All active/available categories (simple list for select inputs)
// ---------------------------------------------------------------------------

export async function findAdminCategorySimpleList(): Promise<
  AdminCategorySimpleDTO[]
> {
  await dbConnect();

  const docs = (await Category.find({ ...notDeleted })
    .select("name slug parentId status")
    .sort({ displayOrder: 1, name: 1 })
    .lean()) as unknown as CategoryLeanDoc[];

  return docs.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    parentId: doc.parentId ? doc.parentId.toString() : null,
    status: doc.status,
  }));
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export async function findAdminCategoryDetail(
  categoryId: string,
): Promise<AdminCategoryDetailDTO | null> {
  if (!Types.ObjectId.isValid(categoryId)) return null;
  await dbConnect();

  const doc = (await Category.findOne({
    _id: categoryId,
    ...notDeleted,
  })
    .select(
      "name slug description parentId status displayOrder icon image createdAt updatedAt",
    )
    .lean()) as unknown as CategoryLeanDoc | null;

  if (!doc) return null;

  const parentIdStr = doc.parentId ? doc.parentId.toString() : null;

  const [parentDoc, productCount, childrenCount] = await Promise.all([
    parentIdStr
      ? Category.findOne({ _id: parentIdStr, ...notDeleted })
          .select("name")
          .lean()
      : null,
    Product.countDocuments({
      categoryId: new Types.ObjectId(categoryId),
      ...notDeleted,
    }),
    Category.countDocuments({
      parentId: new Types.ObjectId(categoryId),
      ...notDeleted,
    }),
  ]);

  const pDoc = parentDoc as unknown as { name?: string } | null;

  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    description: doc.description,
    parentId: parentIdStr,
    parentName: pDoc?.name,
    status: doc.status,
    displayOrder: doc.displayOrder ?? 0,
    icon: doc.icon,
    image: doc.image,
    productCount,
    childrenCount,
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
    updatedAt: (doc.updatedAt ?? new Date()).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Single raw lookup for business rules
// ---------------------------------------------------------------------------

export async function findCategoryById(
  categoryId: string,
): Promise<CategoryLeanDoc | null> {
  if (!Types.ObjectId.isValid(categoryId)) return null;
  await dbConnect();
  return (await Category.findOne({
    _id: categoryId,
    ...notDeleted,
  }).lean()) as unknown as CategoryLeanDoc | null;
}

export async function findCategoryBySlug(
  slug: string,
  excludeId?: string,
): Promise<{ id: string; name: string } | null> {
  await dbConnect();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = { slug: slug.toLowerCase(), ...notDeleted };
  if (excludeId && Types.ObjectId.isValid(excludeId)) {
    query._id = { $ne: new Types.ObjectId(excludeId) };
  }

  const doc = (await Category.findOne(query)
    .select("name")
    .lean()) as unknown as { _id: { toString(): string }; name: string } | null;

  return doc ? { id: doc._id.toString(), name: doc.name } : null;
}

export async function findCategoryByName(
  name: string,
  parentId?: string | null,
  excludeId?: string,
): Promise<{ id: string; name: string } | null> {
  await dbConnect();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {
    name: name.trim(),
    parentId: parentId ? new Types.ObjectId(parentId) : null,
    ...notDeleted,
  };
  if (excludeId && Types.ObjectId.isValid(excludeId)) {
    query._id = { $ne: new Types.ObjectId(excludeId) };
  }

  const doc = (await Category.findOne(query)
    .select("name")
    .lean()) as unknown as { _id: { toString(): string }; name: string } | null;

  return doc ? { id: doc._id.toString(), name: doc.name } : null;
}

// ---------------------------------------------------------------------------
// Tree Helpers – Cycle Detection
// ---------------------------------------------------------------------------

export async function findCategoryDescendantIds(
  categoryId: string,
): Promise<string[]> {
  if (!Types.ObjectId.isValid(categoryId)) return [];
  await dbConnect();

  const descendantIds: string[] = [];
  const queue: string[] = [categoryId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = (await Category.find({
      parentId: new Types.ObjectId(currentId),
      ...notDeleted,
    })
      .select("_id")
      .lean()) as unknown as Array<{ _id: { toString(): string } }>;

    for (const child of children) {
      const childId = child._id.toString();
      descendantIds.push(childId);
      queue.push(childId);
    }
  }

  return descendantIds;
}

export async function countCategoryActiveProducts(
  categoryId: string,
): Promise<number> {
  if (!Types.ObjectId.isValid(categoryId)) return 0;
  await dbConnect();

  return Product.countDocuments({
    categoryId: new Types.ObjectId(categoryId),
    status: "active",
    ...notDeleted,
  });
}

// ---------------------------------------------------------------------------
// Mutation Operations
// ---------------------------------------------------------------------------

export async function createCategory(data: {
  name: string;
  slug: string;
  description?: string;
  parentId?: string | null;
  displayOrder?: number;
  icon?: string;
  image?: string;
  status?: CategoryStatus;
}): Promise<string> {
  await dbConnect();

  const created = await Category.create({
    name: data.name.trim(),
    slug: data.slug.trim().toLowerCase(),
    description: data.description?.trim() || undefined,
    parentId: data.parentId ? new Types.ObjectId(data.parentId) : null,
    displayOrder: data.displayOrder ?? 0,
    icon: data.icon?.trim() || undefined,
    image: data.image?.trim() || undefined,
    status: data.status ?? "active",
  });

  return created._id.toString();
}

export async function updateCategory(
  categoryId: string,
  data: {
    name: string;
    slug: string;
    description?: string;
    parentId?: string | null;
    displayOrder?: number;
    icon?: string;
    image?: string;
    status: CategoryStatus;
  },
): Promise<boolean> {
  if (!Types.ObjectId.isValid(categoryId)) return false;
  await dbConnect();

  const result = await Category.updateOne(
    { _id: new Types.ObjectId(categoryId), ...notDeleted },
    {
      $set: {
        name: data.name.trim(),
        slug: data.slug.trim().toLowerCase(),
        description: data.description?.trim() || undefined,
        parentId: data.parentId ? new Types.ObjectId(data.parentId) : null,
        displayOrder: data.displayOrder ?? 0,
        icon: data.icon?.trim() || undefined,
        image: data.image?.trim() || undefined,
        status: data.status,
      },
    },
  );

  return matchedExistingDocument(result);
}

export async function updateCategoryStatus(
  categoryId: string,
  status: CategoryStatus,
): Promise<boolean> {
  if (!Types.ObjectId.isValid(categoryId)) return false;
  await dbConnect();

  const result = await Category.updateOne(
    { _id: new Types.ObjectId(categoryId), ...notDeleted },
    { $set: { status } },
  );

  return matchedExistingDocument(result);
}
