import assert from "node:assert/strict";
import test from "node:test";
import mongoose, { Types } from "mongoose";

import { Cafe } from "../model/cafe.ts";
import { Category } from "../model/category.ts";
import { Product } from "../model/product.ts";
import { PurchaseRequest } from "../model/purchase-request.ts";
import { SupplierOffer } from "../model/supplier-offer.ts";
import { SupplierRequest } from "../model/supplier-request.ts";
import { SupplierResponse } from "../model/supplier-response.ts";
import { Supplier } from "../model/supplier.ts";
import { User } from "../model/user.ts";
import {
  declineSupplierRequestSchema,
  submitSupplierResponseSchema,
  supplierResponseItemInputSchema,
} from "../src/domain/schemas/supplier-response.ts";
import {
  canRespondToSupplierRequests,
} from "../src/domain/supplier-access.ts";
import {
  calculateSupplierResponseTotals,
  SupplierResponseCalculationError,
} from "../src/domain/supplier-response-totals.ts";
import {
  findSupplierResponseBySupplierRequestId,
  findSupplierResponseForSupplier,
  findSupplierResponsesForCafeRFQ,
} from "../src/repositories/supplier-response-repository.ts";
import {
  cancelSupplierRequestsByPurchaseRequest,
} from "../src/repositories/supplier-request-repository.ts";
import {
  declineSupplierRequest,
  getSupplierResponseForSupplier,
  getSupplierResponsesForCafeRFQ,
  submitSupplierResponse,
  SupplierResponseInvalidStatusError,
  SupplierResponseNotFoundError,
  SupplierResponsePermissionError,
  SupplierResponseValidationError,
  updateSupplierResponseService,
} from "../src/services/supplier-response-service.ts";

// ---------------------------------------------------------------------------
// 1. Domain Unit Tests: Zod Schemas, Calculation Helper & Permission Rules
// ---------------------------------------------------------------------------

test("validation: unitPrice must be positive integer and safe integer; rejects float, negative and unsafe integer", () => {
  const validId = new Types.ObjectId().toString();

  // Valid positive integer
  const validItem = supplierResponseItemInputSchema.safeParse({
    purchaseRequestItemId: validId,
    status: "quoted",
    unitPrice: 150000,
    confirmedQuantity: 5,
  });
  assert.equal(validItem.success, true);

  // Float price rejected
  const floatPrice = supplierResponseItemInputSchema.safeParse({
    purchaseRequestItemId: validId,
    status: "quoted",
    unitPrice: 150000.75,
    confirmedQuantity: 5,
  });
  assert.equal(floatPrice.success, false);

  // Negative price rejected
  const negativePrice = supplierResponseItemInputSchema.safeParse({
    purchaseRequestItemId: validId,
    status: "quoted",
    unitPrice: -50000,
    confirmedQuantity: 5,
  });
  assert.equal(negativePrice.success, false);

  // Zero price rejected
  const zeroPrice = supplierResponseItemInputSchema.safeParse({
    purchaseRequestItemId: validId,
    status: "quoted",
    unitPrice: 0,
    confirmedQuantity: 5,
  });
  assert.equal(zeroPrice.success, false);

  // Unsafe integer price rejected
  const unsafePrice = supplierResponseItemInputSchema.safeParse({
    purchaseRequestItemId: validId,
    status: "quoted",
    unitPrice: 9007199254740992,
    confirmedQuantity: 5,
  });
  assert.equal(unsafePrice.success, false);
});

test("validation: confirmedQuantity must be positive integer; rejects float, 0, negative", () => {
  const validId = new Types.ObjectId().toString();

  // Valid positive integer
  assert.equal(
    supplierResponseItemInputSchema.safeParse({
      purchaseRequestItemId: validId,
      status: "quoted",
      unitPrice: 100000,
      confirmedQuantity: 10,
    }).success,
    true,
  );

  // Float quantity rejected
  assert.equal(
    supplierResponseItemInputSchema.safeParse({
      purchaseRequestItemId: validId,
      status: "quoted",
      unitPrice: 100000,
      confirmedQuantity: 2.5,
    }).success,
    false,
  );

  // Zero quantity rejected for quoted
  assert.equal(
    supplierResponseItemInputSchema.safeParse({
      purchaseRequestItemId: validId,
      status: "quoted",
      unitPrice: 100000,
      confirmedQuantity: 0,
    }).success,
    false,
  );

  // Negative quantity rejected
  assert.equal(
    supplierResponseItemInputSchema.safeParse({
      purchaseRequestItemId: validId,
      status: "quoted",
      unitPrice: 100000,
      confirmedQuantity: -3,
    }).success,
    false,
  );
});

