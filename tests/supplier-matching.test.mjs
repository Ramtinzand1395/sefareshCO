import assert from "node:assert/strict";
import test from "node:test";
import mongoose, { Types } from "mongoose";

import { Cafe } from "../model/cafe.ts";
import { Category } from "../model/category.ts";
import { Product } from "../model/product.ts";
import { PurchaseRequest } from "../model/purchase-request.ts";
import { SupplierOffer } from "../model/supplier-offer.ts";
import { SupplierRequest } from "../model/supplier-request.ts";
import { Supplier } from "../model/supplier.ts";
import { User } from "../model/user.ts";
import {
  matchPurchaseRequestSchema,
  supplierRequestIdSchema,
  supplierRequestQuerySchema,
} from "../src/domain/schemas/supplier-request.ts";
import { canViewSupplierRequests } from "../src/domain/supplier-access.ts";
import {
  cancelSupplierRequestsByPurchaseRequest,
  findBatchMatchingDataForProductIds,
  findSupplierRequestByIdForSupplier,
  findSupplierRequestsForCafeRFQ,
  findSupplierRequestsForSupplierInbox,
} from "../src/repositories/supplier-request-repository.ts";
import {
  matchPurchaseRequestToSuppliers,
  SupplierMatchingInvalidStatusError,
  SupplierMatchingNotFoundError,
} from "../src/services/supplier-matching-service.ts";

// ---------------------------------------------------------------------------
// 1. Zod Schemas & Permission Invariant Tests
// ---------------------------------------------------------------------------

test("matchPurchaseRequestSchema & supplierRequestIdSchema: validate ObjectId format", () => {
  const validId = new Types.ObjectId().toString();

  assert.equal(
    matchPurchaseRequestSchema.safeParse({ requestId: validId }).success,
    true,
  );
  assert.equal(
    matchPurchaseRequestSchema.safeParse({ requestId: "invalid-id" }).success,
    false,
  );
  assert.equal(
    matchPurchaseRequestSchema.safeParse({ requestId: "" }).success,
    false,
  );

  assert.equal(
    supplierRequestIdSchema.safeParse({ id: validId }).success,
    true,
  );
  assert.equal(
    supplierRequestIdSchema.safeParse({ id: "invalid-id" }).success,
    false,
  );
});

test("supplierRequestQuerySchema: normalizes pagination defaults and validates status", () => {
  const resultDefault = supplierRequestQuerySchema.safeParse({});
  assert.equal(resultDefault.success, true);
  if (resultDefault.success) {
    assert.equal(resultDefault.data.page, 1);
    assert.equal(resultDefault.data.pageSize, 20);
    assert.equal(resultDefault.data.status, undefined);
  }

  const resultCustom = supplierRequestQuerySchema.safeParse({
    page: "3",
    pageSize: "15",
    status: "pending",
  });
  assert.equal(resultCustom.success, true);
  if (resultCustom.success) {
    assert.equal(resultCustom.data.page, 3);
    assert.equal(resultCustom.data.pageSize, 15);
    assert.equal(resultCustom.data.status, "pending");
  }

  const resultInvalidStatus = supplierRequestQuerySchema.safeParse({
    status: "invalid_status",
  });
  assert.equal(resultInvalidStatus.success, false);
});

test("canViewSupplierRequests: enforces role-based and explicit permission rules", () => {
  // Owner always allowed
  assert.equal(canViewSupplierRequests({ role: "owner" }), true);

  // Manager and sales allowed by default
  assert.equal(canViewSupplierRequests({ role: "manager" }), true);
  assert.equal(canViewSupplierRequests({ role: "sales" }), true);

  // Warehouse and employee denied by default
  assert.equal(canViewSupplierRequests({ role: "warehouse" }), false);
  assert.equal(canViewSupplierRequests({ role: "employee" }), false);
  assert.equal(canViewSupplierRequests({ role: "accountant" }), false);

  // Explicit true grants access to non-commercial role
  assert.equal(
    canViewSupplierRequests({
      role: "warehouse",
      permissions: { canViewRequests: true },
    }),
    true,
  );

  // Explicit false revokes access from commercial role
  assert.equal(
    canViewSupplierRequests({
      role: "sales",
      permissions: { canViewRequests: false },
    }),
    false,
  );
});

