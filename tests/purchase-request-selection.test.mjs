import assert from "node:assert/strict";
import test from "node:test";
import mongoose, { Types } from "mongoose";

import { Cafe } from "../model/cafe.ts";
import { Category } from "../model/category.ts";
import { Product } from "../model/product.ts";
import { PurchaseRequest } from "../model/purchase-request.ts";
import { PurchaseRequestSelection } from "../model/purchase-request-selection.ts";
import { SupplierOffer } from "../model/supplier-offer.ts";
import { SupplierRequest } from "../model/supplier-request.ts";
import { SupplierResponse } from "../model/supplier-response.ts";
import { Supplier } from "../model/supplier.ts";
import { User } from "../model/user.ts";
import { canCompareSuppliers } from "../src/domain/cafe-access.ts";
import {
  calculateSelectionTotalsAndGroups,
  PurchaseRequestSelectionCalculationError,
  PurchaseRequestSelectionConflictError,
  PurchaseRequestSelectionInvariantError,
} from "../src/domain/purchase-request-selection-totals.ts";
import {
  savePurchaseRequestSelectionSchema,
  selectionItemInputSchema,
} from "../src/domain/schemas/purchase-request-selection.ts";
import {
  findComparisonDataBatch,
  findSelectionByPurchaseRequestId,
  saveSelectionInRepo,
} from "../src/repositories/purchase-request-selection-repository.ts";
import {
  getPurchaseRequestComparison,
  getPurchaseRequestSelection,
  PurchaseRequestSelectionInvalidStatusError,
  PurchaseRequestSelectionNotFoundError,
  PurchaseRequestSelectionPermissionError,
  PurchaseRequestSelectionValidationError,
  savePurchaseRequestSelection,
} from "../src/services/purchase-request-selection-service.ts";

// ---------------------------------------------------------------------------
// 1. Domain Unit Tests: Invariants, Schemas, Totals & Shipping Deduplication
// ---------------------------------------------------------------------------

test("selection validation: safe integer, positive, rejects float, negative, and zero quantities", () => {
  const validId = new Types.ObjectId().toString();

  // Valid positive integer
  assert.equal(
    selectionItemInputSchema.safeParse({
      purchaseRequestItemId: validId,
      supplierResponseId: validId,
      selectedQuantity: 5,
    }).success,
    true,
  );

  // Reject zero quantity (Test 16)
  assert.equal(
    selectionItemInputSchema.safeParse({
      purchaseRequestItemId: validId,
      supplierResponseId: validId,
      selectedQuantity: 0,
    }).success,
    false,
  );

  // Reject negative quantity (Test 17)
  assert.equal(
    selectionItemInputSchema.safeParse({
      purchaseRequestItemId: validId,
      supplierResponseId: validId,
      selectedQuantity: -3,
    }).success,
    false,
  );

  // Reject float quantity (Test 18)
  assert.equal(
    selectionItemInputSchema.safeParse({
      purchaseRequestItemId: validId,
      supplierResponseId: validId,
      selectedQuantity: 2.5,
    }).success,
    false,
  );

  // Reject unsafe integer
  assert.equal(
    selectionItemInputSchema.safeParse({
      purchaseRequestItemId: validId,
      supplierResponseId: validId,
      selectedQuantity: 9007199254740992,
    }).success,
    false,
  );
});

test("selection schema: client payload cannot inject prices or shipping", () => {
  const validId = new Types.ObjectId().toString();
  // Valid payload has only item references and quantity
  const parsed = savePurchaseRequestSelectionSchema.safeParse({
    purchaseRequestId: validId,
    expectedVersion: 1,
    items: [
      {
        purchaseRequestItemId: validId,
        supplierResponseId: validId,
        selectedQuantity: 10,
        // Injected fields should be stripped / not in schema definition
        unitPrice: 50,
        shippingCost: 0,
      },
    ],
  });

  assert.equal(parsed.success, true);
  // @ts-expect-error - unitPrice is not in schema
  assert.equal(parsed.data.items[0].unitPrice, undefined);
});

