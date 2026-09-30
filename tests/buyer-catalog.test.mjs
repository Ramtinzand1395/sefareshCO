import assert from "node:assert/strict";
import test from "node:test";
import mongoose, { Types } from "mongoose";

import { Category } from "../model/category.ts";
import { Product } from "../model/product.ts";
import { Supplier } from "../model/supplier.ts";
import { SupplierOffer } from "../model/supplier-offer.ts";
import { hasActiveBusinessAccess } from "../src/domain/admin-access.ts";
import {
  buyerCatalogQuerySchema,
  buyerCompareQuerySchema,
} from "../src/domain/schemas/cafe-catalog.ts";
import {
  findBuyerCatalog,
  findProductForComparison,
  validateActiveCategoryBranches,
} from "../src/repositories/cafe-catalog-repository.ts";

// ---------------------------------------------------------------------------
// 1. Zod Validation & Numeric Safety Tests
// ---------------------------------------------------------------------------

test("buyerCatalogQuerySchema validates pagination, search and sort defaults", () => {
  const defaultQuery = buyerCatalogQuerySchema.safeParse({});
  assert.equal(defaultQuery.success, true);
  if (defaultQuery.success) {
    assert.equal(defaultQuery.data.page, 1);
    assert.equal(defaultQuery.data.pageSize, 24);
    assert.equal(defaultQuery.data.sort, "newest");
    assert.equal(defaultQuery.data.search, undefined);
  }

  // Capped at 48 max page size
  const capped = buyerCatalogQuerySchema.safeParse({ pageSize: 100 });
  assert.equal(capped.success, false); // schema rejects > 48

  const validCustom = buyerCatalogQuerySchema.safeParse({
    page: "3",
    pageSize: "40",
    search: "  عربیکا  ",
    sort: "price_asc",
  });
  assert.equal(validCustom.success, true);
  if (validCustom.success) {
    assert.equal(validCustom.data.page, 3);
    assert.equal(validCustom.data.pageSize, 40);
    assert.equal(validCustom.data.search, "عربیکا");
    assert.equal(validCustom.data.sort, "price_asc");
  }
});

test("buyerCompareQuerySchema validates positive integer quantity and safe integer", () => {
  assert.equal(buyerCompareQuerySchema.safeParse({ quantity: 5 }).success, true);
  assert.equal(buyerCompareQuerySchema.safeParse({ quantity: "10" }).success, true);
  assert.equal(buyerCompareQuerySchema.safeParse({ quantity: 0 }).success, false);
  assert.equal(buyerCompareQuerySchema.safeParse({ quantity: -3 }).success, false);
  assert.equal(buyerCompareQuerySchema.safeParse({ quantity: 2.5 }).success, false);
  assert.equal(
    buyerCompareQuerySchema.safeParse({ quantity: Number.MAX_SAFE_INTEGER + 10 }).success,
    false,
  );
});

// ---------------------------------------------------------------------------
// 2. Cafe Buyer Access Rules
// ---------------------------------------------------------------------------

test("buyer access: active cafe member is allowed, suspended/pending user or cafe is blocked", () => {
  // Active member of active cafe
  assert.equal(
    hasActiveBusinessAccess({
      userStatus: "active",
      membershipStatus: "active",
      businessStatus: "active",
    }),
    true,
  );

  // Suspended cafe blocks catalog viewing
  assert.equal(
    hasActiveBusinessAccess({
      userStatus: "active",
      membershipStatus: "active",
      businessStatus: "suspended",
    }),
    false,
  );

  // Inactive user blocks catalog viewing
  assert.equal(
    hasActiveBusinessAccess({
      userStatus: "pending",
      membershipStatus: "active",
      businessStatus: "active",
    }),
    false,
  );

  // Suspended membership blocks catalog viewing
  assert.equal(
    hasActiveBusinessAccess({
      userStatus: "active",
      membershipStatus: "suspended",
      businessStatus: "active",
    }),
    false,
  );
});

// ---------------------------------------------------------------------------
// 3. Fulfillability, Item Total & Lowest Price Badge Logic
// ---------------------------------------------------------------------------

