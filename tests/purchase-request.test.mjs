import assert from "node:assert/strict";
import test from "node:test";
import mongoose, { Types } from "mongoose";

import { Cafe } from "../model/cafe.ts";
import { Category } from "../model/category.ts";
import { Product } from "../model/product.ts";
import { PurchaseRequest } from "../model/purchase-request.ts";
import { ShoppingList } from "../model/shopping-list.ts";
import { User } from "../model/user.ts";
import {
  canCancelPurchaseRequest,
  canCreatePurchaseRequest,
  canViewPurchaseRequests,
} from "../src/domain/cafe-access.ts";
import {
  canTransitionPurchaseRequestStatus,
  generatePurchaseRequestReference,
} from "../src/domain/purchase-request.ts";
import {
  cancelPurchaseRequestSchema,
  createPurchaseRequestSchema,
  neededByDateSchema,
  purchaseRequestItemSelectionSchema,
  purchaseRequestQuerySchema,
  submitPurchaseRequestSchema,
} from "../src/domain/schemas/purchase-request.ts";
import {
  cancelPurchaseRequestInRepo,
  createPurchaseRequest as repoCreatePurchaseRequest,
  findPurchaseRequestById,
  findPurchaseRequestByIdempotencyKey,
  getShoppingListAllocations,
  listPurchaseRequestsByCafe,
  submitPurchaseRequestInRepo,
} from "../src/repositories/purchase-request-repository.ts";
import {
  addCatalogItemToActiveShoppingList,
  addCustomItemToActiveShoppingList,
  getOrCreateActiveShoppingList,
} from "../src/repositories/shopping-list-repository.ts";

// ---------------------------------------------------------------------------
// 1. Zod Schemas & Invariant Validations
// ---------------------------------------------------------------------------

test("purchaseRequestItemSelectionSchema: validates selection by shoppingListItemId or aggregateKey", () => {
  const validItemId = new Types.ObjectId().toString();

  // Valid selection by shoppingListItemId
  assert.equal(
    purchaseRequestItemSelectionSchema.safeParse({
      shoppingListItemId: validItemId,
      quantity: 5,
      note: "تحویل فوری",
    }).success,
    true,
  );

  // Valid selection by aggregateKey without explicit quantity (allocates full available)
  assert.equal(
    purchaseRequestItemSelectionSchema.safeParse({
      aggregateKey: "catalog:prod123",
    }).success,
    true,
  );

  // Rejects when neither shoppingListItemId nor aggregateKey is provided
  assert.equal(
    purchaseRequestItemSelectionSchema.safeParse({
      quantity: 5,
    }).success,
    false,
  );

  // Rejects zero quantity
  assert.equal(
    purchaseRequestItemSelectionSchema.safeParse({
      shoppingListItemId: validItemId,
      quantity: 0,
    }).success,
    false,
  );

  // Rejects negative quantity
  assert.equal(
    purchaseRequestItemSelectionSchema.safeParse({
      shoppingListItemId: validItemId,
      quantity: -2,
    }).success,
    false,
  );

  // Rejects decimal quantity
  assert.equal(
    purchaseRequestItemSelectionSchema.safeParse({
      shoppingListItemId: validItemId,
      quantity: 3.5,
    }).success,
    false,
  );

  // Rejects unsafe integer
  assert.equal(
    purchaseRequestItemSelectionSchema.safeParse({
      shoppingListItemId: validItemId,
      quantity: Number.MAX_SAFE_INTEGER + 100,
    }).success,
    false,
  );
});

test("neededByDateSchema: accepts future dates and rejects past dates or invalid formats", () => {
  // Future date (e.g., 10 days from now)
  const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(neededByDateSchema.safeParse(future).success, true);

  // Past date (e.g., 2 days ago)
  const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const pastResult = neededByDateSchema.safeParse(past);
  assert.equal(pastResult.success, false);

  // Invalid date format
  assert.equal(neededByDateSchema.safeParse("not-a-date").success, false);
});

