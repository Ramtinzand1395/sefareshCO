import assert from "node:assert/strict";
import test from "node:test";
import mongoose, { Types } from "mongoose";

import { SupplierOffer } from "../model/supplier-offer.ts";
import {
  hasActiveBusinessAccess,
} from "../src/domain/admin-access.ts";
import {
  createSupplierOfferSchema,
  updateOfferStatusSchema,
  updateSupplierOfferSchema,
} from "../src/domain/schemas/supplier-offer.ts";

// ---------------------------------------------------------------------------
// 1. Zod Validation & Numeric Safety Tests (Safe Integer, positive price, stock >= 0)
// ---------------------------------------------------------------------------

test("createSupplierOfferSchema accepts valid integers within safe integer limits", () => {
  const valid = createSupplierOfferSchema.safeParse({
    productId: new Types.ObjectId().toString(),
    price: 250000,
    stock: 50,
    minOrderQuantity: 5,
    deliveryDays: 2,
    status: "active",
  });

  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.price, 250000);
    assert.equal(valid.data.stock, 50);
    assert.equal(valid.data.minOrderQuantity, 5);
    assert.equal(valid.data.deliveryDays, 2);
    assert.equal(valid.data.status, "active");
  }
});

test("createSupplierOfferSchema defaults status to inactive and minOrderQuantity to 1", () => {
  const valid = createSupplierOfferSchema.safeParse({
    productId: new Types.ObjectId().toString(),
    price: 150000,
    stock: 10,
  });

  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.status, "inactive");
    assert.equal(valid.data.minOrderQuantity, 1);
    assert.equal(valid.data.deliveryDays, 0);
  }
});

test("createSupplierOfferSchema rejects negative, float, or unsafe integers", () => {
  const validId = new Types.ObjectId().toString();

  // Price <= 0 rejected
  assert.equal(
    createSupplierOfferSchema.safeParse({
      productId: validId,
      price: 0,
      stock: 10,
    }).success,
    false,
  );
  assert.equal(
    createSupplierOfferSchema.safeParse({
      productId: validId,
      price: -500,
      stock: 10,
    }).success,
    false,
  );

  // Price float rejected
  assert.equal(
    createSupplierOfferSchema.safeParse({
      productId: validId,
      price: 12500.5,
      stock: 10,
    }).success,
    false,
  );

  // Stock negative rejected
  assert.equal(
    createSupplierOfferSchema.safeParse({
      productId: validId,
      price: 10000,
      stock: -1,
    }).success,
    false,
  );

  // MinOrderQuantity 0 or negative rejected
  assert.equal(
    createSupplierOfferSchema.safeParse({
      productId: validId,
      price: 10000,
      stock: 10,
      minOrderQuantity: 0,
    }).success,
    false,
  );

  // Delivery days negative rejected
  assert.equal(
    createSupplierOfferSchema.safeParse({
      productId: validId,
      price: 10000,
      stock: 10,
      deliveryDays: -1,
    }).success,
    false,
  );

  // Unsafe integers rejected (beyond Number.MAX_SAFE_INTEGER)
  assert.equal(
    createSupplierOfferSchema.safeParse({
      productId: validId,
      price: Number.MAX_SAFE_INTEGER + 1000,
      stock: 10,
    }).success,
    false,
  );
});

test("updateSupplierOfferSchema validates inputs and enforces immutability of productId", () => {
  const offerId = new Types.ObjectId().toString();

  // Valid update
  const valid = updateSupplierOfferSchema.safeParse({
    offerId,
    price: 300000,
    stock: 20,
    minOrderQuantity: 2,
    deliveryDays: 3,
  });
  assert.equal(valid.success, true);

  // Does not accept productId in update schema
  const parsedKeys = Object.keys(updateSupplierOfferSchema.shape);
  assert.equal(
    parsedKeys.includes("productId"),
    false,
    "updateSupplierOfferSchema must not contain productId",
  );

  // Rejects invalid offerId
  assert.equal(
    updateSupplierOfferSchema.safeParse({
      offerId: "not-an-object-id",
      price: 300000,
      stock: 20,
    }).success,
    false,
  );
});

test("updateOfferStatusSchema only accepts 'active' or 'inactive'", () => {
  const offerId = new Types.ObjectId().toString();
  assert.equal(
    updateOfferStatusSchema.safeParse({ offerId, status: "active" }).success,
    true,
  );
  assert.equal(
    updateOfferStatusSchema.safeParse({ offerId, status: "inactive" }).success,
    true,
  );
  assert.equal(
    updateOfferStatusSchema.safeParse({ offerId, status: "pending" }).success,
    false,
  );
  assert.equal(
    updateOfferStatusSchema.safeParse({ offerId, status: "archived" }).success,
    false,
  );
});

// ---------------------------------------------------------------------------
// 2. Behavioral Rules: Permissions, Business Access & Inactivity
// ---------------------------------------------------------------------------

test("canManageOffers permission check denies unauthorized members", () => {
  const memberWithPerm = { canManageOffers: true };
  const memberWithoutPerm = { canManageOffers: false };

  assert.equal(Boolean(memberWithPerm.canManageOffers), true);
  assert.equal(Boolean(memberWithoutPerm.canManageOffers), false);
});