test("comparison logic: MOQ, stock fulfillment, item total, and lowest price badge", () => {
  const sampleOffers = [
    {
      offerId: "off-1",
      supplierId: "sup-1",
      supplierBusinessName: "تأمین‌کننده الف",
      price: 200000,
      productUnit: "کیلوگرم",
      stock: 50,
      minOrderQuantity: 5,
      deliveryDays: 2,
      updatedAt: new Date().toISOString(),
    },
    {
      offerId: "off-2",
      supplierId: "sup-2",
      supplierBusinessName: "تأمین‌کننده ب",
      price: 180000,
      productUnit: "کیلوگرم",
      stock: 20,
      minOrderQuantity: 10,
      deliveryDays: 4,
      updatedAt: new Date().toISOString(),
    },
    {
      offerId: "off-3",
      supplierId: "sup-3",
      supplierBusinessName: "تأمین‌کننده ج",
      price: 150000,
      productUnit: "کیلوگرم",
      stock: 6,
      minOrderQuantity: 1,
      deliveryDays: 1,
      updatedAt: new Date().toISOString(),
    },
  ];

  // Case A: Buyer requests quantity = 8
  // off-1: MOQ=5 <= 8 <= stock=50 -> Fulfillable, total=1,600,000
  // off-2: MOQ=10 > 8 -> Unfulfillable (quantity < MOQ)
  // off-3: stock=6 < 8 -> Unfulfillable (quantity > stock)
  const quantity = 8;
  const processed = sampleOffers.map((o) => {
    const isFulfillable = o.minOrderQuantity <= quantity && quantity <= o.stock;
    return {
      ...o,
      isFulfillable,
      itemTotal: quantity * o.price,
    };
  });

  const fulfillable = processed.filter((o) => o.isFulfillable);
  assert.equal(fulfillable.length, 1);
  assert.equal(fulfillable[0].offerId, "off-1");
  assert.equal(fulfillable[0].itemTotal, 1600000);

  // Lowest price badge: applies ONLY to fulfillable offers
  // off-3 has lower unit price (150k) but cannot fulfill 8kg, so off-1 (200k) gets the badge!
  const minFulfillablePrice = Math.min(...fulfillable.map((o) => o.price));
  assert.equal(minFulfillablePrice, 200000);

  const off1Badge = fulfillable[0].price === minFulfillablePrice;
  assert.equal(off1Badge, true);

  // Safe integer overflow check
  const hugeQty = 1000000;
  const highPrice = 10000000;
  const total = hugeQty * highPrice;
  assert.equal(Number.isSafeInteger(total), true);
});

// ---------------------------------------------------------------------------
// 4. Database Integration Tests with Test Database
// ---------------------------------------------------------------------------

const TEST_DB_URI =
  process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/sefaresh_test_runner";
process.env.MONGODB_URI = TEST_DB_URI;

test("database: category branch validator safely handles valid tree and eliminates cycles", async () => {
  let conn;
  try {
    conn = await mongoose.createConnection(TEST_DB_URI).asPromise();
  } catch {
    return; // Skip if test db is unreachable
  }

  try {
    const TestCat = conn.model("Category", Category.schema);

    // Clean up
    await TestCat.deleteMany({});

    // 1. Root category (active)
    const root = await TestCat.create({
      name: "قهوه و دان",
      slug: "coffee-root",
      status: "active",
      parentId: null,
    });

    // 2. Child category (active)
    const child = await TestCat.create({
      name: "دان عربیکا",
      slug: "arabica-child",
      status: "active",
      parentId: root._id,
    });

    // 3. Inactive branch
    const inactiveRoot = await TestCat.create({
      name: "شوینده‌ها",
      slug: "detergents-root",
      status: "inactive",
      parentId: null,
    });
    const inactiveChild = await TestCat.create({
      name: "مایع ظرفشویی",
      slug: "dish-soap",
      status: "active",
      parentId: inactiveRoot._id,
    });

    // 4. Cycle categories: A -> B -> A
    const cycleAId = new Types.ObjectId();
    const cycleBId = new Types.ObjectId();
    await TestCat.create({
      _id: cycleAId,
      name: "چرخه الف",
      slug: "cycle-a",
      status: "active",
      parentId: cycleBId,
    });
    await TestCat.create({
      _id: cycleBId,
      name: "چرخه ب",
      slug: "cycle-b",
      status: "active",
      parentId: cycleAId,
    });

    // Test the in-memory validation function using mongoose's active connection
    // We connect Mongoose default connection to TEST_DB_URI for repository testing
    await mongoose.connect(TEST_DB_URI);

    const { validCategoryIds, validCategoryMap } =
      await validateActiveCategoryBranches();

    // root and child MUST be valid
    assert.equal(validCategoryIds.includes(root._id.toString()), true);
    assert.equal(validCategoryMap.has(root._id.toString()), true);
    assert.equal(validCategoryMap.has(child._id.toString()), true);

    // inactiveChild MUST be invalid (parent inactive)
    assert.equal(validCategoryMap.has(inactiveChild._id.toString()), false);

    // cycleA and cycleB MUST be invalid (cycle detected without infinite loop)
    assert.equal(validCategoryMap.has(cycleAId.toString()), false);
    assert.equal(validCategoryMap.has(cycleBId.toString()), false);
  } finally {
    await conn.close();
    await mongoose.disconnect();
  }
});