test("createPurchaseRequestSchema: enforces non-empty items and field limits", () => {
  const validItemId = new Types.ObjectId().toString();

  // Valid create payload
  assert.equal(
    createPurchaseRequestSchema.safeParse({
      title: "استعلام خرید هفتگی قهوه",
      note: "ارسال فاکتور رسمی الزامی است",
      idempotencyKey: "op-token-12345",
      items: [
        {
          shoppingListItemId: validItemId,
          quantity: 10,
        },
      ],
    }).success,
    true,
  );

  // Rejects empty items array
  assert.equal(
    createPurchaseRequestSchema.safeParse({
      title: "استعلام بدون قلم",
      items: [],
    }).success,
    false,
  );

  // Rejects oversized title (> 150 chars)
  assert.equal(
    createPurchaseRequestSchema.safeParse({
      title: "a".repeat(151),
      items: [{ shoppingListItemId: validItemId, quantity: 1 }],
    }).success,
    false,
  );
});

test("submitPurchaseRequestSchema & cancelPurchaseRequestSchema: validate inputs", () => {
  const validId = new Types.ObjectId().toString();

  assert.equal(
    submitPurchaseRequestSchema.safeParse({ requestId: validId }).success,
    true,
  );
  assert.equal(
    submitPurchaseRequestSchema.safeParse({ requestId: "invalid-id" }).success,
    false,
  );

  assert.equal(
    cancelPurchaseRequestSchema.safeParse({
      requestId: validId,
      reason: "تغییر برنامه منوی کافه",
    }).success,
    true,
  );
  assert.equal(
    cancelPurchaseRequestSchema.safeParse({ requestId: "bad-id" }).success,
    false,
  );
});

test("purchaseRequestQuerySchema: validates pagination defaults and status filters", () => {
  const parsedDefault = purchaseRequestQuerySchema.safeParse({});
  assert.equal(parsedDefault.success, true);
  if (parsedDefault.success) {
    assert.equal(parsedDefault.data.page, 1);
    assert.equal(parsedDefault.data.pageSize, 20);
    assert.equal(parsedDefault.data.status, undefined);
  }

  const parsedWithStatus = purchaseRequestQuerySchema.safeParse({
    page: "2",
    pageSize: "50",
    status: "submitted",
  });
  assert.equal(parsedWithStatus.success, true);
  if (parsedWithStatus.success) {
    assert.equal(parsedWithStatus.data.page, 2);
    assert.equal(parsedWithStatus.data.pageSize, 50);
    assert.equal(parsedWithStatus.data.status, "submitted");
  }

  // Rejects invalid status
  assert.equal(
    purchaseRequestQuerySchema.safeParse({ status: "completed" }).success,
    false,
  );
});

// ---------------------------------------------------------------------------
// 2. Authorization & Permission Rules
// ---------------------------------------------------------------------------

test("canCreatePurchaseRequest: permits owner, manager, purchase_manager and explicit permission", () => {
  assert.equal(canCreatePurchaseRequest({ role: "owner" }), true);
  assert.equal(canCreatePurchaseRequest({ role: "manager" }), true);
  assert.equal(canCreatePurchaseRequest({ role: "purchase_manager" }), true);

  // Chef/employee denied by default
  assert.equal(canCreatePurchaseRequest({ role: "chef" }), false);
  assert.equal(canCreatePurchaseRequest({ role: "employee" }), false);
  assert.equal(canCreatePurchaseRequest({ role: "accountant" }), false);

  // Chef granted with explicit permission
  assert.equal(
    canCreatePurchaseRequest({
      role: "chef",
      permissions: { canCreatePurchaseRequest: true },
    }),
    true,
  );

  // Manager denied with explicit revocation
  assert.equal(
    canCreatePurchaseRequest({
      role: "manager",
      permissions: { canCreatePurchaseRequest: false },
    }),
    false,
  );
});

test("canViewPurchaseRequests: permits all active cafe roles", () => {
  const roles = [
    "owner",
    "manager",
    "purchase_manager",
    "chef",
    "accountant",
    "employee",
  ];
  for (const role of roles) {
    assert.equal(canViewPurchaseRequests({ role }), true);
  }
});