test("calculation helper: computes subtotals, deduplicates shipping, and calculates authoritative total", () => {
  const resp1Id = new Types.ObjectId().toString();
  const resp2Id = new Types.ObjectId().toString();

  const inputs = [
    // Item 1 from Supplier A (Resp 1)
    {
      purchaseRequestItemId: new Types.ObjectId().toString(),
      supplierRequestId: new Types.ObjectId().toString(),
      supplierResponseId: resp1Id,
      supplierId: new Types.ObjectId().toString(),
      supplierName: "تأمین‌کننده آلفا",
      selectedQuantity: 10,
      unitPrice: 100000,
      deliveryDays: 2,
      shippingCost: 20000,
      supplierResponseUpdatedAt: new Date(),
    },
    // Item 2 from Supplier A (Same Resp 1 -> shipping must NOT be added twice!)
    {
      purchaseRequestItemId: new Types.ObjectId().toString(),
      supplierRequestId: new Types.ObjectId().toString(),
      supplierResponseId: resp1Id,
      supplierId: new Types.ObjectId().toString(),
      supplierName: "تأمین‌کننده آلفا",
      selectedQuantity: 5,
      unitPrice: 50000,
      deliveryDays: 2,
      shippingCost: 20000,
      supplierResponseUpdatedAt: new Date(),
    },
    // Item 3 from Supplier B (Resp 2)
    {
      purchaseRequestItemId: new Types.ObjectId().toString(),
      supplierRequestId: new Types.ObjectId().toString(),
      supplierResponseId: resp2Id,
      supplierId: new Types.ObjectId().toString(),
      supplierName: "تأمین‌کننده بتا",
      selectedQuantity: 4,
      unitPrice: 40000,
      deliveryDays: 3,
      shippingCost: 10000,
      supplierResponseUpdatedAt: new Date(),
    },
  ];

  const result = calculateSelectionTotalsAndGroups(inputs, 3, 3, 0);

  // Subtotals:
  // Item 1: 10 * 100,000 = 1,000,000
  // Item 2: 5 * 50,000 = 250,000
  // Item 3: 4 * 40,000 = 160,000
  // Items Total = 1,000,000 + 250,000 + 160,000 = 1,410,000
  assert.equal(result.totals.estimatedItemsTotal, 1410000);

  // Shipping deduplication:
  // Resp 1 shipping = 20,000 (once)
  // Resp 2 shipping = 10,000 (once)
  // Shipping Total = 30,000
  assert.equal(result.totals.shippingTotal, 30000);

  // Estimated Total = 1,410,000 + 30,000 = 1,440,000
  assert.equal(result.totals.estimatedTotal, 1440000);

  // Supplier Groups check
  assert.equal(result.supplierGroups.length, 2);
  const groupA = result.supplierGroups.find((g) => g.supplierResponseId === resp1Id);
  assert.ok(groupA);
  assert.equal(groupA.itemsSubtotal, 1250000);
  assert.equal(groupA.shippingCost, 20000);
  assert.equal(groupA.supplierTotal, 1270000);
  assert.equal(groupA.deliveryDays, 2);

  const groupB = result.supplierGroups.find((g) => g.supplierResponseId === resp2Id);
  assert.ok(groupB);
  assert.equal(groupB.itemsSubtotal, 160000);
  assert.equal(groupB.shippingCost, 10000);
  assert.equal(groupB.supplierTotal, 170000);
});

test("calculation helper: rejects arithmetic overflow beyond Number.MAX_SAFE_INTEGER", () => {
  const inputs = [
    {
      purchaseRequestItemId: new Types.ObjectId().toString(),
      supplierRequestId: new Types.ObjectId().toString(),
      supplierResponseId: new Types.ObjectId().toString(),
      supplierId: new Types.ObjectId().toString(),
      supplierName: "تأمین‌کننده",
      selectedQuantity: 2,
      unitPrice: Number.MAX_SAFE_INTEGER,
      deliveryDays: 1,
      shippingCost: 5000,
      supplierResponseUpdatedAt: new Date(),
    },
  ];

  assert.throws(
    () => calculateSelectionTotalsAndGroups(inputs, 1, 1, 0),
    (err) => err instanceof PurchaseRequestSelectionCalculationError,
  );
});

test("calculation helper: handles empty selection with 0 totals and all items unselected", () => {
  const result = calculateSelectionTotalsAndGroups([], 5, 0, 0);
  assert.equal(result.items.length, 0);
  assert.equal(result.supplierGroups.length, 0);
  assert.equal(result.totals.selectedItemCount, 0);
  assert.equal(result.totals.fullySelectedItemCount, 0);
  assert.equal(result.totals.partiallySelectedItemCount, 0);
  assert.equal(result.totals.unselectedItemCount, 5);
  assert.equal(result.totals.estimatedItemsTotal, 0);
  assert.equal(result.totals.shippingTotal, 0);
  assert.equal(result.totals.estimatedTotal, 0);
});