// ---------------------------------------------------------------------------
// 2. Database Integration Tests: Eligibility, Batch Matching, Idempotency,
//    Granularity, Security / Privacy, and Cancellation Propagation
// ---------------------------------------------------------------------------

const TEST_DB_URI =
  process.env.TEST_MONGODB_URI ||
  "mongodb://127.0.0.1:27017/sefaresh_test_runner_supplier_matching";
process.env.MONGODB_URI = TEST_DB_URI;

test("database: Supplier Matching engine, eligibility rules, idempotency, data privacy and lifecycle", async () => {
  let conn;
  try {
    conn = await mongoose.createConnection(TEST_DB_URI).asPromise();
  } catch {
    return; // Skip if local MongoDB test database is unreachable
  }

  try {
    const TestCafe = conn.model("Cafe", Cafe.schema);
    const TestUser = conn.model("User", User.schema);
    const TestCategory = conn.model("Category", Category.schema);
    const TestProduct = conn.model("Product", Product.schema);
    const TestSupplier = conn.model("Supplier", Supplier.schema);
    const TestSupplierOffer = conn.model("SupplierOffer", SupplierOffer.schema);
    const TestPurchaseRequest = conn.model(
      "PurchaseRequest",
      PurchaseRequest.schema,
    );
    const TestSupplierRequest = conn.model(
      "SupplierRequest",
      SupplierRequest.schema,
    );

    // Clean up test collections and sync indexes
    await TestCafe.deleteMany({});
    await TestUser.deleteMany({});
    await TestCategory.deleteMany({});
    await TestProduct.deleteMany({});
    await TestSupplier.deleteMany({});
    await TestSupplierOffer.deleteMany({});
    await TestPurchaseRequest.deleteMany({});
    await TestSupplierRequest.deleteMany({});
    await TestSupplierRequest.syncIndexes();
    await TestSupplierOffer.syncIndexes();

    // 1. Seed base cafe and users
    const cafeUser = await TestUser.create({
      firstName: "سارا",
      lastName: "مدیر کافه",
      status: "active",
    });
    const cafeA = await TestCafe.create({
      name: "کافه تست ونک",
      slug: "cafe-test-vanak",
      status: "active",
      ownerUserId: cafeUser._id,
    });
    const cafeB = await TestCafe.create({
      name: "کافه تست آزادی",
      slug: "cafe-test-azadi",
      status: "active",
      ownerUserId: cafeUser._id,
    });

    const supplierUser = await TestUser.create({
      firstName: "رضا",
      lastName: "تأمین‌کننده",
      status: "active",
    });

    // 2. Seed Suppliers
    // Supplier 1: Active + Verified (Eligible)
    const supplierActiveVerified = await TestSupplier.create({
      ownerUserId: supplierUser._id,
      businessName: "بازرگانی آریا قهوه",
      status: "active",
      isVerified: true,
    });

    // Supplier 2: Inactive + Verified (Ineligible)
    const supplierInactive = await TestSupplier.create({
      ownerUserId: supplierUser._id,
      businessName: "تأمین غیرفعال",
      status: "suspended",
      isVerified: true,
    });

    // Supplier 3: Active + Unverified (Ineligible)
    const supplierUnverified = await TestSupplier.create({
      ownerUserId: supplierUser._id,
      businessName: "تأمین تأییدنشده",
      status: "active",
      isVerified: false,
    });

    // Supplier 4: Active + Verified (Alternative Eligible)
    const supplierAltVerified = await TestSupplier.create({
      ownerUserId: supplierUser._id,
      businessName: "پخش مرکزی پایتخت",
      status: "active",
      isVerified: true,
    });

    // 3. Seed Category & Products
    const category = await TestCategory.create({
      name: "قهوه تخصصی",
      slug: "specialty-coffee",
      status: "active",
    });

    const productA = await TestProduct.create({
      name: "دان قهوه اتیوپی یرگاچف",
      slug: "coffee-ethiopia-yirgacheffe",
      categoryId: category._id,
      unit: "کیلوگرم",
      brand: "یرگاچف سلکت",
      status: "active",
    });

    const productB = await TestProduct.create({
      name: "شیر پرچرب محلی",
      slug: "whole-milk-local",
      categoryId: category._id,
      unit: "لیتر",
      brand: "کاله",
      status: "active",
    });

    const productC = await TestProduct.create({
      name: "شربت کارامل وانیل",
      slug: "syrup-caramel-vanilla",
      categoryId: category._id,
      unit: "بطری",
      status: "active",
    });

    const productInactive = await TestProduct.create({
      name: "محصول غیرفعال",
      slug: "inactive-prod",
      categoryId: category._id,
      unit: "بسته",
      status: "inactive",
    });

    // 4. Seed Supplier Offers
    // Offer 1: Active + Verified Supplier, Product A, Stock: 50, MOQ: 5
    await TestSupplierOffer.create({
      supplierId: supplierActiveVerified._id,
      productId: productA._id,
      price: 450000,
      stock: 50,
      minOrderQuantity: 5,
      deliveryDays: 2,
      status: "active",
    });

    // Offer 2: Active + Verified Supplier, Product B, Stock: 100, MOQ: 10
    await TestSupplierOffer.create({
      supplierId: supplierActiveVerified._id,
      productId: productB._id,
      price: 45000,
      stock: 100,
      minOrderQuantity: 10,
      deliveryDays: 1,
      status: "active",
    });

    // Offer 3: Inactive Offer, Product C
    await TestSupplierOffer.create({
      supplierId: supplierActiveVerified._id,
      productId: productC._id,
      price: 120000,
      stock: 50,
      minOrderQuantity: 1,
      deliveryDays: 2,
      status: "inactive",
    });

    // Offer 4: Inactive Supplier with Product A
    await TestSupplierOffer.create({
      supplierId: supplierInactive._id,
      productId: productA._id,
      price: 400000,
      stock: 100,
      minOrderQuantity: 5,
      deliveryDays: 2,
      status: "active",
    });

    // Offer 5: Unverified Supplier with Product A
    await TestSupplierOffer.create({
      supplierId: supplierUnverified._id,
      productId: productA._id,
      price: 390000,
      stock: 100,
      minOrderQuantity: 5,
      deliveryDays: 2,
      status: "active",
    });

    // Offer 6: Alternative Supplier with Product A (Stock: 20, MOQ: 5)
    await TestSupplierOffer.create({
      supplierId: supplierAltVerified._id,
      productId: productA._id,
      price: 460000,
      stock: 20,
      minOrderQuantity: 5,
      deliveryDays: 3,
      status: "active",
    });

    // -----------------------------------------------------------------------
    // TEST 1-10: Eligibility Rules Verification
    // -----------------------------------------------------------------------
    const batchData = await findBatchMatchingDataForProductIds([
      productA._id.toString(),
      productB._id.toString(),
      productC._id.toString(),
      productInactive._id.toString(),
    ]);

    // Product validity check: active products are returned; inactive product is excluded
    assert.equal(batchData.productMap.get(productA._id.toString())?.isEligible, true);
    assert.equal(batchData.productMap.get(productB._id.toString())?.isEligible, true);
    assert.equal(batchData.productMap.has(productInactive._id.toString()), false);

    // Supplier verification check: active & verified is eligible; inactive or unverified is ineligible
    assert.equal(
      batchData.supplierMap.get(supplierActiveVerified._id.toString())?.isEligible,
      true,
    );
    assert.equal(
      batchData.supplierMap.get(supplierInactive._id.toString())?.isEligible,
      false,
    );
    assert.equal(
      batchData.supplierMap.get(supplierUnverified._id.toString())?.isEligible,
      false,
    );

    // -----------------------------------------------------------------------
    // TEST 11-13: Status Lifecycle & Draft/Cancelled Rejection
    // -----------------------------------------------------------------------
    const draftRfq = await TestPurchaseRequest.create({
      cafeId: cafeA._id,
      referenceNumber: "RFQ-TEST-DRAFT01",
      createdByUserId: cafeUser._id,
      status: "draft",
      items: [
        {
          itemType: "catalog",
          productId: productA._id,
          productSnapshot: { name: productA.name, unit: productA.unit },
          quantity: 10,
          allocations: [
            { shoppingListItemId: new Types.ObjectId(), quantity: 10 },
          ],
        },
      ],
    });

    const cafeIdentityA = {
      userId: cafeUser._id.toString(),
      cafeId: cafeA._id.toString(),
      role: "owner",
    };

    // Draft RFQ must be rejected
    await assert.rejects(
      () =>
        matchPurchaseRequestToSuppliers(
          { requestId: draftRfq._id.toString() },
          cafeIdentityA,
        ),
      (err) => err instanceof SupplierMatchingInvalidStatusError,
    );

    // Cancelled RFQ must be rejected
    const cancelledRfq = await TestPurchaseRequest.create({
      cafeId: cafeA._id,
      referenceNumber: "RFQ-TEST-CANCEL01",
      createdByUserId: cafeUser._id,
      status: "cancelled",
      items: [
        {
          itemType: "catalog",
          productId: productA._id,
          productSnapshot: { name: productA.name, unit: productA.unit },
          quantity: 10,
          allocations: [
            { shoppingListItemId: new Types.ObjectId(), quantity: 10 },
          ],
        },
      ],
    });

    await assert.rejects(
      () =>
        matchPurchaseRequestToSuppliers(
          { requestId: cancelledRfq._id.toString() },
          cafeIdentityA,
        ),
      (err) => err instanceof SupplierMatchingInvalidStatusError,
    );

    // -----------------------------------------------------------------------
    // TEST 14-19: Multi-Item Matching, Custom Items, Stock & MOQ Invariants,
    // Granularity (1 SupplierRequest per RFQ + Supplier with only eligible items)
    // -----------------------------------------------------------------------
    const submittedRfq = await TestPurchaseRequest.create({
      cafeId: cafeA._id,
      referenceNumber: "RFQ-TEST-SUBMIT01",
      createdByUserId: cafeUser._id,
      status: "submitted",
      items: [
        // Item 1: Product A, quantity 10 -> Eligible for ActiveVerified (stock=50, moq=5) and AltVerified (stock=20, moq=5)
        {
          _id: new Types.ObjectId(),
          itemType: "catalog",
          productId: productA._id,
          productSnapshot: {
            name: productA.name,
            unit: productA.unit,
            brand: productA.brand,
          },
          quantity: 10,
          note: "تحویل درب انبار ونک",
          allocations: [
            { shoppingListItemId: new Types.ObjectId(), quantity: 10 },
          ],
        },
        // Item 2: Product B, quantity 25 -> Eligible for ActiveVerified (stock=100, moq=10). NOT available for AltVerified
        {
          _id: new Types.ObjectId(),
          itemType: "catalog",
          productId: productB._id,
          productSnapshot: {
            name: productB.name,
            unit: productB.unit,
            brand: productB.brand,
          },
          quantity: 25,
          allocations: [
            { shoppingListItemId: new Types.ObjectId(), quantity: 25 },
          ],
        },
        // Item 3: Product C, quantity 5 -> Only inactive offer exists -> unmatched (reason: no_active_offer)
        {
          _id: new Types.ObjectId(),
          itemType: "catalog",
          productId: productC._id,
          productSnapshot: { name: productC.name, unit: productC.unit },
          quantity: 5,
          allocations: [
            { shoppingListItemId: new Types.ObjectId(), quantity: 5 },
          ],
        },
        // Item 4: Custom Item -> No productId -> unmatched (reason: custom_item), NO fuzzy matching
        {
          _id: new Types.ObjectId(),
          itemType: "custom",
          customTitle: "دستمال کاغذی جعبه‌ای ۲۰۰ برگ",
          customUnit: "جعبه",
          quantity: 30,
          allocations: [
            { shoppingListItemId: new Types.ObjectId(), quantity: 30 },
          ],
        },
      ],
    });

    const matchResult = await matchPurchaseRequestToSuppliers(
      { requestId: submittedRfq._id.toString() },
      cafeIdentityA,
    );

    // Verify structured result statistics
    assert.equal(matchResult.purchaseRequestId, submittedRfq._id.toString());
    assert.equal(matchResult.catalogItemCount, 3);
    assert.equal(matchResult.customItemCount, 1);
    assert.equal(matchResult.matchedItemCount, 2); // Product A and Product B matched
    assert.equal(matchResult.unmatchedItemCount, 2); // Product C (inactive offer) + Custom item
    assert.equal(matchResult.eligibleSupplierCount, 2); // ActiveVerified and AltVerified
    assert.equal(matchResult.supplierRequestsCreated, 2);
    assert.equal(matchResult.supplierRequestsSkipped, 0);

    // Verify unmatched items breakdown
    const customUnmatched = matchResult.unmatchedItems.find(
      (u) => u.itemType === "custom",
    );
    assert.ok(customUnmatched);
    assert.equal(customUnmatched.reason, "custom_item");
    assert.equal(customUnmatched.title, "دستمال کاغذی جعبه‌ای ۲۰۰ برگ");

    const productCUnmatched = matchResult.unmatchedItems.find(
      (u) => u.productId === productC._id.toString(),
    );
    assert.ok(productCUnmatched);
    assert.equal(productCUnmatched.reason, "no_active_offer");

    // Check Granularity: 1 SupplierRequest per (PurchaseRequest + Supplier)
    const activeVerifiedReq = await TestSupplierRequest.findOne({
      purchaseRequestId: submittedRfq._id,
      supplierId: supplierActiveVerified._id,
    }).lean();
    assert.ok(activeVerifiedReq);
    // ActiveVerified is eligible for both Product A and Product B -> exactly 2 items
    assert.equal(activeVerifiedReq.items.length, 2);
    assert.equal(activeVerifiedReq.items[0].quantity, 10);
    assert.equal(activeVerifiedReq.items[0].note, "تحویل درب انبار ونک");
    assert.equal(activeVerifiedReq.items[1].quantity, 25);

    const altVerifiedReq = await TestSupplierRequest.findOne({
      purchaseRequestId: submittedRfq._id,
      supplierId: supplierAltVerified._id,
    }).lean();
    assert.ok(altVerifiedReq);
    // AltVerified is ONLY eligible for Product A -> exactly 1 item; Product B & C MUST NOT be visible!
    assert.equal(altVerifiedReq.items.length, 1);
    assert.equal(
      altVerifiedReq.items[0].productId.toString(),
      productA._id.toString(),
    );

    // -----------------------------------------------------------------------
    // TEST 20-24: Idempotency & Re-run Semantics
    // -----------------------------------------------------------------------
    // Re-running matching on the same submitted RFQ:
    // Should NOT duplicate SupplierRequests!
    const rerunResult = await matchPurchaseRequestToSuppliers(
      { requestId: submittedRfq._id.toString() },
      cafeIdentityA,
    );

    assert.equal(rerunResult.supplierRequestsCreated, 0);
    assert.equal(rerunResult.supplierRequestsSkipped, 2);

    // Database count must still be exactly 2
    const totalRequestsCount = await TestSupplierRequest.countDocuments({
      purchaseRequestId: submittedRfq._id,
    });
    assert.equal(totalRequestsCount, 2);

    // Verify DB unique compound index: duplicate insert fails with 11000
    await assert.rejects(
      () =>
        TestSupplierRequest.create({
          purchaseRequestId: submittedRfq._id,
          supplierId: supplierActiveVerified._id,
          cafeId: cafeA._id,
          status: "pending",
          items: [
            {
              purchaseRequestItemId: new Types.ObjectId(),
              productId: productA._id,
              quantity: 10,
              productSnapshot: { name: productA.name, unit: productA.unit },
            },
          ],
        }),
      (err) => err?.code === 11000,
    );

    // New eligible supplier added after first run:
    // Activate a new verified supplier with an offer for Product A
    const supplierNew = await TestSupplier.create({
      ownerUserId: supplierUser._id,
      businessName: "تأمین‌کننده تازه وارد",
      status: "active",
      isVerified: true,
    });

    await TestSupplierOffer.create({
      supplierId: supplierNew._id,
      productId: productA._id,
      price: 430000,
      stock: 50,
      minOrderQuantity: 1,
      deliveryDays: 1,
      status: "active",
    });

    // Re-run matching: new supplier gets a new SupplierRequest; existing 2 are skipped and preserved
    const rerunWithNewSupplierResult = await matchPurchaseRequestToSuppliers(
      { requestId: submittedRfq._id.toString() },
      cafeIdentityA,
    );

    assert.equal(rerunWithNewSupplierResult.supplierRequestsCreated, 1);
    assert.equal(rerunWithNewSupplierResult.supplierRequestsSkipped, 2);
    assert.equal(
      await TestSupplierRequest.countDocuments({
        purchaseRequestId: submittedRfq._id,
      }),
      3,
    );

    // -----------------------------------------------------------------------
    // TEST 25-30: Security, Tenant Isolation & Data Privacy
    // -----------------------------------------------------------------------
    // Cafe B user cannot match Cafe A's RFQ
    const cafeIdentityB = {
      userId: cafeUser._id.toString(),
      cafeId: cafeB._id.toString(),
      role: "owner",
    };

    await assert.rejects(
      () =>
        matchPurchaseRequestToSuppliers(
          { requestId: submittedRfq._id.toString() },
          cafeIdentityB,
        ),
      (err) => err instanceof SupplierMatchingNotFoundError,
    );

    // Supplier-facing read boundary:
    // Supplier AltVerified looks up their request
    const altReqDto = await findSupplierRequestByIdForSupplier(
      supplierAltVerified._id.toString(),
      altVerifiedReq._id.toString(),
    );
    assert.ok(altReqDto);

    // Supplier A cannot read Supplier B's request (supplier scoping)
    const forbiddenLookup = await findSupplierRequestByIdForSupplier(
      supplierInactive._id.toString(),
      altVerifiedReq._id.toString(),
    );
    assert.equal(forbiddenLookup, null);

    // Privacy verification:
    // Supplier-facing DTO must NOT leak:
    // - shoppingListItemId / allocations
    // - InternalPurchaseRequest data
    // - cafe internal IDs or user IDs
    // - other suppliers or offers
    const jsonString = JSON.stringify(altReqDto);
    assert.ok(!jsonString.includes("allocations"));
    assert.ok(!jsonString.includes("shoppingListItemId"));
    assert.ok(!jsonString.includes("cafeId"));
    assert.ok(!jsonString.includes("createdByUserId"));
    assert.ok(!jsonString.includes("internalPurchaseRequest"));
    assert.ok(!jsonString.includes(supplierActiveVerified._id.toString()));

    // DTO must be fully serializable
    assert.doesNotThrow(() => JSON.parse(jsonString));

    // Scoped list for Cafe RFQ detail inspection
    const cafeRfqRequests = await findSupplierRequestsForCafeRFQ(
      cafeA._id.toString(),
      submittedRfq._id.toString(),
    );
    assert.equal(cafeRfqRequests.length, 3);
    assert.ok(cafeRfqRequests[0].supplierName);

    // Scoped list for Supplier Inbox
    const supplierInboxResult = await findSupplierRequestsForSupplierInbox(
      supplierAltVerified._id.toString(),
      { page: 1, pageSize: 20 },
    );
    assert.equal(supplierInboxResult.total, 1);
    assert.equal(supplierInboxResult.items[0].referenceNumber, submittedRfq.referenceNumber);

    // -----------------------------------------------------------------------
    // TEST 31-36: Stock, MOQ, Historical Snapshot Integrity & Cancellation Propagation
    // -----------------------------------------------------------------------
    // Test Stock & MOQ rejection:
    // RFQ requesting quantity 30 for AltVerified (who only has stock=20)
    const rfqLargeQty = await TestPurchaseRequest.create({
      cafeId: cafeA._id,
      referenceNumber: "RFQ-TEST-STOCK01",
      createdByUserId: cafeUser._id,
      status: "submitted",
      items: [
        {
          _id: new Types.ObjectId(),
          itemType: "catalog",
          productId: productA._id,
          productSnapshot: { name: productA.name, unit: productA.unit },
          quantity: 25, // AltVerified has stock=20, so AltVerified is ineligible! ActiveVerified has stock=50 -> eligible
          allocations: [
            { shoppingListItemId: new Types.ObjectId(), quantity: 25 },
          ],
        },
      ],
    });

    const stockMatchResult = await matchPurchaseRequestToSuppliers(
      { requestId: rfqLargeQty._id.toString() },
      cafeIdentityA,
    );
    assert.equal(stockMatchResult.matchedItemCount, 1);
    assert.equal(stockMatchResult.supplierRequestsCreated, 2); // ActiveVerified and NewSupplier are eligible; AltVerified is ineligible due to stock (25 > 20)

    // AltVerified must NOT receive a request because 25 > 20 stock!
    const altLargeReq = await TestSupplierRequest.findOne({
      purchaseRequestId: rfqLargeQty._id,
      supplierId: supplierAltVerified._id,
    });
    assert.equal(altLargeReq, null);

    // Historical Snapshot Integrity:
    // Modifying Product name in Catalog AFTER matching must NOT mutate existing SupplierRequest snapshot
    await TestProduct.updateOne(
      { _id: productA._id },
      { $set: { name: "نام جدید محصول در کاتالوگ جاری" } },
    );

    const snapshotReq = await TestSupplierRequest.findOne({
      purchaseRequestId: submittedRfq._id,
      supplierId: supplierActiveVerified._id,
    }).lean();
    assert.equal(
      snapshotReq.items[0].productSnapshot.name,
      "دان قهوه اتیوپی یرگاچف", // Preserved historical RFQ snapshot!
    );

    // Cancellation Propagation:
    // When PurchaseRequest is cancelled, all pending child SupplierRequests become cancelled
    const cancelNow = new Date();
    const cancelledCount = await cancelSupplierRequestsByPurchaseRequest(
      submittedRfq._id.toString(),
      cancelNow,
    );
    assert.equal(cancelledCount, 3);

    const cancelledReqDocs = await TestSupplierRequest.find({
      purchaseRequestId: submittedRfq._id,
    }).lean();

    for (const req of cancelledReqDocs) {
      assert.equal(req.status, "cancelled");
      assert.ok(req.cancelledAt);
    }
  } finally {
    if (conn) {
      await conn.close();
    }
    await mongoose.disconnect();
  }
});