test("canCancelPurchaseRequest: permissions check for creator, manager, and cancelled status", () => {
  const creatorId = new Types.ObjectId().toString();
  const otherId = new Types.ObjectId().toString();

  // Already cancelled cannot be cancelled again
  assert.equal(
    canCancelPurchaseRequest(
      { userId: creatorId, role: "owner" },
      { createdByUserId: creatorId, status: "cancelled" },
    ),
    false,
  );

  // Owner can cancel draft or submitted
  assert.equal(
    canCancelPurchaseRequest(
      { userId: otherId, role: "owner" },
      { createdByUserId: creatorId, status: "draft" },
    ),
    true,
  );
  assert.equal(
    canCancelPurchaseRequest(
      { userId: otherId, role: "owner" },
      { createdByUserId: creatorId, status: "submitted" },
    ),
    true,
  );

  // Creator with employee role can cancel their own draft
  assert.equal(
    canCancelPurchaseRequest(
      { userId: creatorId, role: "employee" },
      { createdByUserId: creatorId, status: "draft" },
    ),
    true,
  );

  // Non-creator employee cannot cancel draft
  assert.equal(
    canCancelPurchaseRequest(
      { userId: otherId, role: "employee" },
      { createdByUserId: creatorId, status: "draft" },
    ),
    false,
  );

  // Non-creator manager can cancel draft and submitted
  assert.equal(
    canCancelPurchaseRequest(
      { userId: otherId, role: "manager" },
      { createdByUserId: creatorId, status: "submitted" },
    ),
    true,
  );
});

// ---------------------------------------------------------------------------
// 3. Workflow Status Transitions & Reference Generation
// ---------------------------------------------------------------------------

test("canTransitionPurchaseRequestStatus: enforces valid RFQ lifecycle transitions", () => {
  // Allowed
  assert.equal(canTransitionPurchaseRequestStatus("draft", "submitted"), true);
  assert.equal(canTransitionPurchaseRequestStatus("draft", "cancelled"), true);
  assert.equal(canTransitionPurchaseRequestStatus("submitted", "cancelled"), true);

  // Idempotent
  assert.equal(canTransitionPurchaseRequestStatus("draft", "draft"), true);
  assert.equal(canTransitionPurchaseRequestStatus("submitted", "submitted"), true);
  assert.equal(canTransitionPurchaseRequestStatus("cancelled", "cancelled"), true);

  // Forbidden
  assert.equal(canTransitionPurchaseRequestStatus("submitted", "draft"), false);
  assert.equal(canTransitionPurchaseRequestStatus("cancelled", "draft"), false);
  assert.equal(canTransitionPurchaseRequestStatus("cancelled", "submitted"), false);
});