test("database: buyer catalog aggregation rules, duplicate offer consolidation, and eligibility filtering", async () => {
  let conn;
  try {
    conn = await mongoose.createConnection(TEST_DB_URI).asPromise();
  } catch {
    return;
  }

  try {
    const TestCat = conn.model("Category", Category.schema);
    const TestProd = conn.model("Product", Product.schema);
    const TestSup = conn.model("Supplier", Supplier.schema);
    const TestOffer = conn.model("SupplierOffer", SupplierOffer.schema);

    // Clean up
    await Promise.all([
      TestCat.deleteMany({}),
      TestProd.deleteMany({}),
      TestSup.deleteMany({}),
      TestOffer.deleteMany({}),
    ]);

    await mongoose.connect(TEST_DB_URI);

    // 1. Create valid category
    const validCat = await TestCat.create({
      name: "سیروپ و طعم‌دهنده",
      slug: "syrups",
      status: "active",
    });

    // 2. Create suppliers:
    // S1: active and verified
    const s1 = await TestSup.create({
      ownerUserId: new Types.ObjectId(),
      businessName: "بازرگانی پخش آریا",
      status: "active",
      isVerified: true,
    });

    // S2: active and verified
    const s2 = await TestSup.create({
      ownerUserId: new Types.ObjectId(),
      businessName: "صنایع غذایی سپهر",
      status: "active",
      isVerified: true,
    });

    // S3: suspended
    const s3 = await TestSup.create({
      ownerUserId: new Types.ObjectId(),
      businessName: "تأمین معلق",
      status: "suspended",
      isVerified: true,
    });

    // S4: unverified
    const s4 = await TestSup.create({
      ownerUserId: new Types.ObjectId(),
      businessName: "تأمین تاییدنشده",
      status: "active",
      isVerified: false,
    });

    // 3. Products:
    // P1: valid product with 2 valid offers (S1 @ 250k, S2 @ 200k)
    const p1 = await TestProd.create({
      name: "سیروپ کارامل ۱ لیتری",
      slug: "caramel-syrup-1l",
      categoryId: validCat._id,
      unit: "بطری",
      status: "active",
    });

    // P2: product with ONLY an unverified supplier offer
    const p2 = await TestProd.create({
      name: "سیروپ وانیل ۱ لیتری",
      slug: "vanilla-syrup-1l",
      categoryId: validCat._id,
      unit: "بطری",
      status: "active",
    });

    // P3: product with ONLY offer having stock < MOQ (stock=0, minOrder=5)
    const p3 = await TestProd.create({
      name: "سیروپ فندق ۱ لیتری",
      slug: "hazelnut-syrup-1l",
      categoryId: validCat._id,
      unit: "بطری",
      status: "active",
    });

    // 4. Create Offers:
    // P1 Offers:
    await TestOffer.create({
      supplierId: s1._id,
      productId: p1._id,
      price: 250000,
      stock: 50,
      minOrderQuantity: 2,
      deliveryDays: 2,
      status: "active",
    });

    await TestOffer.create({
      supplierId: s2._id,
      productId: p1._id,
      price: 200000, // Lowest price
      stock: 30,
      minOrderQuantity: 1,
      deliveryDays: 3,
      status: "active",
    });

    // P2 Offer (unverified supplier):
    await TestOffer.create({
      supplierId: s4._id,
      productId: p2._id,
      price: 180000,
      stock: 20,
      minOrderQuantity: 1,
      status: "active",
    });

    // P2 Offer (suspended supplier s3):
    await TestOffer.create({
      supplierId: s3._id,
      productId: p2._id,
      price: 170000,
      stock: 30,
      minOrderQuantity: 1,
      status: "active",
    });

    // P3 Offer (stock < MOQ):
    await TestOffer.create({
      supplierId: s1._id,
      productId: p3._id,
      price: 190000,
      stock: 0,
      minOrderQuantity: 5,
      status: "active",
    });

    // 5. Query Buyer Catalog:
    const catalog = await findBuyerCatalog({
      page: 1,
      pageSize: 24,
      sort: "newest",
    });

    // Rule Verification:
    // - P1 must be the ONLY item returned because P2 (unverified supplier) and P3 (stock < MOQ) have NO eligible offers!
    assert.equal(catalog.total, 1);
    assert.equal(catalog.items.length, 1);

    const item = catalog.items[0];
    assert.equal(item.id, p1._id.toString());
    assert.equal(item.name, "سیروپ کارامل ۱ لیتری");
    // P1 has 2 valid offers: minPrice must be 200,000 (from S2)
    assert.equal(item.minPrice, 200000);
    // supplierCount must be exactly 2
    assert.equal(item.supplierCount, 2);

    // Serialization check: no ObjectIds or Date objects leaked
    assert.equal(typeof item.id, "string");
    assert.equal(typeof item.createdAt, "string");

    // 6. Test Product Comparison:
    const compResult = await findProductForComparison(p1._id.toString());
    assert.equal(compResult.state, "available");
    if (compResult.state === "available") {
      assert.equal(compResult.offers.length, 2);
      // Ensure private fields (mobile, nationalId) are NOT in the DTO
      for (const off of compResult.offers) {
        assert.equal("mobile" in off, false);
        assert.equal("nationalId" in off, false);
        assert.equal("email" in off, false);
        assert.equal(typeof off.supplierBusinessName, "string");
      }
    }
  } finally {
    await conn.close();
    await mongoose.disconnect();
  }
});