test("calculation helper: rejects negative or zero unitPrice", () => {
  const baseInput = {
    purchaseRequestItemId: new Types.ObjectId().toString(),
    supplierRequestId: new Types.ObjectId().toString(),
    supplierResponseId: new Types.ObjectId().toString(),
    supplierId: new Types.ObjectId().toString(),
    supplierName: "تأمین‌کننده",
    selectedQuantity: 2,
    deliveryDays: 1,
    shippingCost: 5000,
    supplierResponseUpdatedAt: new Date(),
  };

  // Zero unitPrice rejected
  assert.throws(
    () =>
      calculateSelectionTotalsAndGroups(
        [{ ...baseInput, unitPrice: 0 }],
        1,
        1,
        0,
      ),
    (err) => err instanceof PurchaseRequestSelectionCalculationError,
  );

  // Negative unitPrice rejected
  assert.throws(
    () =>
      calculateSelectionTotalsAndGroups(
        [{ ...baseInput, unitPrice: -5000 }],
        1,
        1,
        0,
      ),
    (err) => err instanceof PurchaseRequestSelectionCalculationError,
  );

  // Float unitPrice rejected
  assert.throws(
    () =>
      calculateSelectionTotalsAndGroups(
        [{ ...baseInput, unitPrice: 1000.5 }],
        1,
        1,
        0,
      ),
    (err) => err instanceof PurchaseRequestSelectionCalculationError,
  );
});

test("permissions: canCompareSuppliers grants owner, manager, purchase_manager and explicit permission", () => {
  assert.equal(canCompareSuppliers({ role: "owner" }), true);
  assert.equal(canCompareSuppliers({ role: "manager" }), true);
  assert.equal(canCompareSuppliers({ role: "purchase_manager" }), true);

  // Denied by default
  assert.equal(canCompareSuppliers({ role: "chef" }), false);
  assert.equal(canCompareSuppliers({ role: "employee" }), false);
  assert.equal(canCompareSuppliers({ role: "accountant" }), false);

  // Explicit true
  assert.equal(
    canCompareSuppliers({
      role: "chef",
      permissions: { canCompareSuppliers: true },
    }),
    true,
  );

  // Explicit false
  assert.equal(
    canCompareSuppliers({
      role: "manager",
      permissions: { canCompareSuppliers: false },
    }),
    false,
  );
});

// ---------------------------------------------------------------------------
// 2. Database Integration Tests: Comparison & Selection Workflow
// ---------------------------------------------------------------------------

const TEST_DB_URI =
  process.env.TEST_MONGODB_URI ||
  "mongodb://127.0.0.1:27017/sefaresh_test_runner_selection";
process.env.MONGODB_URI = TEST_DB_URI;