test("generatePurchaseRequestReference: produces uppercase alphanumeric format with RFQ prefix", () => {
  const ref1 = generatePurchaseRequestReference();
  const ref2 = generatePurchaseRequestReference();

  assert.match(ref1, /^RFQ-\d{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/);
  assert.match(ref2, /^RFQ-\d{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/);
  assert.notEqual(ref1, ref2);
});

// ---------------------------------------------------------------------------
// 4. Database Integration Tests: Persistence, Allocation, Tenant Isolation,
//    Snapshots, Idempotency, and Cancellation Allocation Release
// ---------------------------------------------------------------------------

const TEST_DB_URI =
  process.env.TEST_MONGODB_URI ||
  "mongodb://127.0.0.1:27017/sefaresh_test_runner_purchase_request";
process.env.MONGODB_URI = TEST_DB_URI;

test("database: PurchaseRequest lifecycle, snapshots, allocations, idempotency, and tenant isolation", async () => {
  let conn;
  try {
    conn = await mongoose.createConnection(TEST_DB_URI).asPromise();
  } catch {
    return; // Skip if local test database is not reachable
  }

  try {
    const TestPurchaseRequest = conn.model(
      "PurchaseRequest",
      PurchaseRequest.schema,
    );
    const TestShoppingList = conn.model("ShoppingList", ShoppingList.schema);
    const TestProduct = conn.model("Product", Product.schema);
    const TestCategory = conn.model("Category", Category.schema);
    const TestUser = conn.model("User", User.schema);
    const TestCafe = conn.model("Cafe", Cafe.schema);

    // Clean up test collections
    await TestPurchaseRequest.deleteMany({});
    await TestPurchaseRequest.syncIndexes();
    await TestShoppingList.deleteMany({});
    await TestShoppingList.syncIndexes();
    await TestProduct.deleteMany({});
    await TestCategory.deleteMany({});
    await TestUser.deleteMany({});
    await TestCafe.deleteMany({});

    // 1. Seed user and cafe
    const creatorUser = await TestUser.create({
      firstName: "علی",
      lastName: "مدیر خرید",
      status: "active",
    });

    const cafeA = await TestCafe.create({
      name: "کافه اسپرسو ونک",
      slug: "espresso-vanak",
      status: "active",
      ownerUserId: creatorUser._id,
    });
    const cafeIdA = cafeA._id.toString();

    const cafeB = await TestCafe.create({
      name: "کافه گاندی",
      slug: "cafe-gandhi",
      status: "active",
      ownerUserId: creatorUser._id,
    });
    const cafeIdB = cafeB._id.toString();

    // 2. Seed catalog products
    const category = await TestCategory.create({
      name: "قهوه و دانه",
      slug: "coffee-beans",
      status: "active",
    });

    const productCoffee = await TestProduct.create({
      name: "دان قهوه ۱۰۰٪ عربیکا کلمبیا",
      slug: "coffee-arabica-colombia",
      categoryId: category._id,
      unit: "کیلوگرم",
      brand: "کلمبیا سلکت",
      status: "active",
    });

    const productMilk = await TestProduct.create({
      name: "شیر کامل تازه ۳ درصد",
      slug: "fresh-milk-3percent",
      categoryId: category._id,
      unit: "لیتر",
      brand: "میهن",
      status: "active",
    });

    // 3. Seed active shopping list with catalog & custom items for Cafe A
    await getOrCreateActiveShoppingList(cafeIdA);
    const itemMilk = await addCatalogItemToActiveShoppingList({
      cafeId: cafeIdA,
      productId: productMilk._id.toString(),
      quantity: 20, // 20 units available
      note: "شیر تازه هفتگی",
    });

    const itemCoffee = await addCatalogItemToActiveShoppingList({
      cafeId: cafeIdA,
      productId: productCoffee._id.toString(),
      quantity: 15, // 15 units available
      note: "دان قهوه بار",
    });

    const itemCustomCup = await addCustomItemToActiveShoppingList({
      cafeId: cafeIdA,
      customTitle: "لیوان شیشه‌ای لاته ۳۰۰ میلی",
      customUnit: "عدد",
      quantity: 50, // 50 units available
    });

    // -----------------------------------------------------------------------
    // Test A: Create Valid PurchaseRequest (Subset Selection + Snapshots)
    // -----------------------------------------------------------------------
    const rfq1 = await repoCreatePurchaseRequest({
      cafeId: cafeIdA,
      createdByUserId: creatorUser._id.toString(),
      title: "استعلام اول: شیر و لیوان لاته",
      note: "لطفاً قیمت و تاریخ انقضا ارسال شود",
      status: "draft",
      idempotencyKey: "test-idem-key-1",
      items: [
        {
          itemType: "catalog",
          productId: productMilk._id.toString(),
          productSnapshot: {
            name: productMilk.name,
            unit: productMilk.unit,
            brand: productMilk.brand,
            categoryName: category.name,
          },
          quantity: 12, // Take 12 out of 20
          note: "تحویل سه‌شنبه",
          allocations: [
            {
              shoppingListItemId: itemMilk.id,
              quantity: 12,
            },
          ],
        },
        {
          itemType: "custom",
          customTitle: itemCustomCup.customTitle,
          customUnit: itemCustomCup.customUnit,
          quantity: 25, // Take 25 out of 50
          allocations: [
            {
              shoppingListItemId: itemCustomCup.id,
              quantity: 25,
            },
          ],
        },
      ],
    });

    assert.ok(rfq1.id);
    assert.equal(rfq1.cafeId, cafeIdA);
    assert.equal(rfq1.status, "draft");
    assert.equal(rfq1.itemCount, 2);
    assert.equal(rfq1.totalQuantity, 37); // 12 + 25
    assert.match(rfq1.referenceNumber, /^RFQ-/);

    // Verify catalog snapshot
    const rfqMilkItem = rfq1.items.find((i) => i.itemType === "catalog");
    assert.ok(rfqMilkItem);
    assert.equal(rfqMilkItem.productId, productMilk._id.toString());
    assert.equal(rfqMilkItem.productSnapshot?.name, "شیر کامل تازه ۳ درصد");
    assert.equal(rfqMilkItem.productSnapshot?.unit, "لیتر");
    assert.equal(rfqMilkItem.productSnapshot?.brand, "میهن");
    assert.equal(rfqMilkItem.allocations.length, 1);
    assert.equal(rfqMilkItem.allocations[0].shoppingListItemId, itemMilk.id);
    assert.equal(rfqMilkItem.allocations[0].quantity, 12);

    // Verify custom item snapshot
    const rfqCustomItem = rfq1.items.find((i) => i.itemType === "custom");
    assert.ok(rfqCustomItem);
    assert.equal(rfqCustomItem.customTitle, "لیوان شیشه‌ای لاته ۳۰۰ میلی");
    assert.equal(rfqCustomItem.customUnit, "عدد");
    assert.equal(rfqCustomItem.quantity, 25);
    assert.equal(rfqCustomItem.allocations[0].shoppingListItemId, itemCustomCup.id);

    // -----------------------------------------------------------------------
    // Test B: Verify Snapshot Stability after Catalog Product Mutation
    // -----------------------------------------------------------------------
    await TestProduct.updateOne(
      { _id: productMilk._id },
      { $set: { name: "نام تغییریافته شیر", unit: "گالن", brand: "برند دیگر" } },
    );

    const reloadedRfq1 = await findPurchaseRequestById(cafeIdA, rfq1.id);
    assert.ok(reloadedRfq1);
    const stableMilkSnapshot = reloadedRfq1.items.find((i) => i.itemType === "catalog");
    assert.equal(
      stableMilkSnapshot?.productSnapshot?.name,
      "شیر کامل تازه ۳ درصد",
      "Historical snapshot must remain immutable after catalog changes",
    );
    assert.equal(stableMilkSnapshot?.productSnapshot?.unit, "لیتر");

    // -----------------------------------------------------------------------
    // Test C: Verify Allocation Tracking
    // -----------------------------------------------------------------------
    const allocationsAfterRfq1 = await getShoppingListAllocations(cafeIdA);
    assert.equal(allocationsAfterRfq1.get(itemMilk.id), 12);
    assert.equal(allocationsAfterRfq1.get(itemCustomCup.id), 25);
    assert.equal(allocationsAfterRfq1.get(itemCoffee.id) || 0, 0);

    // Milk available = 20 - 12 = 8
    // Custom cup available = 50 - 25 = 25
    // Coffee available = 15 - 0 = 15

    // -----------------------------------------------------------------------
    // Test D: Submit RFQ (Draft -> Submitted Transition) & Idempotency
    // -----------------------------------------------------------------------
    const submittedRfq1 = await submitPurchaseRequestInRepo(cafeIdA, rfq1.id);
    assert.equal(submittedRfq1.status, "submitted");
    assert.ok(submittedRfq1.submittedAt);

    // Double submit is idempotent
    const doubleSubmitted = await submitPurchaseRequestInRepo(cafeIdA, rfq1.id);
    assert.equal(doubleSubmitted.status, "submitted");
    assert.equal(doubleSubmitted.id, submittedRfq1.id);

    // Allocations remain active after submit
    const allocationsAfterSubmit = await getShoppingListAllocations(cafeIdA);
    assert.equal(allocationsAfterSubmit.get(itemMilk.id), 12);

    // -----------------------------------------------------------------------
    // Test E: Create Second RFQ on remaining available quantity
    // -----------------------------------------------------------------------
    const rfq2 = await repoCreatePurchaseRequest({
      cafeId: cafeIdA,
      createdByUserId: creatorUser._id.toString(),
      title: "استعلام دوم: باقیمانده شیر و دان قهوه",
      status: "draft",
      idempotencyKey: "test-idem-key-2",
      items: [
        {
          itemType: "catalog",
          productId: productMilk._id.toString(),
          productSnapshot: {
            name: productMilk.name,
            unit: productMilk.unit,
          },
          quantity: 8, // Remaining available quantity
          allocations: [
            {
              shoppingListItemId: itemMilk.id,
              quantity: 8,
            },
          ],
        },
      ],
    });

    assert.ok(rfq2.id);
    const allocationsAfterRfq2 = await getShoppingListAllocations(cafeIdA);
    assert.equal(
      allocationsAfterRfq2.get(itemMilk.id),
      20,
      "Total allocated milk should now be 12 + 8 = 20 (100% reserved)",
    );

    // -----------------------------------------------------------------------
    // Test F: Idempotency Key deduplication
    // -----------------------------------------------------------------------
    const existingByIdem = await findPurchaseRequestByIdempotencyKey(
      cafeIdA,
      "test-idem-key-2",
    );
    assert.ok(existingByIdem);
    assert.equal(existingByIdem.id, rfq2.id);

    // -----------------------------------------------------------------------
    // Test G: Cancellation & Allocation Release
    // -----------------------------------------------------------------------
    const cancelledRfq1 = await cancelPurchaseRequestInRepo({
      cafeId: cafeIdA,
      requestId: rfq1.id,
      cancelledByUserId: creatorUser._id.toString(),
      reason: "تغییر منوی کافه و لغو استعلام",
    });

    assert.equal(cancelledRfq1.status, "cancelled");
    assert.ok(cancelledRfq1.cancelledAt);
    assert.equal(cancelledRfq1.cancelReason, "تغییر منوی کافه و لغو استعلام");

    // Allocations of RFQ 1 (12 milk, 25 cups) are now released!
    const allocationsAfterCancel = await getShoppingListAllocations(cafeIdA);
    assert.equal(
      allocationsAfterCancel.get(itemMilk.id),
      8,
      "After cancelling RFQ 1, only RFQ 2 allocation (8) remains active",
    );
    assert.equal(
      allocationsAfterCancel.get(itemCustomCup.id) || 0,
      0,
      "Custom cups allocations are fully released back to shopping list",
    );

    // Double cancel is idempotent
    const doubleCancel = await cancelPurchaseRequestInRepo({
      cafeId: cafeIdA,
      requestId: rfq1.id,
      cancelledByUserId: creatorUser._id.toString(),
    });
    assert.equal(doubleCancel.status, "cancelled");

    // -----------------------------------------------------------------------
    // Test H: Cross-Tenant Isolation
    // -----------------------------------------------------------------------
    // Cafe B must NOT see Cafe A's purchase request
    const crossCafeLookup = await findPurchaseRequestById(cafeIdB, rfq1.id);
    assert.equal(crossCafeLookup, null, "Cafe B cannot view Cafe A RFQ");

    // Cafe B listing must NOT return Cafe A's requests
    const listCafeB = await listPurchaseRequestsByCafe(cafeIdB, {
      page: 1,
      pageSize: 20,
    });
    assert.equal(listCafeB.total, 0);
    assert.equal(listCafeB.items.length, 0);

    // Cafe A listing must return its own requests
    const listCafeA = await listPurchaseRequestsByCafe(cafeIdA, {
      page: 1,
      pageSize: 20,
    });
    assert.equal(listCafeA.total, 2);
    // Deterministic sort: latest created first
    assert.equal(listCafeA.items[0].id, rfq2.id);
    assert.equal(listCafeA.items[1].id, rfq1.id);

    // -----------------------------------------------------------------------
    // Test I: DTO Serializability
    // -----------------------------------------------------------------------
    const serialized = JSON.stringify(reloadedRfq1);
    const parsed = JSON.parse(serialized);
    assert.equal(parsed.id, rfq1.id);
    assert.equal(typeof parsed.createdAt, "string");
    assert.equal(typeof parsed.totalQuantity, "number");
    assert.equal(Array.isArray(parsed.items), true);

    // -----------------------------------------------------------------------
    // Test J: Allocation Lock & Concurrency Simulation
    // -----------------------------------------------------------------------
    const { acquireShoppingListLock, releaseShoppingListLock } = await import(
      "../src/repositories/purchase-request-repository.ts"
    );
    const lockToken1 = "lock-agent-1";
    const lockToken2 = "lock-agent-2";

    const acquired1 = await acquireShoppingListLock(cafeIdA, lockToken1, 5000);
    assert.equal(acquired1, true, "First agent acquires shopping list lock");

    const acquired2 = await acquireShoppingListLock(cafeIdA, lockToken2, 5000);
    assert.equal(acquired2, false, "Second concurrent agent must fail to acquire lock");

    // Release lock
    await releaseShoppingListLock(cafeIdA, lockToken1);

    const acquiredAfterRelease = await acquireShoppingListLock(cafeIdA, lockToken2, 5000);
    assert.equal(acquiredAfterRelease, true, "Lock can be acquired after release");
    await releaseShoppingListLock(cafeIdA, lockToken2);

  } finally {
    await conn.close();
    await mongoose.disconnect();
  }
});