test("validation: unavailable item must NOT have price; confirmedQuantity must be 0 or absent", () => {
  const validId = new Types.ObjectId().toString();

  // Valid unavailable item
  const validUnavailable = supplierResponseItemInputSchema.safeParse({
    purchaseRequestItemId: validId,
    status: "unavailable",
    note: "عدم موجودی در انبار",
  });
  assert.equal(validUnavailable.success, true);

  // Unavailable item with price must be rejected
  const unavailableWithPrice = supplierResponseItemInputSchema.safeParse({
    purchaseRequestItemId: validId,
    status: "unavailable",
    unitPrice: 50000,
  });
  assert.equal(unavailableWithPrice.success, false);

  // Unavailable item with confirmedQuantity > 0 must be rejected
  const unavailableWithQty = supplierResponseItemInputSchema.safeParse({
    purchaseRequestItemId: validId,
    status: "unavailable",
    confirmedQuantity: 2,
  });
  assert.equal(unavailableWithQty.success, false);
});

test("validation: shippingCost >= 0 and deliveryDays >= 0 validation", () => {
  const validId = new Types.ObjectId().toString();
  const validReqId = new Types.ObjectId().toString();

  const validPayload = {
    supplierRequestId: validReqId,
    deliveryDays: 2,
    shippingCost: 75000,
    items: [
      {
        purchaseRequestItemId: validId,
        status: "quoted",
        unitPrice: 100000,
        confirmedQuantity: 5,
      },
    ],
  };

  assert.equal(submitSupplierResponseSchema.safeParse(validPayload).success, true);

  // 0 shipping cost (free shipping) is valid
  assert.equal(
    submitSupplierResponseSchema.safeParse({
      ...validPayload,
      shippingCost: 0,
    }).success,
    true,
  );

  // Negative shipping cost rejected
  assert.equal(
    submitSupplierResponseSchema.safeParse({
      ...validPayload,
      shippingCost: -1000,
    }).success,
    false,
  );

  // Float shipping cost rejected
  assert.equal(
    submitSupplierResponseSchema.safeParse({
      ...validPayload,
      shippingCost: 50000.5,
    }).success,
    false,
  );

  // 0 delivery days (same day) is valid
  assert.equal(
    submitSupplierResponseSchema.safeParse({
      ...validPayload,
      deliveryDays: 0,
    }).success,
    true,
  );

  // Negative delivery days rejected
  assert.equal(
    submitSupplierResponseSchema.safeParse({
      ...validPayload,
      deliveryDays: -1,
    }).success,
    false,
  );
});

test("validation: declineSupplierRequestSchema validates ObjectId and bounds reason length", () => {
  const validId = new Types.ObjectId().toString();
  assert.equal(
    declineSupplierRequestSchema.safeParse({ supplierRequestId: validId }).success,
    true,
  );
  assert.equal(
    declineSupplierRequestSchema.safeParse({
      supplierRequestId: validId,
      reason: "عدم توانایی تأمین در تاریخ مورد نظر",
    }).success,
    true,
  );
  assert.equal(
    declineSupplierRequestSchema.safeParse({
      supplierRequestId: "invalid-id",
    }).success,
    false,
  );
  assert.equal(
    declineSupplierRequestSchema.safeParse({
      supplierRequestId: validId,
      reason: "a".repeat(301),
    }).success,
    false,
  );
});

test("validation: calculateSupplierResponseTotals calculates totals correctly and detects arithmetic overflow", () => {
  const item1Id = new Types.ObjectId().toString();
  const item2Id = new Types.ObjectId().toString();

  const totals = calculateSupplierResponseTotals(
    [
      {
        purchaseRequestItemId: item1Id,
        status: "quoted",
        unitPrice: 200000,
        confirmedQuantity: 3,
      },
      {
        purchaseRequestItemId: item2Id,
        status: "unavailable",
      },
    ],
    50000,
  );

  assert.equal(totals.itemSubtotal, 600000);
  assert.equal(totals.shippingCost, 50000);
  assert.equal(totals.estimatedTotal, 650000);
  assert.equal(totals.items.length, 2);
  assert.equal(totals.items[0].itemSubtotal, 600000);
  assert.equal(totals.items[1].itemSubtotal, 0);

  // Overflow detection
  assert.throws(
    () =>
      calculateSupplierResponseTotals(
        [
          {
            purchaseRequestItemId: item1Id,
            status: "quoted",
            unitPrice: Number.MAX_SAFE_INTEGER,
            confirmedQuantity: 2,
          },
        ],
        1000,
      ),
    (err) => err instanceof SupplierResponseCalculationError,
  );
});