test("database: Cafe RFQ Comparison, Item Selection, Split Quantity, Snapshots & Concurrency", async () => {
  let conn;
  try {
    conn = await mongoose.createConnection(TEST_DB_URI).asPromise();
  } catch {
    return; // Skip if local test database is unreachable
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
    const TestPurchaseRequestSelection = conn.model(
      "PurchaseRequestSelection",
      PurchaseRequestSelection.schema,
    );

    // Clean up
    await TestCafe.deleteMany({});
    await TestUser.deleteMany({});
    await TestCategory.deleteMany({});
    await TestProduct.deleteMany({});
    await TestSupplier.deleteMany({});
    await TestSupplierOffer.deleteMany({});
    await TestPurchaseRequest.deleteMany({});
    await TestSupplierRequest.deleteMany({});
    await TestSupplierResponse.deleteMany({});
    await TestPurchaseRequestSelection.deleteMany({});
    try {
      await TestPurchaseRequestSelection.collection.dropIndexes();
    } catch {
      // Ignore if collection doesn't exist yet
    }
    await TestPurchaseRequestSelection.syncIndexes();

    // 1. Seed Cafe, Users, Products
    const cafeUserA = await TestUser.create({
      firstName: "مدیر",
      lastName: "کافه یک",
      status: "active",
    });
    const cafeA = await TestCafe.create({
      name: "کافه بهشت",
      slug: "cafe-behesht",
      status: "active",
      ownerUserId: cafeUserA._id,
    });

    const cafeUserB = await TestUser.create({
      firstName: "مدیر",
      lastName: "کافه دو",
      status: "active",
    });
    const cafeB = await TestCafe.create({
      name: "کافه نارون",
      slug: "cafe-narvan",
      status: "active",
      ownerUserId: cafeUserB._id,
    });

    const identityA = {
      userId: cafeUserA._id.toString(),
      cafeId: cafeA._id.toString(),
      role: "owner",
    };

    const identityB = {
      userId: cafeUserB._id.toString(),
      cafeId: cafeB._id.toString(),
      role: "owner",
    };

    const category = await TestCategory.create({
      name: "دانه قهوه",
      slug: "coffee-beans",
      status: "active",
    });

    const product1 = await TestProduct.create({
      name: "دانه قهوه اتیوپی",
      slug: "ethiopia-coffee",
      categoryId: category._id,
      unit: "کیلوگرم",
      brand: "بن‌مانو",
      status: "active",
    });

    const product2 = await TestProduct.create({
      name: "شیر پرچرب",
      slug: "whole-milk",
      categoryId: category._id,
      unit: "بطری ۱ لیتری",
      brand: "کاله",
      status: "active",
    });

    // 2. Seed Suppliers
    const supplierUser1 = await TestUser.create({
      firstName: "علی",
      lastName: "تأمین‌کننده ۱",
      status: "active",
    });
    const supplier1 = await TestSupplier.create({
      businessName: "بازرگانی قهوه پارس",
      status: "active",
      isVerified: true,
      ownerUserId: supplierUser1._id,
    });

    const supplierUser2 = await TestUser.create({
      firstName: "رضا",
      lastName: "تأمین‌کننده ۲",
      status: "active",
    });
    const supplier2 = await TestSupplier.create({
      businessName: "پخش عمده البرز",
      status: "active",
      isVerified: true,
      ownerUserId: supplierUser2._id,
    });

    // 3. Create RFQ for Cafe A with 3 items:
    // Item 1: Catalog Coffee (qty: 20)
    // Item 2: Catalog Milk (qty: 10)
    // Item 3: Custom Item (qty: 5)
    const item1Id = new Types.ObjectId();
    const item2Id = new Types.ObjectId();
    const item3Id = new Types.ObjectId();

    const rfqA = await TestPurchaseRequest.create({
      cafeId: cafeA._id,
      referenceNumber: "RFQ-2610-TEST1",
      createdByUserId: cafeUserA._id,
      status: "submitted",
      items: [
        {
          _id: item1Id,
          itemType: "catalog",
          productId: product1._id,
          productSnapshot: { name: product1.name, unit: product1.unit },
          quantity: 20,
          allocations: [{ shoppingListItemId: new Types.ObjectId(), quantity: 20 }],
        },
        {
          _id: item2Id,
          itemType: "catalog",
          productId: product2._id,
          productSnapshot: { name: product2.name, unit: product2.unit },
          quantity: 10,
          allocations: [{ shoppingListItemId: new Types.ObjectId(), quantity: 10 }],
        },
        {
          _id: item3Id,
          itemType: "custom",
          customTitle: "شیرینی خانگی مخصوص",
          customUnit: "بسته",
          quantity: 5,
          allocations: [{ shoppingListItemId: new Types.ObjectId(), quantity: 5 }],
        },
      ],
    });

    // 4. Create SupplierRequests for Supplier 1 and Supplier 2
    const suppReq1 = await TestSupplierRequest.create({
      purchaseRequestId: rfqA._id,
      supplierId: supplier1._id,
      cafeId: cafeA._id,
      status: "responded",
      items: [
        {
          purchaseRequestItemId: item1Id,
          productId: product1._id,
          quantity: 20,
          productSnapshot: { name: product1.name, unit: product1.unit },
        },
        {
          purchaseRequestItemId: item2Id,
          productId: product2._id,
          quantity: 10,
          productSnapshot: { name: product2.name, unit: product2.unit },
        },
      ],
    });

    const suppReq2 = await TestSupplierRequest.create({
      purchaseRequestId: rfqA._id,
      supplierId: supplier2._id,
      cafeId: cafeA._id,
      status: "responded",
      items: [
        {
          purchaseRequestItemId: item1Id,
          productId: product1._id,
          quantity: 20,
          productSnapshot: { name: product1.name, unit: product1.unit },
        },
        {
          purchaseRequestItemId: item2Id,
          productId: product2._id,
          quantity: 10,
          productSnapshot: { name: product2.name, unit: product2.unit },
        },
      ],
    });

    // Supplier 1 Response:
    // Coffee: quoted, 150,000 T, confirmedQty: 12 (Partial)
    // Milk: quoted, 60,000 T, confirmedQty: 10
    // Shipping: 25,000, Delivery: 2 days
    const suppResp1 = await TestSupplierResponse.create({
      supplierRequestId: suppReq1._id,
      purchaseRequestId: rfqA._id,
      supplierId: supplier1._id,
      cafeId: cafeA._id,
      respondedByUserId: supplierUser1._id,
      deliveryDays: 2,
      shippingCost: 25000,
      itemSubtotal: 12 * 150000 + 10 * 60000,
      estimatedTotal: 12 * 150000 + 10 * 60000 + 25000,
      items: [
        {
          purchaseRequestItemId: item1Id,
          productId: product1._id,
          status: "quoted",
          unitPrice: 150000,
          confirmedQuantity: 12,
          itemSubtotal: 1800000,
        },
        {
          purchaseRequestItemId: item2Id,
          productId: product2._id,
          status: "quoted",
          unitPrice: 60000,
          confirmedQuantity: 10,
          itemSubtotal: 600000,
        },
      ],
    });

    // Supplier 2 Response:
    // Coffee: quoted, 160,000 T, confirmedQty: 20
    // Milk: unavailable
    // Shipping: 15,000, Delivery: 1 day
    const suppResp2 = await TestSupplierResponse.create({
      supplierRequestId: suppReq2._id,
      purchaseRequestId: rfqA._id,
      supplierId: supplier2._id,
      cafeId: cafeA._id,
      respondedByUserId: supplierUser2._id,
      deliveryDays: 1,
      shippingCost: 15000,
      itemSubtotal: 20 * 160000,
      estimatedTotal: 20 * 160000 + 15000,
      items: [
        {
          purchaseRequestItemId: item1Id,
          productId: product1._id,
          status: "quoted",
          unitPrice: 160000,
          confirmedQuantity: 20,
          itemSubtotal: 3200000,
        },
        {
          purchaseRequestItemId: item2Id,
          productId: product2._id,
          status: "unavailable",
          confirmedQuantity: 0,
          itemSubtotal: 0,
        },
      ],
    });

    // -----------------------------------------------------------------------
    // Test 1: Cafe A can view comparison of its own RFQ
    // -----------------------------------------------------------------------
    const comparison = await getPurchaseRequestComparison(
      rfqA._id.toString(),
      identityA,
    );
    assert.equal(comparison.purchaseRequestId, rfqA._id.toString());
    assert.equal(comparison.referenceNumber, "RFQ-2610-TEST1");
    assert.equal(comparison.items.length, 3);

    // Test 2: Cafe B cannot view comparison of Cafe A's RFQ
    await assert.rejects(
      () => getPurchaseRequestComparison(rfqA._id.toString(), identityB),
      (err) => err instanceof PurchaseRequestSelectionNotFoundError,
    );

    // Test 3 & 45: Supplier private data does not leak (no phone, no email, no nationalId)
    const jsonStr = JSON.stringify(comparison);
    assert.equal(jsonStr.includes("ownerUserId"), false);
    assert.equal(jsonStr.includes("nationalId"), false);
    assert.equal(jsonStr.includes("phone"), false);

    // Test 4 & 5: All RFQ items returned including custom item with responses: []
    const customItemComp = comparison.items.find(
      (it) => it.purchaseRequestItemId === item3Id.toString(),
    );
    assert.ok(customItemComp);
    assert.equal(customItemComp.title, "شیرینی خانگی مخصوص");
    assert.equal(customItemComp.responses.length, 0);

    // Test 6: quoted option correctly mapped
    const coffeeComp = comparison.items.find(
      (it) => it.purchaseRequestItemId === item1Id.toString(),
    );
    assert.ok(coffeeComp);
    assert.equal(coffeeComp.responses.length, 2);
    assert.equal(coffeeComp.lowestUnitPrice, 150000);

    // Test 7: unavailable item distinguishable
    const milkComp = comparison.items.find(
      (it) => it.purchaseRequestItemId === item2Id.toString(),
    );
    assert.ok(milkComp);
    const unavailOption = milkComp.responses.find(
      (r) => r.supplierId === supplier2._id.toString(),
    );
    assert.ok(unavailOption);
    assert.equal(unavailOption.status, "unavailable");
    assert.equal(unavailOption.isSelectable, false);

    // Test 10: DTO is fully serializable
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(comparison)));

    // -----------------------------------------------------------------------
    // Test 13: Split quantity selection between Supplier 1 and Supplier 2
    // Requested: 20
    // Supplier 1 -> 12 (at 150,000)
    // Supplier 2 -> 8 (at 160,000)
    // -----------------------------------------------------------------------
    const splitSelectionResult = await savePurchaseRequestSelection(
      {
        purchaseRequestId: rfqA._id.toString(),
        items: [
          {
            purchaseRequestItemId: item1Id.toString(),
            supplierResponseId: suppResp1._id.toString(),
            selectedQuantity: 12,
          },
          {
            purchaseRequestItemId: item1Id.toString(),
            supplierResponseId: suppResp2._id.toString(),
            selectedQuantity: 8,
          },
          // And select milk from Supplier 1: 10 (at 60,000)
          {
            purchaseRequestItemId: item2Id.toString(),
            supplierResponseId: suppResp1._id.toString(),
            selectedQuantity: 10,
          },
        ],
      },
      identityA,
    );

    assert.equal(splitSelectionResult.version, 1);
    assert.equal(splitSelectionResult.fullySelectedItemCount, 2);
    assert.equal(splitSelectionResult.unselectedItemCount, 1); // Custom item not selected

    // Verify calculated totals:
    // Coffee: (12 * 150,000 = 1,800,000) + (8 * 160,000 = 1,280,000) = 3,080,000
    // Milk: (10 * 60,000 = 600,000)
    // Items Total: 3,680,000
    // Shipping: Supplier 1 (25,000 - once!) + Supplier 2 (15,000) = 40,000
    // Estimated Total: 3,720,000
    assert.equal(splitSelectionResult.estimatedItemsTotal, 3680000);
    assert.equal(splitSelectionResult.shippingTotal, 40000);
    assert.equal(splitSelectionResult.estimatedTotal, 3720000);

    // -----------------------------------------------------------------------
    // Test 14: sum(selectedQuantity) > requestedQuantity rejected
    // -----------------------------------------------------------------------
    await assert.rejects(
      () =>
        savePurchaseRequestSelection(
          {
            purchaseRequestId: rfqA._id.toString(),
            items: [
              {
                purchaseRequestItemId: item1Id.toString(),
                supplierResponseId: suppResp1._id.toString(),
                selectedQuantity: 12,
              },
              {
                purchaseRequestItemId: item1Id.toString(),
                supplierResponseId: suppResp2._id.toString(),
                selectedQuantity: 10, // 12 + 10 = 22 > 20!
              },
            ],
          },
          identityA,
        ),
      (err) => err instanceof PurchaseRequestSelectionInvariantError,
    );

    // -----------------------------------------------------------------------
    // Test 15: selectedQuantity > confirmedQuantity rejected
    // Supplier 1 confirmed only 12 for coffee; requesting 13 should fail
    // -----------------------------------------------------------------------
    await assert.rejects(
      () =>
        savePurchaseRequestSelection(
          {
            purchaseRequestId: rfqA._id.toString(),
            items: [
              {
                purchaseRequestItemId: item1Id.toString(),
                supplierResponseId: suppResp1._id.toString(),
                selectedQuantity: 13,
              },
            ],
          },
          identityA,
        ),
      (err) => err instanceof PurchaseRequestSelectionInvariantError,
    );

    // -----------------------------------------------------------------------
    // Test 19: Selecting unavailable item rejected
    // Supplier 2 marked milk as unavailable
    // -----------------------------------------------------------------------
    await assert.rejects(
      () =>
        savePurchaseRequestSelection(
          {
            purchaseRequestId: rfqA._id.toString(),
            items: [
              {
                purchaseRequestItemId: item2Id.toString(),
                supplierResponseId: suppResp2._id.toString(),
                selectedQuantity: 5,
              },
            ],
          },
          identityA,
        ),
      (err) => err instanceof PurchaseRequestSelectionValidationError,
    );

    // -----------------------------------------------------------------------
    // Test 20: Response belonging to another RFQ rejected
    // -----------------------------------------------------------------------
    const otherRfq = await TestPurchaseRequest.create({
      cafeId: cafeA._id,
      referenceNumber: "RFQ-OTHER-1",
      createdByUserId: cafeUserA._id,
      status: "submitted",
      items: [
        {
          _id: new Types.ObjectId(),
          itemType: "catalog",
          productId: product1._id,
          quantity: 5,
          allocations: [{ shoppingListItemId: new Types.ObjectId(), quantity: 5 }],
        },
      ],
    });

    await assert.rejects(
      () =>
        savePurchaseRequestSelection(
          {
            purchaseRequestId: otherRfq._id.toString(),
            items: [
              {
                purchaseRequestItemId: otherRfq.items[0]._id.toString(),
                supplierResponseId: suppResp1._id.toString(), // Belongs to rfqA!
                selectedQuantity: 5,
              },
            ],
          },
          identityA,
        ),
      (err) => err instanceof PurchaseRequestSelectionValidationError,
    );

    // -----------------------------------------------------------------------
    // Test 28, 29, 30: Save again replaces previous state & increments version
    // -----------------------------------------------------------------------
    const secondSaveResult = await savePurchaseRequestSelection(
      {
        purchaseRequestId: rfqA._id.toString(),
        expectedVersion: 1, // Concurrency check
        items: [
          // Change Coffee to Supplier 2 only (qty: 20)
          {
            purchaseRequestItemId: item1Id.toString(),
            supplierResponseId: suppResp2._id.toString(),
            selectedQuantity: 20,
          },
        ],
      },
      identityA,
    );

    assert.equal(secondSaveResult.version, 2);
    // Coffee 20 * 160,000 = 3,200,000 + 15,000 shipping = 3,215,000
    assert.equal(secondSaveResult.estimatedItemsTotal, 3200000);
    assert.equal(secondSaveResult.shippingTotal, 15000);
    assert.equal(secondSaveResult.estimatedTotal, 3215000);

    // Verify only 1 selection document exists in DB for this RFQ (No duplicate)
    const selectionDocs = await TestPurchaseRequestSelection.find({
      purchaseRequestId: rfqA._id,
    });
    assert.equal(selectionDocs.length, 1);

    // -----------------------------------------------------------------------
    // Test 31 & 32: Stale expectedVersion returns conflict error
    // -----------------------------------------------------------------------
    await assert.rejects(
      () =>
        savePurchaseRequestSelection(
          {
            purchaseRequestId: rfqA._id.toString(),
            expectedVersion: 1, // Current version is 2! Stale!
            items: [],
          },
          identityA,
        ),
      (err) => err instanceof PurchaseRequestSelectionConflictError,
    );

    // -----------------------------------------------------------------------
    // Test 33 & 34: Supplier edit after selection does NOT alter selection snapshot
    // and is detectable in DTO
    // -----------------------------------------------------------------------
    // Supplier 2 updates its quote to 190,000 after selection
    await new Promise((res) => setTimeout(res, 50)); // Ensure distinct timestamp
    const futureDate = new Date(Date.now() + 5000);
    await TestSupplierResponse.updateOne(
      { _id: suppResp2._id },
      {
        $set: {
          "items.0.unitPrice": 190000,
          updatedAt: futureDate,
        },
      },
    );

    // Fetch selection
    const fetchedSelection = await getPurchaseRequestSelection(
      rfqA._id.toString(),
      identityA,
    );
    assert.ok(fetchedSelection);
    assert.equal(fetchedSelection.version, 2);
    // Snapshot unit price is STILL 160,000, NOT 190,000!
    assert.equal(fetchedSelection.items[0].selections[0].unitPrice, 160000);
    // Flag detects that supplier modified the quote after selection
    assert.equal(
      fetchedSelection.items[0].selections[0].responseModifiedAfterSelection,
      true,
    );

    // Comparison view also shows this
    const compAfterSupplierEdit = await getPurchaseRequestComparison(
      rfqA._id.toString(),
      identityA,
    );
    const supp2Option = compAfterSupplierEdit.items[0].responses.find(
      (r) => r.supplierId === supplier2._id.toString(),
    );
    assert.equal(supp2Option?.isModifiedAfterSelection, true);

    // -----------------------------------------------------------------------
    // Test 35: Editing SupplierOffer does not alter selection snapshot
    // -----------------------------------------------------------------------
    await TestSupplierOffer.create({
      supplierId: supplier2._id,
      productId: product1._id,
      price: 250000,
      stock: 100,
      minOrderQuantity: 1,
      status: "active",
    });
    const selAfterOfferEdit = await getPurchaseRequestSelection(
      rfqA._id.toString(),
      identityA,
    );
    assert.equal(selAfterOfferEdit?.items[0].selections[0].unitPrice, 160000);

    // -----------------------------------------------------------------------
    // Test 36: Editing Product does not alter selection snapshot
    // -----------------------------------------------------------------------
    await TestProduct.updateOne({ _id: product1._id }, { $set: { name: "قهوه تغییر یافته" } });
    const selAfterProductEdit = await getPurchaseRequestSelection(
      rfqA._id.toString(),
      identityA,
    );
    assert.equal(selAfterProductEdit?.items[0].selections[0].unitPrice, 160000);

    // -----------------------------------------------------------------------
    // Test 38: RFQ in cancelled status cannot be selected
    // -----------------------------------------------------------------------
    const cancelledRfq = await TestPurchaseRequest.create({
      cafeId: cafeA._id,
      referenceNumber: "RFQ-CANCELLED-1",
      createdByUserId: cafeUserA._id,
      status: "cancelled",
      items: [
        {
          _id: new Types.ObjectId(),
          itemType: "catalog",
          productId: product1._id,
          quantity: 5,
          allocations: [{ shoppingListItemId: new Types.ObjectId(), quantity: 5 }],
        },
      ],
    });

    await assert.rejects(
      () =>
        savePurchaseRequestSelection(
          {
            purchaseRequestId: cancelledRfq._id.toString(),
            items: [],
          },
          identityA,
        ),
      (err) => err instanceof PurchaseRequestSelectionInvalidStatusError,
    );

    // -----------------------------------------------------------------------
    // Test 40: Selection with 0 items (clearing/empty selection) is allowed
    // -----------------------------------------------------------------------
    const clearResult = await savePurchaseRequestSelection(
      {
        purchaseRequestId: rfqA._id.toString(),
        expectedVersion: 2,
        items: [],
      },
      identityA,
    );
    assert.equal(clearResult.version, 3);
    assert.equal(clearResult.selectedItemCount, 0);
    assert.equal(clearResult.estimatedTotal, 0);

    // -----------------------------------------------------------------------
    // Test 41: Historical selection is preserved when RFQ cancelled later
    // -----------------------------------------------------------------------
    await TestPurchaseRequest.updateOne(
      { _id: rfqA._id },
      { $set: { status: "cancelled" } },
    );
    const historicalSelection = await getPurchaseRequestSelection(
      rfqA._id.toString(),
      identityA,
    );
    assert.ok(historicalSelection);
    assert.equal(historicalSelection.version, 3);

    // -----------------------------------------------------------------------
    // Test 42: Cafe A cannot select Cafe B's responses
    // -----------------------------------------------------------------------
    // Create RFQ for Cafe B
    const rfqB = await TestPurchaseRequest.create({
      cafeId: cafeB._id,
      referenceNumber: "RFQ-CAFEB-1",
      createdByUserId: cafeUserB._id,
      status: "submitted",
      items: [
        {
          _id: new Types.ObjectId(),
          itemType: "catalog",
          productId: product1._id,
          quantity: 10,
          allocations: [{ shoppingListItemId: new Types.ObjectId(), quantity: 10 }],
        },
      ],
    });

    // Cafe B attempts to select Cafe A's SupplierResponse
    await assert.rejects(
      () =>
        savePurchaseRequestSelection(
          {
            purchaseRequestId: rfqB._id.toString(),
            items: [
              {
                purchaseRequestItemId: rfqB.items[0]._id.toString(),
                supplierResponseId: suppResp1._id.toString(), // Belongs to Cafe A!
                selectedQuantity: 5,
              },
            ],
          },
          identityB,
        ),
      (err) => err instanceof PurchaseRequestSelectionValidationError,
    );

    // -----------------------------------------------------------------------
    // Test 43: User without permission (chef without canCompareSuppliers) cannot save
    // -----------------------------------------------------------------------
    const unauthorizedIdentity = {
      userId: new Types.ObjectId().toString(),
      cafeId: cafeA._id.toString(),
      role: "chef",
    };

    await assert.rejects(
      () =>
        savePurchaseRequestSelection(
          {
            purchaseRequestId: rfqA._id.toString(),
            items: [],
          },
          unauthorizedIdentity,
        ),
      (err) => err instanceof PurchaseRequestSelectionPermissionError,
    );
  } finally {
    if (conn) {
      await conn.close();
    }
    await mongoose.disconnect();
  }
});
