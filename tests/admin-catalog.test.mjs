import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { Category } from "../model/category.ts";
import { Product } from "../model/product.ts";
import { isActiveAdmin } from "../src/domain/admin-access.ts";
import {
  categorySlugSchema,
  createCategorySchema,
  createProductSchema,
  productSlugSchema,
  updateCategorySchema,
  updateCategoryStatusSchema,
  updateProductSchema,
  updateProductStatusSchema,
} from "../src/domain/schemas/admin-catalog.ts";
import {
  escapeAdminSearch,
  normalizeAdminPagination,
} from "../src/lib/admin-query.ts";

// ---------------------------------------------------------------------------
// 1. Admin Authorization Checks
// ---------------------------------------------------------------------------

test("admin authorization: pending, disabled, or suspended admin is rejected", () => {
  assert.equal(isActiveAdmin({ isAdmin: true, status: "pending" }), false);
  assert.equal(isActiveAdmin({ isAdmin: true, status: "disabled" }), false);
  assert.equal(isActiveAdmin({ isAdmin: true, status: "suspended" }), false);
  assert.equal(isActiveAdmin({ isAdmin: false, status: "active" }), false);
  assert.equal(isActiveAdmin({ isAdmin: true, status: "active" }), true);
});

// ---------------------------------------------------------------------------
// 2. Slug and Zod Validation
// ---------------------------------------------------------------------------

test("slug validation rejects invalid formats and accepts valid kebab-case", () => {
  assert.equal(categorySlugSchema.safeParse("Valid-Slug-123").success, true);
  assert.equal(categorySlugSchema.safeParse("coffee-beans").success, true);
  assert.equal(categorySlugSchema.safeParse("coffee_beans").success, false);
  assert.equal(categorySlugSchema.safeParse("coffee beans").success, false);
  assert.equal(categorySlugSchema.safeParse("-invalid-").success, false);
  assert.equal(categorySlugSchema.safeParse("a").success, false); // min 2
  assert.equal(categorySlugSchema.safeParse("قهوه").success, false); // only english alphanumeric + dash

  assert.equal(productSlugSchema.safeParse("espresso-blend-250g").success, true);
  assert.equal(productSlugSchema.safeParse("invalid product slug").success, false);
});

test("createCategorySchema trims strings and validates parentId", () => {
  const valid = createCategorySchema.safeParse({
    name: "  دان قهوه  ",
    slug: "  coffee-beans  ",
    parentId: new Types.ObjectId().toString(),
    displayOrder: 1,
  });

  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.name, "دان قهوه");
    assert.equal(valid.data.slug, "coffee-beans");
    assert.equal(valid.data.status, "active");
  }

  // Invalid parentId format
  const invalidParent = createCategorySchema.safeParse({
    name: "سیروپ",
    slug: "syrup",
    parentId: "not-an-id",
  });
  assert.equal(invalidParent.success, false);
});

test("createProductSchema requires unit, categoryId and trims inputs", () => {
  const catId = new Types.ObjectId().toString();

  const valid = createProductSchema.safeParse({
    name: "  دان قهوه کلمبیا ۱ کیلوگرمی  ",
    slug: "coffee-colombia-1kg",
    categoryId: catId,
    unit: "  کیلوگرم  ",
    brand: "  بن‌مانو  ",
    sku: "  COF-001  ",
  });

  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.name, "دان قهوه کلمبیا ۱ کیلوگرمی");
    assert.equal(valid.data.unit, "کیلوگرم");
    assert.equal(valid.data.brand, "بن‌مانو");
    assert.equal(valid.data.sku, "COF-001");
    assert.equal(valid.data.status, "draft");
  }

  // Missing unit should fail
  const missingUnit = createProductSchema.safeParse({
    name: "دان قهوه کلمبیا",
    slug: "coffee-colombia",
    categoryId: catId,
  });
  assert.equal(missingUnit.success, false);
});

test("FormData null/empty fields are accepted for optional attributes in categories and products", () => {
  const catId = new Types.ObjectId().toString();

  // Category with nulls and empty strings as FormData provides
  const catResult = createCategorySchema.safeParse({
    name: "دان قهوه",
    slug: "coffee-beans",
    description: null,
    parentId: "",
    displayOrder: "0",
    icon: null,
    image: null,
    status: "active",
  });
  assert.equal(catResult.success, true);
  if (catResult.success) {
    assert.equal(catResult.data.parentId, null);
    assert.equal(catResult.data.description, undefined);
  }

  // Product with nulls and empty strings as FormData provides
  const prodResult = createProductSchema.safeParse({
    name: "قهوه اتیوپی",
    slug: "ethiopia-coffee",
    categoryId: catId,
    brand: null,
    unit: "کیلوگرم",
    description: null,
    barcode: "",
    sku: null,
    images: [],
    status: "draft",
    attributes: [],
  });
  assert.equal(prodResult.success, true);
  if (prodResult.success) {
    assert.equal(prodResult.data.brand, undefined);
    assert.equal(prodResult.data.barcode, undefined);
    assert.equal(prodResult.data.sku, undefined);
  }
});