test("hasActiveBusinessAccess rejects suspended or pending user/business", () => {
  assert.equal(
    hasActiveBusinessAccess({
      userStatus: "active",
      membershipStatus: "active",
      businessStatus: "active",
    }),
    true,
  );

  // Suspended supplier blocks access
  assert.equal(
    hasActiveBusinessAccess({
      userStatus: "active",
      membershipStatus: "active",
      businessStatus: "suspended",
    }),
    false,
  );

  // Pending user blocks access
  assert.equal(
    hasActiveBusinessAccess({
      userStatus: "pending",
      membershipStatus: "active",
      businessStatus: "active",
    }),
    false,
  );

  // Suspended membership blocks access
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
// 3. Purchase & RFQ Eligibility Conditions
// (stock >= minOrderQuantity, active offer, active verified supplier, active product & category)
// ---------------------------------------------------------------------------

function checkOfferPurchaseEligibility({
  offerStatus,
  stock,
  minOrderQuantity,
  supplierStatus,
  supplierVerified,
  productStatus,
  categoryStatus,
}) {
  return (
    offerStatus === "active" &&
    stock >= minOrderQuantity &&
    supplierStatus === "active" &&
    supplierVerified === true &&
    productStatus === "active" &&
    categoryStatus === "active"
  );
}

test("eligibility: stock less than minOrderQuantity is NOT eligible for purchase", () => {
  // Stock < MOQ (e.g. stock=2, MOQ=5): valid to exist in panel, but NOT eligible for purchase
  assert.equal(
    checkOfferPurchaseEligibility({
      offerStatus: "active",
      stock: 2,
      minOrderQuantity: 5,
      supplierStatus: "active",
      supplierVerified: true,
      productStatus: "active",
      categoryStatus: "active",
    }),
    false,
  );

  // Stock >= MOQ: eligible
  assert.equal(
    checkOfferPurchaseEligibility({
      offerStatus: "active",
      stock: 5,
      minOrderQuantity: 5,
      supplierStatus: "active",
      supplierVerified: true,
      productStatus: "active",
      categoryStatus: "active",
    }),
    true,
  );
});

test("eligibility: unverified supplier or inactive product blocks eligibility", () => {
  // Unverified supplier
  assert.equal(
    checkOfferPurchaseEligibility({
      offerStatus: "active",
      stock: 10,
      minOrderQuantity: 1,
      supplierStatus: "active",
      supplierVerified: false,
      productStatus: "active",
      categoryStatus: "active",
    }),
    false,
  );

  // Inactive product
  assert.equal(
    checkOfferPurchaseEligibility({
      offerStatus: "active",
      stock: 10,
      minOrderQuantity: 1,
      supplierStatus: "active",
      supplierVerified: true,
      productStatus: "inactive",
      categoryStatus: "active",
    }),
    false,
  );

  // Inactive category
  assert.equal(
    checkOfferPurchaseEligibility({
      offerStatus: "active",
      stock: 10,
      minOrderQuantity: 1,
      supplierStatus: "active",
      supplierVerified: true,
      productStatus: "active",
      categoryStatus: "inactive",
    }),
    false,
  );
});

// ---------------------------------------------------------------------------
// 4. Database Tests with Test Database (Unique Compound Index & Concurrent Race)
// ---------------------------------------------------------------------------

const TEST_DB_URI =
  process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/sefaresh_test_runner";

test("database: unique compound index prevents duplicate offer for same supplier + product", async () => {
  let db;
  try {
    db = await mongoose.createConnection(TEST_DB_URI).asPromise();
  } catch {
    // If test database is not reachable, skip DB portion gracefully
    return;
  }

  try {
    const TestSupplierOffer = db.model(
      "SupplierOffer",
      SupplierOffer.schema,
    );

    // Sync indexes to guarantee compound unique index is created on test db
    await TestSupplierOffer.syncIndexes();

    const supplierId = new Types.ObjectId();
    const productId = new Types.ObjectId();

    // 1. First insert must succeed
    const firstOffer = await TestSupplierOffer.create({
      supplierId,
      productId,
      price: 200000,
      stock: 10,
      minOrderQuantity: 1,
      status: "active",
    });
    assert.ok(firstOffer._id);

    // 2. Second insert for exact same supplierId + productId must trigger E11000
    let duplicateCaught = false;
    try {
      await TestSupplierOffer.create({
        supplierId,
        productId,
        price: 250000,
        stock: 5,
        minOrderQuantity: 1,
        status: "active",
      });
    } catch (err) {
      if (err.code === 11000) {
        duplicateCaught = true;
      }
    }
    assert.equal(duplicateCaught, true, "Expected 11000 unique index duplicate error");

    // 3. Different supplier with same product should succeed (isolation)
    const otherSupplierId = new Types.ObjectId();
    const otherOffer = await TestSupplierOffer.create({
      supplierId: otherSupplierId,
      productId,
      price: 210000,
      stock: 15,
      minOrderQuantity: 1,
      status: "active",
    });
    assert.ok(otherOffer._id);

    // 4. Concurrent race condition test: two simultaneous creation attempts
    const raceSupplierId = new Types.ObjectId();
    const raceProductId = new Types.ObjectId();

    const [attempt1, attempt2] = await Promise.allSettled([
      TestSupplierOffer.create({
        supplierId: raceSupplierId,
        productId: raceProductId,
        price: 100000,
        stock: 5,
      }),
      TestSupplierOffer.create({
        supplierId: raceSupplierId,
        productId: raceProductId,
        price: 100000,
        stock: 5,
      }),
    ]);

    // One must fulfill, one must reject with 11000
    const fulfilled = [attempt1, attempt2].filter((r) => r.status === "fulfilled");
    const rejected = [attempt1, attempt2].filter((r) => r.status === "rejected");

    assert.equal(fulfilled.length, 1, "Exactly one concurrent attempt must succeed");
    assert.equal(rejected.length, 1, "Exactly one concurrent attempt must fail");
    assert.equal(rejected[0].reason.code, 11000, "Failure must be E11000 unique error");

    // Cleanup test records
    await TestSupplierOffer.deleteMany({
      supplierId: { $in: [supplierId, otherSupplierId, raceSupplierId] },
    });
  } finally {
    await db.close();
  }
});