test("permissions: canRespondToSupplierRequests enforces role-based and explicit permissions", () => {
  // Owner always permitted
  assert.equal(canRespondToSupplierRequests({ role: "owner" }), true);

  // Manager and sales permitted by default
  assert.equal(canRespondToSupplierRequests({ role: "manager" }), true);
  assert.equal(canRespondToSupplierRequests({ role: "sales" }), true);

  // Warehouse, accountant, employee denied by default
  assert.equal(canRespondToSupplierRequests({ role: "warehouse" }), false);
  assert.equal(canRespondToSupplierRequests({ role: "accountant" }), false);
  assert.equal(canRespondToSupplierRequests({ role: "employee" }), false);

  // Explicit true grants access to non-commercial role
  assert.equal(
    canRespondToSupplierRequests({
      role: "warehouse",
      permissions: { canRespondToRequests: true },
    }),
    true,
  );

  // Explicit false revokes access from sales
  assert.equal(
    canRespondToSupplierRequests({
      role: "sales",
      permissions: { canRespondToRequests: false },
    }),
    false,
  );
});

// ---------------------------------------------------------------------------
// 2. Database Integration Tests: Complete Lifecycle, Concurrency,
//    Idempotency, Authorization, Privacy & Snapshots
// ---------------------------------------------------------------------------

const TEST_DB_URI =
  process.env.TEST_MONGODB_URI ||
  "mongodb://127.0.0.1:27017/sefaresh_test_runner_supplier_response";
process.env.MONGODB_URI = TEST_DB_URI;