test("status schemas reject unrecognized statuses", () => {
  const catId = new Types.ObjectId().toString();
  const prodId = new Types.ObjectId().toString();

  assert.equal(
    updateCategoryStatusSchema.safeParse({
      categoryId: catId,
      status: "active",
    }).success,
    true,
  );
  assert.equal(
    updateCategoryStatusSchema.safeParse({
      categoryId: catId,
      status: "deleted",
    }).success,
    false,
  );

  assert.equal(
    updateProductStatusSchema.safeParse({
      productId: prodId,
      status: "draft",
    }).success,
    true,
  );
  assert.equal(
    updateProductStatusSchema.safeParse({
      productId: prodId,
      status: "archived",
    }).success,
    false,
  );
});

// ---------------------------------------------------------------------------
// 3. Mongoose Schema Boundaries (Phase 1 Isolation)
// ---------------------------------------------------------------------------

test("Product model MUST NOT have price, stock, or supplier fields in Phase 1", () => {
  const productPaths = Object.keys(Product.schema.paths);

  assert.equal(
    productPaths.includes("price"),
    false,
    "Product schema must not include 'price'",
  );
  assert.equal(
    productPaths.includes("stock"),
    false,
    "Product schema must not include 'stock'",
  );
  assert.equal(
    productPaths.includes("inventory"),
    false,
    "Product schema must not include 'inventory'",
  );
  assert.equal(
    productPaths.includes("supplierId"),
    false,
    "Product schema must not include 'supplierId'",
  );
  assert.equal(
    productPaths.includes("supplierOffer"),
    false,
    "Product schema must not include 'supplierOffer'",
  );

  // But must include reference fields
  assert.equal(productPaths.includes("name"), true);
  assert.equal(productPaths.includes("slug"), true);
  assert.equal(productPaths.includes("categoryId"), true);
  assert.equal(productPaths.includes("unit"), true);
  assert.equal(productPaths.includes("status"), true);
});

test("Category model has proper parentId and status fields", () => {
  const parentPath = Category.schema.path("parentId");
  assert.equal(parentPath.instance, "ObjectId");
  assert.equal(parentPath.options.ref, "Category");

  const statusPath = Category.schema.path("status");
  assert.deepEqual(statusPath.options.enum, ["active", "inactive"]);
});

// ---------------------------------------------------------------------------
// 4. Query & Search Escaping
// ---------------------------------------------------------------------------

test("escapeAdminSearch properly escapes special regex characters", () => {
  assert.equal(escapeAdminSearch("coffee+milk"), "coffee\\+milk");
  assert.equal(escapeAdminSearch("test (100%)"), "test \\(100%\\)");
  assert.equal(escapeAdminSearch("  abc.def*  "), "abc\\.def\\*");
});

test("normalizeAdminPagination caps max page size and handles zero/negative", () => {
  const pag1 = normalizeAdminPagination(1, 20);
  assert.equal(pag1.page, 1);
  assert.equal(pag1.pageSize, 20);
  assert.equal(pag1.skip, 0);

  const pag2 = normalizeAdminPagination(0, 100);
  assert.equal(pag2.page, 1);
  assert.equal(pag2.pageSize, 50); // Capped at ADMIN_MAX_PAGE_SIZE = 50
  assert.equal(pag2.skip, 0);

  const pag3 = normalizeAdminPagination(3, 10);
  assert.equal(pag3.page, 3);
  assert.equal(pag3.pageSize, 10);
  assert.equal(pag3.skip, 20);
});

// ---------------------------------------------------------------------------
// 5. Update Schemas Validation
// ---------------------------------------------------------------------------

test("updateCategorySchema validates existing categoryId", () => {
  const valid = updateCategorySchema.safeParse({
    categoryId: new Types.ObjectId().toString(),
    name: "تجهیزات بار سرد",
    slug: "cold-bar",
    status: "active",
    displayOrder: 2,
  });
  assert.equal(valid.success, true);

  const invalid = updateCategorySchema.safeParse({
    categoryId: "bad-id",
    name: "تجهیزات بار سرد",
    slug: "cold-bar",
    status: "active",
  });
  assert.equal(invalid.success, false);
});

test("updateProductSchema validates existing productId and fields", () => {
  const valid = updateProductSchema.safeParse({
    productId: new Types.ObjectId().toString(),
    name: "شیر پرچرب ۱ لیتری",
    slug: "milk-whole-1l",
    categoryId: new Types.ObjectId().toString(),
    unit: "بطری",
    status: "active",
  });
  assert.equal(valid.success, true);

  const invalid = updateProductSchema.safeParse({
    productId: "not-an-id",
    name: "شیر پرچرب ۱ لیتری",
    slug: "milk-whole-1l",
    categoryId: new Types.ObjectId().toString(),
    unit: "بطری",
    status: "active",
  });
  assert.equal(invalid.success, false);
});