test("database: Supplier Response lifecycle, validations, authorization, concurrency, idempotency, and DTOs", async () => {
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
    const TestPurchaseRequest = conn.model("PurchaseRequest", PurchaseRequest.schema);
    const TestSupplierRequest = conn.model("SupplierRequest", SupplierRequest.schema);
    const TestSupplierResponse = conn.model("SupplierResponse", SupplierResponse.schema);

    // Clean up test collections and sync indexes
    await TestCafe.deleteMany({});
    await TestUser.deleteMany({});
    await TestCategory.deleteMany({});
    await TestProduct.deleteMany({});
    await TestSupplier.deleteMany({});
    await TestSupplierOffer.deleteMany({});
    await TestPurchaseRequest.deleteMany({});
    await TestSupplierRequest.deleteMany({});
    await TestSupplierResponse.deleteMany({});
    await TestSupplierRequest.syncIndexes();
    await TestSupplierResponse.syncIndexes();

    // 1. Seed base users and Cafe
    const cafeUser = await TestUser.create({
      firstName: "مدیر",
      lastName: "کافه تست",
      status: "active",
    });
    const cafe = await TestCafe.create({
      name: "کافه تستی ویژه",
      slug: "special-test-cafe",
      status: "active",
      ownerUserId: cafeUser._id,
    });

    const supplierUserA = await TestUser.create({
      firstName: "علی",
      lastName: "فروشنده تأمین الف",
      status: "active",
    });
    const supplierUserB = await TestUser.create({
      firstName: "بهرام",
      lastName: "فروشنده تأمین ب",
      status: "active",
    });

    // 2. Seed Suppliers
    const supplierA = await TestSupplier.create({
      ownerUserId: supplierUserA._id,
      businessName: "شرکت بازرگانی قهوه زرین",
      status: "active",
      isVerified: true,
    });

    const supplierB = await TestSupplier.create({
      ownerUserId: supplierUserB._id,
      businessName: "توزیع گستر پیشتاز",
      status: "active",
      isVerified: true,
    });

    // 3. Seed Category & Products
    const category = await TestCategory.create({
      name: "دانه قهوه",
      slug: "coffee-beans",
      status: "active",
    });

    const product1 = await TestProduct.create({
      name: "دانه قهوه اسپرسو بلِند ۷۰/۳۰",
      slug: "espresso-blend-70-30",
      categoryId: category._id,
      unit: "کیلوگرم",
      brand: "زرین",
      status: "active",
    });

    const product2 = await TestProduct.create({
      name: "شیر پرچرب ۱ لیتری",
      slug: "milk-whole-1l",
      categoryId: category._id,
      unit: "لیتر",
      brand: "دامداران",
      status: "active",
    });

    const product3 = await TestProduct.create({
      name: "شربت سیروپ فندق",
      slug: "hazelnut-syrup",
      categoryId: category._id,
      unit: "بطری",
      brand: "سن ایچ",
      status: "active",
    });

    // 4. Seed Supplier Offer for product1
    const offerProduct1 = await TestSupplierOffer.create({
      supplierId: supplierA._id,
      productId: product1._id,
      price: 450000,
      stock: 100,
      minOrderQuantity: 1,
      deliveryDays: 2,
      status: "active",
    });

    // 5. Seed Parent PurchaseRequest (RFQ) with 3 items
    const rfqItem1Id = new Types.ObjectId();
    const rfqItem2Id = new Types.ObjectId();
    const rfqItem3Id = new Types.ObjectId();

    const rfq = await TestPurchaseRequest.create({
      cafeId: cafe._id,
      referenceNumber: "RFQ-TEST-QUOTE-01",
      createdByUserId: cafeUser._id,
      status: "submitted",
      items: [
        {
          _id: rfqItem1Id,
          itemType: "catalog",
          productId: product1._id,
          productSnapshot: { name: product1.name, unit: product1.unit },
          quantity: 10,
          allocations: [
            { shoppingListItemId: new Types.ObjectId(), quantity: 10 },
          ],
        },
        {
          _id: rfqItem2Id,
          itemType: "catalog",
          productId: product2._id,
          productSnapshot: { name: product2.name, unit: product2.unit },
          quantity: 20,
          allocations: [
            { shoppingListItemId: new Types.ObjectId(), quantity: 20 },
          ],
        },
        {
          _id: rfqItem3Id,
          itemType: "catalog",
          productId: product3._id,
          productSnapshot: { name: product3.name, unit: product3.unit },
          quantity: 5,
          allocations: [
            { shoppingListItemId: new Types.ObjectId(), quantity: 5 },
          ],
        },
      ],
    });

    // 6. Seed SupplierRequest for Supplier A with all 3 items
    const supplierReqA = await TestSupplierRequest.create({
      purchaseRequestId: rfq._id,
      supplierId: supplierA._id,
      cafeId: cafe._id,
      status: "pending",
      items: [
        {
          _id: new Types.ObjectId(),
          purchaseRequestItemId: rfqItem1Id,
          productId: product1._id,
          quantity: 10,
          productSnapshot: { name: product1.name, unit: product1.unit, brand: product1.brand },
        },
        {
          _id: new Types.ObjectId(),
          purchaseRequestItemId: rfqItem2Id,
          productId: product2._id,
          quantity: 20,
          productSnapshot: { name: product2.name, unit: product2.unit, brand: product2.brand },
        },
        {
          _id: new Types.ObjectId(),
          purchaseRequestItemId: rfqItem3Id,
          productId: product3._id,
          quantity: 5,
          productSnapshot: { name: product3.name, unit: product3.unit, brand: product3.brand },
        },
      ],
    });

    const supplierIdentityA = {
      userId: supplierUserA._id.toString(),
      supplierId: supplierA._id.toString(),
      role: "owner",
    };

    const supplierIdentityB = {
      userId: supplierUserB._id.toString(),
      supplierId: supplierB._id.toString(),
      role: "owner",
    };

    const cafeIdentity = {
      userId: cafeUser._id.toString(),
      cafeId: cafe._id.toString(),
      role: "owner",
    };

    // -----------------------------------------------------------------------
    // TEST 13-16: Authorization & Cross-Supplier Isolation
    // -----------------------------------------------------------------------
    // Supplier B cannot respond to Supplier A's request
    await assert.rejects(
      () =>
        submitSupplierResponse(
          {
            supplierRequestId: supplierReqA._id.toString(),
            deliveryDays: 1,
            shippingCost: 50000,
            items: [
              {
                purchaseRequestItemId: rfqItem1Id.toString(),
                status: "quoted",
                unitPrice: 420000,
                confirmedQuantity: 10,
              },
              {
                purchaseRequestItemId: rfqItem2Id.toString(),
                status: "unavailable",
              },
              {
                purchaseRequestItemId: rfqItem3Id.toString(),
                status: "unavailable",
              },
            ],
          },
          supplierIdentityB,
        ),
      (err) => err instanceof SupplierResponseNotFoundError,
    );

    // Supplier A member without permission cannot respond
    const employeeIdentityA = {
      userId: supplierUserA._id.toString(),
      supplierId: supplierA._id.toString(),
      role: "employee",
      permissions: { canRespondToRequests: false },
    };

    await assert.rejects(
      () =>
        submitSupplierResponse(
          {
            supplierRequestId: supplierReqA._id.toString(),
            deliveryDays: 1,
            shippingCost: 50000,
            items: [
              {
                purchaseRequestItemId: rfqItem1Id.toString(),
                status: "quoted",
                unitPrice: 420000,
                confirmedQuantity: 10,
              },
            ],
          },
          employeeIdentityA,
        ),
      (err) => err instanceof SupplierResponsePermissionError,
    );

    // -----------------------------------------------------------------------
    // TEST 5 & 10: Incomplete response & confirmedQuantity > requestedQuantity
    // -----------------------------------------------------------------------
    // Incomplete response (decision missing for item 2 and item 3) must be rejected
    await assert.rejects(
      () =>
        submitSupplierResponse(
          {
            supplierRequestId: supplierReqA._id.toString(),
            deliveryDays: 2,
            shippingCost: 30000,
            items: [
              {
                purchaseRequestItemId: rfqItem1Id.toString(),
                status: "quoted",
                unitPrice: 430000,
                confirmedQuantity: 10,
              },
            ],
          },
          supplierIdentityA,
        ),
      (err) =>
        err instanceof SupplierResponseValidationError &&
        err.message.includes("پاسخ ناقص است"),
    );

    // confirmedQuantity > requestedQuantity must be rejected (Item 1 requested quantity is 10)
    await assert.rejects(
      () =>
        submitSupplierResponse(
          {
            supplierRequestId: supplierReqA._id.toString(),
            deliveryDays: 2,
            shippingCost: 30000,
            items: [
              {
                purchaseRequestItemId: rfqItem1Id.toString(),
                status: "quoted",
                unitPrice: 430000,
                confirmedQuantity: 15, // > 10!
              },
              {
                purchaseRequestItemId: rfqItem2Id.toString(),
                status: "unavailable",
              },
              {
                purchaseRequestItemId: rfqItem3Id.toString(),
                status: "unavailable",
              },
            ],
          },
          supplierIdentityA,
        ),
      (err) =>
        err instanceof SupplierResponseValidationError &&
        err.message.includes("بیشتر از تعداد درخواستی"),
    );

    // -----------------------------------------------------------------------
    // TEST 17: Pending -> Responded (Valid Partial Response)
    // -----------------------------------------------------------------------
    // Supplier quotes Item 1 (partial quantity 8 of 10) and Item 2 (full 20), marks Item 3 unavailable
    const submittedResponse = await submitSupplierResponse(
      {
        supplierRequestId: supplierReqA._id.toString(),
        deliveryDays: 2,
        shippingCost: 60000,
        note: "تحویل با بسته‌بندی مقاوم",
        items: [
          {
            purchaseRequestItemId: rfqItem1Id.toString(),
            status: "quoted",
            unitPrice: 420000, // Offer price was 450,000 -> RFQ quote is independent!
            confirmedQuantity: 8,
            note: "تأمین فوری ۸ کیلوگرم موجود",
          },
          {
            purchaseRequestItemId: rfqItem2Id.toString(),
            status: "quoted",
            unitPrice: 48000,
            confirmedQuantity: 20,
          },
          {
            purchaseRequestItemId: rfqItem3Id.toString(),
            status: "unavailable",
            note: "موقتاً ناموجود در انبار مرکزی",
          },
        ],
      },
      supplierIdentityA,
    );

    assert.ok(submittedResponse);
    assert.equal(submittedResponse.supplierRequestId, supplierReqA._id.toString());
    assert.equal(submittedResponse.referenceNumber, rfq.referenceNumber);
    assert.equal(submittedResponse.deliveryDays, 2);
    assert.equal(submittedResponse.shippingCost, 60000);

    // Verify Backend calculation:
    // Item 1: 420,000 * 8 = 3,360,000
    // Item 2: 48,000 * 20 = 960,000
    // Item 3: 0
    // Item Subtotal: 3,360,000 + 960,000 = 4,320,000
    // Estimated Total: 4,320,000 + 60,000 = 4,380,000
    assert.equal(submittedResponse.itemSubtotal, 4320000);
    assert.equal(submittedResponse.estimatedTotal, 4380000);

    // Verify SupplierRequest status updated to "responded"
    const updatedReqDoc = await TestSupplierRequest.findById(supplierReqA._id).lean();
    assert.equal(updatedReqDoc.status, "responded");
    assert.ok(updatedReqDoc.respondedAt);

    // -----------------------------------------------------------------------
    // TEST 25-28: Idempotency & Unique DB Invariant
    // -----------------------------------------------------------------------
    // Double submit / retry of submitSupplierResponse on already responded request
    // returns existing response without duplicating!
    const retryResult = await submitSupplierResponse(
      {
        supplierRequestId: supplierReqA._id.toString(),
        deliveryDays: 2,
        shippingCost: 60000,
        items: [
          {
            purchaseRequestItemId: rfqItem1Id.toString(),
            status: "quoted",
            unitPrice: 420000,
            confirmedQuantity: 8,
          },
          {
            purchaseRequestItemId: rfqItem2Id.toString(),
            status: "quoted",
            unitPrice: 48000,
            confirmedQuantity: 20,
          },
          {
            purchaseRequestItemId: rfqItem3Id.toString(),
            status: "unavailable",
          },
        ],
      },
      supplierIdentityA,
    );

    assert.equal(retryResult.id, submittedResponse.id);

    // Database must strictly contain only 1 response for this supplierRequest
    const totalResponsesCount = await TestSupplierResponse.countDocuments({
      supplierRequestId: supplierReqA._id,
    });
    assert.equal(totalResponsesCount, 1);

    // Unique index check: manual insert of duplicate supplierRequestId fails with code 11000
    await assert.rejects(
      () =>
        TestSupplierResponse.create({
          supplierRequestId: supplierReqA._id,
          purchaseRequestId: rfq._id,
          supplierId: supplierA._id,
          cafeId: cafe._id,
          respondedByUserId: supplierUserA._id,
          deliveryDays: 1,
          shippingCost: 0,
          itemSubtotal: 1000,
          estimatedTotal: 1000,
          items: [
            {
              purchaseRequestItemId: rfqItem1Id,
              productId: product1._id,
              status: "quoted",
              unitPrice: 1000,
              confirmedQuantity: 1,
              itemSubtotal: 1000,
            },
          ],
        }),
      (err) => err?.code === 11000,
    );

    // -----------------------------------------------------------------------
    // TEST 21, 23, 24: Responded -> Update (Edit Quote), Audit Preservation
    // -----------------------------------------------------------------------
    const originalRespondedAt = submittedResponse.respondedAt;
    const originalUpdatedAt = submittedResponse.updatedAt;

    // Small delay to verify timestamp evolution
    await new Promise((r) => setTimeout(r, 50));

    const updatedQuote = await updateSupplierResponseService(
      {
        supplierRequestId: supplierReqA._id.toString(),
        deliveryDays: 3,
        shippingCost: 50000, // Reduced shipping
        items: [
          {
            purchaseRequestItemId: rfqItem1Id.toString(),
            status: "quoted",
            unitPrice: 410000, // Corrected price lower
            confirmedQuantity: 10, // Full quantity now available
          },
          {
            purchaseRequestItemId: rfqItem2Id.toString(),
            status: "quoted",
            unitPrice: 48000,
            confirmedQuantity: 20,
          },
          {
            purchaseRequestItemId: rfqItem3Id.toString(),
            status: "unavailable",
          },
        ],
      },
      supplierIdentityA,
    );

    // Same response document is updated!
    assert.equal(updatedQuote.id, submittedResponse.id);
    assert.equal(updatedQuote.deliveryDays, 3);
    assert.equal(updatedQuote.shippingCost, 50000);

    // Recalculated totals:
    // Item 1: 410,000 * 10 = 4,100,000
    // Item 2: 48,000 * 20 = 960,000
    // Subtotal: 5,060,000
    // Estimated Total: 5,060,000 + 50,000 = 5,110,000
    assert.equal(updatedQuote.itemSubtotal, 5060000);
    assert.equal(updatedQuote.estimatedTotal, 5110000);

    // Audit preservation: respondedAt is preserved; updatedAt is renewed!
    assert.equal(updatedQuote.respondedAt, originalRespondedAt);
    assert.notEqual(updatedQuote.updatedAt, originalUpdatedAt);

    // -----------------------------------------------------------------------
    // TEST 30-32: Independence from SupplierOffer & Catalog Snapshots
    // -----------------------------------------------------------------------
    // Changing SupplierOffer.price in catalog must NOT alter existing SupplierResponse
    await TestSupplierOffer.updateOne(
      { _id: offerProduct1._id },
      { $set: { price: 999000, stock: 0 } },
    );

    const checkIndependenceResponse = await findSupplierResponseForSupplier(
      supplierA._id.toString(),
      supplierReqA._id.toString(),
    );
    assert.equal(checkIndependenceResponse?.items[0].unitPrice, 410000); // Intact!

    // Changing Product name in catalog must NOT mutate snapshot or response
    await TestProduct.updateOne(
      { _id: product1._id },
      { $set: { name: "قهوه تغییر یافته در کاتالوگ" } },
    );

    const snapshotCheckResponse = await findSupplierResponseForSupplier(
      supplierA._id.toString(),
      supplierReqA._id.toString(),
    );
    assert.equal(
      snapshotCheckResponse?.items[0].name,
      "دانه قهوه اسپرسو بلِند ۷۰/۳۰",
    );

    // -----------------------------------------------------------------------
    // TEST 18, 20, 24: Decline entire request & post-decline prevention
    // -----------------------------------------------------------------------
    // Create a new RFQ & pending SupplierRequest for Supplier B
    const rfq2 = await TestPurchaseRequest.create({
      cafeId: cafe._id,
      referenceNumber: "RFQ-TEST-QUOTE-02",
      createdByUserId: cafeUser._id,
      status: "submitted",
      items: [
        {
          _id: new Types.ObjectId(),
          itemType: "catalog",
          productId: product1._id,
          productSnapshot: { name: product1.name, unit: product1.unit },
          quantity: 5,
          allocations: [
            { shoppingListItemId: new Types.ObjectId(), quantity: 5 },
          ],
        },
      ],
    });

    const supplierReqB = await TestSupplierRequest.create({
      purchaseRequestId: rfq2._id,
      supplierId: supplierB._id,
      cafeId: cafe._id,
      status: "pending",
      items: [
        {
          _id: new Types.ObjectId(),
          purchaseRequestItemId: rfq2.items[0]._id,
          productId: product1._id,
          quantity: 5,
          productSnapshot: { name: product1.name, unit: product1.unit },
        },
      ],
    });

    // Supplier B declines the request
    const declineResult = await declineSupplierRequest(
      {
        supplierRequestId: supplierReqB._id.toString(),
        reason: "ظرفیت سفارش تکمیل است",
      },
      supplierIdentityB,
    );

    assert.equal(declineResult.status, "declined");
    assert.equal(declineResult.reason, "ظرفیت سفارش تکمیل است");

    const declinedReqDoc = await TestSupplierRequest.findById(supplierReqB._id).lean();
    assert.equal(declinedReqDoc.status, "declined");
    assert.equal(declinedReqDoc.declineReason, "ظرفیت سفارش تکمیل است");

    // Post-decline: quote submission must be rejected
    await assert.rejects(
      () =>
        submitSupplierResponse(
          {
            supplierRequestId: supplierReqB._id.toString(),
            deliveryDays: 1,
            shippingCost: 0,
            items: [
              {
                purchaseRequestItemId: rfq2.items[0]._id.toString(),
                status: "quoted",
                unitPrice: 400000,
                confirmedQuantity: 5,
              },
            ],
          },
          supplierIdentityB,
        ),
      (err) => err instanceof SupplierResponseInvalidStatusError,
    );

    // Post-decline: edit quote must be rejected
    await assert.rejects(
      () =>
        updateSupplierResponseService(
          {
            supplierRequestId: supplierReqB._id.toString(),
            deliveryDays: 1,
            shippingCost: 0,
            items: [
              {
                purchaseRequestItemId: rfq2.items[0]._id.toString(),
                status: "quoted",
                unitPrice: 400000,
                confirmedQuantity: 5,
              },
            ],
          },
          supplierIdentityB,
        ),
      (err) => err instanceof SupplierResponseInvalidStatusError,
    );

    // -----------------------------------------------------------------------
    // TEST 19, 22, 29: Cancelled RFQ & Cancellation Propagation
    // -----------------------------------------------------------------------
    // Cancel RFQ 1
    await cancelSupplierRequestsByPurchaseRequest(rfq._id.toString());
    await TestPurchaseRequest.updateOne(
      { _id: rfq._id },
      { $set: { status: "cancelled" } },
    );

    // Update on cancelled request/RFQ must be rejected
    await assert.rejects(
      () =>
        updateSupplierResponseService(
          {
            supplierRequestId: supplierReqA._id.toString(),
            deliveryDays: 2,
            shippingCost: 50000,
            items: [
              {
                purchaseRequestItemId: rfqItem1Id.toString(),
                status: "quoted",
                unitPrice: 400000,
                confirmedQuantity: 10,
              },
              {
                purchaseRequestItemId: rfqItem2Id.toString(),
                status: "unavailable",
              },
              {
                purchaseRequestItemId: rfqItem3Id.toString(),
                status: "unavailable",
              },
            ],
          },
          supplierIdentityA,
        ),
      (err) => err instanceof SupplierResponseInvalidStatusError,
    );

    // Decline on cancelled request must be rejected
    await assert.rejects(
      () =>
        declineSupplierRequest(
          { supplierRequestId: supplierReqA._id.toString() },
          supplierIdentityA,
        ),
      (err) => err instanceof SupplierResponseInvalidStatusError,
    );

    // -----------------------------------------------------------------------
    // TEST 33-37: Privacy, Scoping, and DTO JSON Serialization
    // -----------------------------------------------------------------------
    // 1. Supplier DTO: Supplier B cannot read Supplier A's quote
    const crossRead = await findSupplierResponseForSupplier(
      supplierB._id.toString(),
      supplierReqA._id.toString(),
    );
    assert.equal(crossRead, null);

    // 2. Cafe comparison batch query via service & repository:
    const rawDirectResponse = await findSupplierResponseBySupplierRequestId(
      supplierReqA._id.toString(),
    );
    assert.ok(rawDirectResponse);

    const cafeResponses = await findSupplierResponsesForCafeRFQ(
      cafe._id.toString(),
      rfq._id.toString(),
    );
    assert.equal(cafeResponses.length, 1);
    assert.equal(cafeResponses[0].supplierName, "شرکت بازرگانی قهوه زرین");

    const cafeResponsesViaService = await getSupplierResponsesForCafeRFQ(
      rfq._id.toString(),
      cafeIdentity,
    );
    assert.equal(cafeResponsesViaService.length, 1);
    assert.equal(cafeResponsesViaService[0].estimatedTotal, cafeResponses[0].estimatedTotal);

    // 3. Cafe DTO data boundary:
    // Does NOT contain owner personal data, phone, bank info, or shoppingList provenance
    const cafeDtoJson = JSON.stringify(cafeResponses[0]);
    assert.ok(!cafeDtoJson.includes("ownerUserId"));
    assert.ok(!cafeDtoJson.includes("phone"));
    assert.ok(!cafeDtoJson.includes("bank"));
    assert.ok(!cafeDtoJson.includes("shoppingListItemId"));
    assert.ok(!cafeDtoJson.includes("internalPurchaseRequest"));

    // 4. Supplier DTO data boundary:
    const supplierDto = await getSupplierResponseForSupplier(
      supplierReqA._id.toString(),
      supplierIdentityA,
    );
    const supplierDtoJson = JSON.stringify(supplierDto);
    assert.ok(!supplierDtoJson.includes("shoppingListItemId"));
    assert.ok(!supplierDtoJson.includes(supplierB._id.toString()));

    // 5. Serializable without throw
    assert.doesNotThrow(() => JSON.parse(cafeDtoJson));
    assert.doesNotThrow(() => JSON.parse(supplierDtoJson));
  } finally {
    if (conn) {
      await conn.close();
    }
    await mongoose.disconnect();
  }
});
