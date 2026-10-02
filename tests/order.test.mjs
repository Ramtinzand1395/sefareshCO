import assert from "node:assert/strict";
import test from "node:test";
import mongoose, { Types } from "mongoose";

import { Cafe } from "../model/cafe.ts";
import { Category } from "../model/category.ts";
import { Order } from "../model/order.ts";
import { Product } from "../model/product.ts";
import { PurchaseRequest } from "../model/purchase-request.ts";
import { PurchaseRequestSelection } from "../model/purchase-request-selection.ts";
import { SupplierOffer } from "../model/supplier-offer.ts";
import { SupplierRequest } from "../model/supplier-request.ts";
import { SupplierResponse } from "../model/supplier-response.ts";
import { Supplier } from "../model/supplier.ts";
import { User } from "../model/user.ts";
import {
  canCancelCafeOrder,
  canCreateOrder,
  canViewCafeOrders,
} from "../src/domain/cafe-access.ts";
import {
  calculateOrderTotals,
  canTransitionOrderStatus,
  generateOrderNumber,
  getCafeOrderAllowedActions,
  getSupplierOrderAllowedActions,
  OrderCalculationError,
} from "../src/domain/order.ts";
import {
  cancelCafeOrderSchema,
  createOrdersFromSelectionSchema,
  markSupplierOrderShippedSchema,
  orderEntityIdSchema,
  orderQuerySchema,
  rejectSupplierOrderSchema,
} from "../src/domain/schemas/order.ts";
import {
  canManageSupplierOrders,
  canViewSupplierOrders,
} from "../src/domain/supplier-access.ts";
import {
  savePurchaseRequestSelection,
} from "../src/services/purchase-request-selection-service.ts";
import {
  cancelCafeOrder,
  confirmSupplierOrder,
  createOrdersFromPurchaseRequestSelection,
  getCafeOrder,
  getSupplierOrder,
  listCafeOrders,
  listSupplierOrders,
  markSupplierOrderDelivered,
  markSupplierOrderPreparing,
  markSupplierOrderShipped,
  OrderInsufficientStockError,
  OrderInvalidStatusError,
  OrderNotFoundError,
  OrderStaleResponseError,
  OrderValidationError,
  rejectSupplierOrder,
} from "../src/services/order-service.ts";

// ---------------------------------------------------------------------------
// 1. Domain Unit Tests: Schemas, Status Transitions, Allowed Actions, Calculations
// ---------------------------------------------------------------------------

test("order schema validation: ObjectId and schema bounds", () => {
  const validId = new Types.ObjectId().toString();

  assert.equal(orderEntityIdSchema.safeParse(validId).success, true);
  assert.equal(orderEntityIdSchema.safeParse("invalid-id").success, false);

  assert.equal(
    createOrdersFromSelectionSchema.safeParse({ purchaseRequestId: validId }).success,
    true,
  );
  assert.equal(
    createOrdersFromSelectionSchema.safeParse({ purchaseRequestId: "not-hex" }).success,
    false,
  );

  // Cancellation schema
  assert.equal(
    cancelCafeOrderSchema.safeParse({ orderId: validId, cancelReason: "دلیل موجه" }).success,
    true,
  );
  assert.equal(
    cancelCafeOrderSchema.safeParse({
      orderId: validId,
      cancelReason: "a".repeat(501),
    }).success,
    false,
  );

  // Rejection schema
  assert.equal(
    rejectSupplierOrderSchema.safeParse({ orderId: validId, rejectReason: "عدم موجودی" }).success,
    true,
  );
  assert.equal(
    rejectSupplierOrderSchema.safeParse({
      orderId: validId,
      rejectReason: "a".repeat(501),
    }).success,
    false,
  );

  // Shipped schema
  assert.equal(
    markSupplierOrderShippedSchema.safeParse({
      orderId: validId,
      shippingNote: "کد پیگیری پست: 123456",
    }).success,
    true,
  );

  // Query schema defaults
  const parsedQuery = orderQuerySchema.parse({});
  assert.equal(parsedQuery.page, 1);
  assert.equal(parsedQuery.pageSize, 20);
  assert.equal(parsedQuery.status, undefined);
});

test("lifecycle transitions: pure domain guard enforces strictly valid transitions", () => {
  // Cafe transitions
  assert.equal(canTransitionOrderStatus("placed", "cancelled", "cafe"), true);
  assert.equal(canTransitionOrderStatus("confirmed", "cancelled", "cafe"), false);
  assert.equal(canTransitionOrderStatus("preparing", "cancelled", "cafe"), false);
  assert.equal(canTransitionOrderStatus("shipped", "cancelled", "cafe"), false);
  assert.equal(canTransitionOrderStatus("delivered", "cancelled", "cafe"), false);
  assert.equal(canTransitionOrderStatus("placed", "confirmed", "cafe"), false);

  // Supplier transitions
  assert.equal(canTransitionOrderStatus("placed", "confirmed", "supplier"), true);
  assert.equal(canTransitionOrderStatus("placed", "rejected", "supplier"), true);
  assert.equal(canTransitionOrderStatus("confirmed", "preparing", "supplier"), true);
  assert.equal(canTransitionOrderStatus("preparing", "shipped", "supplier"), true);
  assert.equal(canTransitionOrderStatus("shipped", "delivered", "supplier"), true);

  // Supplier forbidden backward or jump transitions
  assert.equal(canTransitionOrderStatus("placed", "preparing", "supplier"), false);
  assert.equal(canTransitionOrderStatus("placed", "shipped", "supplier"), false);
  assert.equal(canTransitionOrderStatus("confirmed", "delivered", "supplier"), false);
  assert.equal(canTransitionOrderStatus("preparing", "confirmed", "supplier"), false);
  assert.equal(canTransitionOrderStatus("shipped", "preparing", "supplier"), false);

  // Terminal states cannot transition to anything
  assert.equal(canTransitionOrderStatus("delivered", "shipped", "supplier"), false);
  assert.equal(canTransitionOrderStatus("cancelled", "placed", "cafe"), false);
  assert.equal(canTransitionOrderStatus("rejected", "confirmed", "supplier"), false);

  // Idempotent transitions
  assert.equal(canTransitionOrderStatus("placed", "placed", "cafe"), true);
  assert.equal(canTransitionOrderStatus("confirmed", "confirmed", "supplier"), true);
});

test("allowed actions: matches current order status accurately", () => {
  // Cafe actions
  assert.deepEqual(getCafeOrderAllowedActions("placed"), { canCancel: true });
  assert.deepEqual(getCafeOrderAllowedActions("confirmed"), { canCancel: false });
  assert.deepEqual(getCafeOrderAllowedActions("shipped"), { canCancel: false });
  assert.deepEqual(getCafeOrderAllowedActions("delivered"), { canCancel: false });
  assert.deepEqual(getCafeOrderAllowedActions("cancelled"), { canCancel: false });
  assert.deepEqual(getCafeOrderAllowedActions("rejected"), { canCancel: false });

  // Supplier actions
  assert.deepEqual(getSupplierOrderAllowedActions("placed"), {
    canConfirm: true,
    canReject: true,
    canMarkPreparing: false,
    canMarkShipped: false,
    canMarkDelivered: false,
  });

  assert.deepEqual(getSupplierOrderAllowedActions("confirmed"), {
    canConfirm: false,
    canReject: false,
    canMarkPreparing: true,
    canMarkShipped: false,
    canMarkDelivered: false,
  });

  assert.deepEqual(getSupplierOrderAllowedActions("preparing"), {
    canConfirm: false,
    canReject: false,
    canMarkPreparing: false,
    canMarkShipped: true,
    canMarkDelivered: false,
  });

  assert.deepEqual(getSupplierOrderAllowedActions("shipped"), {
    canConfirm: false,
    canReject: false,
    canMarkPreparing: false,
    canMarkShipped: false,
    canMarkDelivered: true,
  });

  assert.deepEqual(getSupplierOrderAllowedActions("delivered"), {
    canConfirm: false,
    canReject: false,
    canMarkPreparing: false,
    canMarkShipped: false,
    canMarkDelivered: false,
  });
});

test("calculation helper: computes subtotals, safe integer money, and rejects overflow", () => {
  const result = calculateOrderTotals(
    [
      { quantity: 2, unitPrice: 150000 },
      { quantity: 5, unitPrice: 20000 },
    ],
    25000,
  );

  assert.equal(result.itemsSubtotal, 400000);
  assert.equal(result.shippingCost, 25000);
  assert.equal(result.totalAmount, 425000);

  // Reject negative shipping
  assert.throws(
    () => calculateOrderTotals([{ quantity: 1, unitPrice: 100 }], -50),
    OrderCalculationError,
  );

  // Reject float quantity
  assert.throws(
    () => calculateOrderTotals([{ quantity: 2.5, unitPrice: 100 }], 0),
    OrderCalculationError,
  );

  // Reject overflow beyond MAX_SAFE_INTEGER
  assert.throws(
    () =>
      calculateOrderTotals(
        [{ quantity: 1000000, unitPrice: Number.MAX_SAFE_INTEGER }],
        0,
      ),
    OrderCalculationError,
  );
});

test("reference number: generates ORD-YYMM-XXXXX format with collision resistance", () => {
  const ref1 = generateOrderNumber();
  const ref2 = generateOrderNumber();

  assert.match(ref1, /^ORD-\d{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/);
  assert.match(ref2, /^ORD-\d{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/);
  assert.notEqual(ref1, ref2);
});

test("permissions: cafe and supplier order access rules", () => {
  const cafeOwner = { role: "owner" };
  const cafeManager = { role: "manager" };
  const cafeChef = { role: "chef" };
  const cafeChefWithPermission = {
    role: "chef",
    permissions: { canCreateOrder: true },
  };
  const cafeManagerRevoked = {
    role: "manager",
    permissions: { canCreateOrder: false },
  };

  assert.equal(canCreateOrder(cafeOwner), true);
  assert.equal(canCreateOrder(cafeManager), true);
  assert.equal(canCreateOrder(cafeChef), false);
  assert.equal(canCreateOrder(cafeChefWithPermission), true);
  assert.equal(canCreateOrder(cafeManagerRevoked), false);

  assert.equal(canViewCafeOrders(cafeChef), true);
  assert.equal(
    canViewCafeOrders({ role: "employee", permissions: { canViewOrders: false } }),
    false,
  );

  const userId = new Types.ObjectId().toString();
  assert.equal(
    canCancelCafeOrder(
      { userId, role: "employee" },
      { createdByUserId: userId, status: "placed" },
    ),
    true,
  );
  assert.equal(
    canCancelCafeOrder(
      { userId, role: "employee" },
      { createdByUserId: "other-user", status: "placed" },
    ),
    false,
  );
  assert.equal(
    canCancelCafeOrder(
      { userId, role: "owner" },
      { createdByUserId: "other-user", status: "confirmed" },
    ),
    false, // Order must be in placed status
  );

  // Supplier permissions
  const supplierOwner = { role: "owner" };
  const supplierSales = { role: "sales" };
  const supplierAccountant = { role: "accountant" };
  const supplierAccountantWithPerm = {
    role: "accountant",
    permissions: { canUpdateOrders: true },
  };

  assert.equal(canViewSupplierOrders(supplierOwner), true);
  assert.equal(canViewSupplierOrders(supplierSales), true);
  assert.equal(canViewSupplierOrders(supplierAccountant), false);

  assert.equal(canManageSupplierOrders(supplierOwner), true);
  assert.equal(canManageSupplierOrders(supplierSales), true);
  assert.equal(canManageSupplierOrders(supplierAccountant), false);
  assert.equal(canManageSupplierOrders(supplierAccountantWithPerm), true);
});

// ---------------------------------------------------------------------------
// 2. Database Integration Tests: Complete Lifecycle, Snapshots, Stock, Idempotency
// ---------------------------------------------------------------------------

const TEST_DB_URI =
  process.env.TEST_MONGODB_URI ||
  "mongodb://127.0.0.1:27017/sefaresh_test_runner_order";
process.env.MONGODB_URI = TEST_DB_URI;

test("database: Order creation, 1 per supplier, snapshots, stock decrements, idempotency, stale response & transitions", async () => {
  let conn;
  try {
    conn = await mongoose.createConnection(TEST_DB_URI).asPromise();
  } catch {
    return; // Skip if local mongodb is unreachable
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
    const TestSupplierResponse = conn.model(
      "SupplierResponse",
      SupplierResponse.schema,
    );
    const TestPurchaseRequestSelection = conn.model(
      "PurchaseRequestSelection",
      PurchaseRequestSelection.schema,
    );
    const TestOrder = conn.model("Order", Order.schema);

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
    await TestOrder.deleteMany({});

    // 1. Create Users
    const cafeUser = await TestUser.create({
      mobile: "09121111111",
      firstName: "مدیر",
      lastName: "کافه",
      status: "active",
    });

    const supplier1User = await TestUser.create({
      mobile: "09122222222",
      firstName: "مدیر",
      lastName: "تأمین‌کننده یک",
      status: "active",
    });

    const supplier2User = await TestUser.create({
      mobile: "09123333333",
      firstName: "مدیر",
      lastName: "تأمین‌کننده دو",
      status: "active",
    });

    // 2. Create Cafe & Suppliers
    const cafe = await TestCafe.create({
      ownerUserId: cafeUser._id,
      name: "کافه نمونه",
      status: "active",
    });

    const supplierA = await TestSupplier.create({
      ownerUserId: supplier1User._id,
      businessName: "شرکت پخش قهوه آریا",
      status: "active",
      isVerified: true,
    });

    const supplierB = await TestSupplier.create({
      ownerUserId: supplier2User._id,
      businessName: "بازرگانی شیر و لبنیات پارس",
      status: "active",
      isVerified: true,
    });

    const cafeIdentity = {
      userId: cafeUser._id.toString(),
      cafeId: cafe._id.toString(),
      role: "owner",
    };

    const supplierAIdentity = {
      userId: supplier1User._id.toString(),
      supplierId: supplierA._id.toString(),
      role: "owner",
    };

    const supplierBIdentity = {
      userId: supplier2User._id.toString(),
      supplierId: supplierB._id.toString(),
      role: "owner",
    };

    // 3. Create Products & Offers
    const category = await TestCategory.create({
      name: "مواد اولیه",
      slug: "raw-materials",
      status: "active",
    });

    const productCoffee = await TestProduct.create({
      name: "دانه قهوه اسپرسو ۱ کیلوگرمی",
      slug: "espresso-coffee-1kg",
      unit: "بسته",
      brand: "آریا",
      categoryId: category._id,
      status: "active",
    });

    const productMilk = await TestProduct.create({
      name: "شیر پرچرب ۱ لیتری",
      slug: "whole-milk-1l",
      unit: "پاکت",
      brand: "پارس",
      categoryId: category._id,
      status: "active",
    });

    const offerCoffee = await TestSupplierOffer.create({
      supplierId: supplierA._id,
      productId: productCoffee._id,
      price: 250000,
      stock: 50,
      minOrderQuantity: 1,
      deliveryDays: 2,
      status: "active",
    });

    const offerMilk = await TestSupplierOffer.create({
      supplierId: supplierB._id,
      productId: productMilk._id,
      price: 35000,
      stock: 100,
      minOrderQuantity: 1,
      deliveryDays: 1,
      status: "active",
    });

    // 4. Create RFQ (PurchaseRequest) with 3 items (Coffee, Milk, and a custom item)
    const rfqItemIdCoffee = new Types.ObjectId();
    const rfqItemIdMilk = new Types.ObjectId();
    const rfqItemIdCustom = new Types.ObjectId();

    const rfq = await TestPurchaseRequest.create({
      cafeId: cafe._id,
      referenceNumber: "RFQ-2610-TEST1",
      createdByUserId: cafeUser._id,
      status: "submitted",
      items: [
        {
          _id: rfqItemIdCoffee,
          itemType: "catalog",
          productId: productCoffee._id,
          productSnapshot: {
            name: productCoffee.name,
            unit: productCoffee.unit,
            brand: productCoffee.brand,
          },
          quantity: 10,
          allocations: [{ shoppingListItemId: new Types.ObjectId(), quantity: 10 }],
        },
        {
          _id: rfqItemIdMilk,
          itemType: "catalog",
          productId: productMilk._id,
          productSnapshot: {
            name: productMilk.name,
            unit: productMilk.unit,
            brand: productMilk.brand,
          },
          quantity: 20,
          allocations: [{ shoppingListItemId: new Types.ObjectId(), quantity: 20 }],
        },
        {
          _id: rfqItemIdCustom,
          itemType: "custom",
          customTitle: "شربت زعفران دست‌ساز",
          customUnit: "شیشه",
          quantity: 5,
          allocations: [{ shoppingListItemId: new Types.ObjectId(), quantity: 5 }],
        },
      ],
    });

    // 5. Create SupplierRequests & SupplierResponses
    // Supplier A Request & Response (Coffee)
    const supplierRequestA = await TestSupplierRequest.create({
      purchaseRequestId: rfq._id,
      supplierId: supplierA._id,
      cafeId: cafe._id,
      status: "responded",
      items: [
        {
          purchaseRequestItemId: rfqItemIdCoffee,
          productId: productCoffee._id,
          matchedSupplierOfferId: offerCoffee._id,
          quantity: 10,
          productSnapshot: {
            name: productCoffee.name,
            unit: productCoffee.unit,
            brand: productCoffee.brand,
          },
        },
      ],
    });

    const responseA = await TestSupplierResponse.create({
      supplierRequestId: supplierRequestA._id,
      purchaseRequestId: rfq._id,
      supplierId: supplierA._id,
      cafeId: cafe._id,
      respondedByUserId: supplier1User._id,
      deliveryDays: 2,
      shippingCost: 30000,
      itemSubtotal: 2500000,
      estimatedTotal: 2530000,
      items: [
        {
          purchaseRequestItemId: rfqItemIdCoffee,
          productId: productCoffee._id,
          status: "quoted",
          unitPrice: 250000,
          confirmedQuantity: 10,
          itemSubtotal: 2500000,
        },
      ],
      respondedAt: new Date(Date.now() - 60000),
      updatedAt: new Date(Date.now() - 60000),
    });

    // Supplier B Request & Response (Milk)
    const supplierRequestB = await TestSupplierRequest.create({
      purchaseRequestId: rfq._id,
      supplierId: supplierB._id,
      cafeId: cafe._id,
      status: "responded",
      items: [
        {
          purchaseRequestItemId: rfqItemIdMilk,
          productId: productMilk._id,
          matchedSupplierOfferId: offerMilk._id,
          quantity: 20,
          productSnapshot: {
            name: productMilk.name,
            unit: productMilk.unit,
            brand: productMilk.brand,
          },
        },
      ],
    });

    const responseB = await TestSupplierResponse.create({
      supplierRequestId: supplierRequestB._id,
      purchaseRequestId: rfq._id,
      supplierId: supplierB._id,
      cafeId: cafe._id,
      respondedByUserId: supplier2User._id,
      deliveryDays: 1,
      shippingCost: 20000,
      itemSubtotal: 700000,
      estimatedTotal: 720000,
      items: [
        {
          purchaseRequestItemId: rfqItemIdMilk,
          productId: productMilk._id,
          status: "quoted",
          unitPrice: 35000,
          confirmedQuantity: 20,
          itemSubtotal: 700000,
        },
      ],
      respondedAt: new Date(Date.now() - 60000),
      updatedAt: new Date(Date.now() - 60000),
    });

    // 6. Test: Empty Selection Reject (Test 6)
    await assert.rejects(
      async () => {
        await createOrdersFromPurchaseRequestSelection(
          { purchaseRequestId: rfq._id.toString() },
          cafeIdentity,
        );
      },
      (err) => err instanceof OrderValidationError,
    );

    // 7. Save Valid Partial Selection (Select Coffee from A and Milk from B; custom item remains unselected)
    const saveSelResult = await savePurchaseRequestSelection(
      {
        purchaseRequestId: rfq._id.toString(),
        items: [
          {
            purchaseRequestItemId: rfqItemIdCoffee.toString(),
            supplierResponseId: responseA._id.toString(),
            selectedQuantity: 10,
          },
          {
            purchaseRequestItemId: rfqItemIdMilk.toString(),
            supplierResponseId: responseB._id.toString(),
            selectedQuantity: 15, // Partial quantity: 15 out of 20
          },
        ],
      },
      cafeIdentity,
    );

    assert.equal(saveSelResult.selectedItemCount, 2);

    // 8. Test: Stale Response Check (Section 18, Tests 13-14)
    // If supplier updates response after selection, Order creation must be rejected!
    await TestSupplierResponse.updateOne(
      { _id: responseA._id },
      { $set: { updatedAt: new Date(Date.now() + 10000) } },
    );

    await assert.rejects(
      async () => {
        await createOrdersFromPurchaseRequestSelection(
          { purchaseRequestId: rfq._id.toString() },
          cafeIdentity,
        );
      },
      (err) => err instanceof OrderStaleResponseError,
    );

    // Re-save selection after response change (re-confirm by cafe)
    await savePurchaseRequestSelection(
      {
        purchaseRequestId: rfq._id.toString(),
        expectedVersion: saveSelResult.version,
        items: [
          {
            purchaseRequestItemId: rfqItemIdCoffee.toString(),
            supplierResponseId: responseA._id.toString(),
            selectedQuantity: 10,
          },
          {
            purchaseRequestItemId: rfqItemIdMilk.toString(),
            supplierResponseId: responseB._id.toString(),
            selectedQuantity: 15,
          },
        ],
      },
      cafeIdentity,
    );

    // 9. Test: Insufficient Stock Rejection (Section 31 & Tests 21-22)
    // Reduce Coffee stock to 5 (less than requested 10)
    await TestSupplierOffer.updateOne({ _id: offerCoffee._id }, { $set: { stock: 5 } });

    await assert.rejects(
      async () => {
        await createOrdersFromPurchaseRequestSelection(
          { purchaseRequestId: rfq._id.toString() },
          cafeIdentity,
        );
      },
      (err) => err instanceof OrderInsufficientStockError,
    );

    // Verify Milk stock was NOT decremented because pre-check failed atomically
    const milkOfferBefore = await TestSupplierOffer.findById(offerMilk._id);
    assert.equal(milkOfferBefore.stock, 100);

    // Restore Coffee stock to 50
    await TestSupplierOffer.updateOne({ _id: offerCoffee._id }, { $set: { stock: 50 } });

    // 10. Test: Successful Order Creation (Tests 1, 2, 3, 4, 5, 7, 8, 9, 10, 24)
    const creationResult = await createOrdersFromPurchaseRequestSelection(
      { purchaseRequestId: rfq._id.toString() },
      cafeIdentity,
    );

    // Invariant: Two suppliers -> exactly two orders
    assert.equal(creationResult.orderCount, 2);
    assert.equal(creationResult.orders.length, 2);

    const orderSummaryA = creationResult.orders.find(
      (o) => o.supplierId === supplierA._id.toString(),
    );
    const orderSummaryB = creationResult.orders.find(
      (o) => o.supplierId === supplierB._id.toString(),
    );

    assert.ok(orderSummaryA);
    assert.ok(orderSummaryB);

    // Check Order A amounts: Coffee (10 * 250000 = 2500000) + Shipping (30000) = 2530000
    assert.equal(orderSummaryA.totalAmount, 2530000);
    assert.equal(orderSummaryA.deliveryDays, 2);
    assert.equal(orderSummaryA.status, "placed");

    // Check Order B amounts: Milk (15 * 35000 = 525000) + Shipping (20000) = 545000
    assert.equal(orderSummaryB.totalAmount, 545000);
    assert.equal(orderSummaryB.deliveryDays, 1);
    assert.equal(orderSummaryB.status, "placed");

    // Verify Stock Decrements:
    // Coffee: 50 - 10 = 40
    // Milk: 100 - 15 = 85
    const updatedOfferCoffee = await TestSupplierOffer.findById(offerCoffee._id);
    const updatedOfferMilk = await TestSupplierOffer.findById(offerMilk._id);
    assert.equal(updatedOfferCoffee.stock, 40);
    assert.equal(updatedOfferMilk.stock, 85);

    // 11. Test: Idempotency & Retry Safety (Tests 15, 17, 18, 19, 50)
    // Calling createOrders again must return the exact same orders without duplicate orders or stock decrements
    const retryResult = await createOrdersFromPurchaseRequestSelection(
      { purchaseRequestId: rfq._id.toString() },
      cafeIdentity,
    );

    assert.equal(retryResult.orderCount, 2);
    assert.equal(retryResult.orders[0].orderId, creationResult.orders[0].orderId);

    const recheckedOfferCoffee = await TestSupplierOffer.findById(offerCoffee._id);
    const recheckedOfferMilk = await TestSupplierOffer.findById(offerMilk._id);
    assert.equal(recheckedOfferCoffee.stock, 40); // NOT decremented again!
    assert.equal(recheckedOfferMilk.stock, 85);

    // 12. Test: Selection Finalization & Immutability (Tests 48, 49)
    // Trying to save/edit the selection after orders are placed must fail
    await assert.rejects(
      async () => {
        await savePurchaseRequestSelection(
          {
            purchaseRequestId: rfq._id.toString(),
            items: [],
          },
          cafeIdentity,
        );
      },
      (err) => err instanceof OrderInvalidStatusError || err.name === "PurchaseRequestSelectionInvalidStatusError",
    );

    // 13. Test: Independence of Order Snapshot from subsequent modifications (Tests 11, 12)
    // If Product title or SupplierResponse price is modified later, Order snapshot remains intact!
    await TestProduct.updateOne(
      { _id: productCoffee._id },
      { $set: { name: "قهوه تغییر یافته به یک کالای دیگر" } },
    );
    await TestSupplierResponse.updateOne(
      { _id: responseA._id },
      { $set: { "items.0.unitPrice": 999999 } },
    );

    const cafeOrderADetail = await getCafeOrder(
      orderSummaryA.orderId,
      cafeIdentity,
    );
    assert.equal(cafeOrderADetail.items[0].title, "دانه قهوه اسپرسو ۱ کیلوگرمی");
    assert.equal(cafeOrderADetail.items[0].unitPrice, 250000);
    assert.equal(cafeOrderADetail.financials.totalAmount, 2530000);

    // 14. Test: Tenant Isolation & Authorization (Tests 38, 39, 40, 41)
    // Other Cafe cannot view Order A
    const otherCafe = await TestCafe.create({
      ownerUserId: new Types.ObjectId(),
      name: "کافه دیگر",
      status: "active",
    });
    const otherCafeIdentity = {
      userId: new Types.ObjectId().toString(),
      cafeId: otherCafe._id.toString(),
      role: "owner",
    };

    await assert.rejects(
      async () => {
        await getCafeOrder(orderSummaryA.orderId, otherCafeIdentity);
      },
      (err) => err instanceof OrderNotFoundError,
    );

    // Supplier A can view Order A, but Supplier B cannot view Order A
    const suppOrderADetail = await getSupplierOrder(
      orderSummaryA.orderId,
      supplierAIdentity,
    );
    assert.equal(suppOrderADetail.id, orderSummaryA.orderId);
    assert.equal(suppOrderADetail.allowedActions.canConfirm, true);

    await assert.rejects(
      async () => {
        await getSupplierOrder(orderSummaryA.orderId, supplierBIdentity);
      },
      (err) => err instanceof OrderNotFoundError,
    );

    // 15. Test: DTO Privacy (Tests 44, 45, 46)
    // Verify JSON serializability and absence of internal fields
    const serializedCafeDTO = JSON.parse(JSON.stringify(cafeOrderADetail));
    assert.equal(serializedCafeDTO.supplier.businessName, "شرکت پخش قهوه آریا");
    assert.equal(serializedCafeDTO.supplier.ownerUserId, undefined);

    const serializedSupplierDTO = JSON.parse(JSON.stringify(suppOrderADetail));
    assert.equal(serializedSupplierDTO.cafe.businessName, "کافه نمونه");
    assert.equal(serializedSupplierDTO.cafe.ownerUserId, undefined);

    // 16. Test: Cafe Order Cancellation & Stock Restore (Tests 36, 37)
    // Cancel Order B from Cafe (placed -> cancelled)
    const cancelledOrderB = await cancelCafeOrder(
      { orderId: orderSummaryB.orderId, cancelReason: "تغییر برنامه هفتگی" },
      cafeIdentity,
    );
    assert.equal(cancelledOrderB.status, "cancelled");
    assert.equal(cancelledOrderB.cancellation.cancelReason, "تغییر برنامه هفتگی");

    // Stock for Milk must be restored (85 + 15 = 100)
    const restoredOfferMilk = await TestSupplierOffer.findById(offerMilk._id);
    assert.equal(restoredOfferMilk.stock, 100);

    // 17. Test: Supplier Order Transitions (Tests 27, 28, 29, 30, 31, 32, 33, 34, 35)
    // Supplier A confirms Order A: placed -> confirmed
    const confirmedOrderA = await confirmSupplierOrder(
      orderSummaryA.orderId,
      supplierAIdentity,
    );
    assert.equal(confirmedOrderA.status, "confirmed");
    assert.ok(confirmedOrderA.timeline.confirmedAt);

    // Cafe can no longer cancel confirmed Order A
    await assert.rejects(
      async () => {
        await cancelCafeOrder(
          { orderId: orderSummaryA.orderId },
          cafeIdentity,
        );
      },
      (err) => err instanceof OrderInvalidStatusError,
    );

    // Supplier A advances: confirmed -> preparing
    const preparingOrderA = await markSupplierOrderPreparing(
      orderSummaryA.orderId,
      supplierAIdentity,
    );
    assert.equal(preparingOrderA.status, "preparing");
    assert.ok(preparingOrderA.timeline.preparingAt);

    // Supplier A advances: preparing -> shipped
    const shippedOrderA = await markSupplierOrderShipped(
      {
        orderId: orderSummaryA.orderId,
        shippingNote: "ارسال شد با پیک ویژه",
      },
      supplierAIdentity,
    );
    assert.equal(shippedOrderA.status, "shipped");
    assert.equal(shippedOrderA.delivery.shippingNote, "ارسال شد با پیک ویژه");
    assert.ok(shippedOrderA.timeline.shippedAt);

    // Supplier A advances: shipped -> delivered
    const deliveredOrderA = await markSupplierOrderDelivered(
      orderSummaryA.orderId,
      supplierAIdentity,
    );
    assert.equal(deliveredOrderA.status, "delivered");
    assert.ok(deliveredOrderA.timeline.deliveredAt);

    // Delivered is terminal: cannot transition
    await assert.rejects(
      async () => {
        await markSupplierOrderPreparing(
          orderSummaryA.orderId,
          supplierAIdentity,
        );
      },
      (err) => err instanceof OrderInvalidStatusError,
    );

    // 18. Test: List Cafe Orders & Supplier Orders (Pagination)
    const cafeOrdersList = await listCafeOrders({}, cafeIdentity);
    assert.equal(cafeOrdersList.total, 2);
    assert.equal(cafeOrdersList.items.length, 2);

    const supplierAOrdersList = await listSupplierOrders({}, supplierAIdentity);
    assert.equal(supplierAOrdersList.total, 1);
    assert.equal(supplierAOrdersList.items[0].id, orderSummaryA.orderId);

    // 19. Test: Supplier Rejection and Stock Restore (Test 28)
    // Create a new RFQ and single order to test Supplier rejection
    const singleOffer = await TestSupplierOffer.create({
      supplierId: supplierA._id,
      productId: productMilk._id,
      price: 36000,
      stock: 20,
      minOrderQuantity: 1,
      deliveryDays: 1,
      status: "active",
    });

    const rfq2 = await TestPurchaseRequest.create({
      cafeId: cafe._id,
      referenceNumber: "RFQ-2610-TEST2",
      createdByUserId: cafeUser._id,
      status: "submitted",
      items: [
        {
          itemType: "catalog",
          productId: productMilk._id,
          productSnapshot: {
            name: productMilk.name,
            unit: productMilk.unit,
          },
          quantity: 5,
          allocations: [{ shoppingListItemId: new Types.ObjectId(), quantity: 5 }],
        },
      ],
    });

    const sr2 = await TestSupplierRequest.create({
      purchaseRequestId: rfq2._id,
      supplierId: supplierA._id,
      cafeId: cafe._id,
      status: "responded",
      items: [
        {
          purchaseRequestItemId: rfq2.items[0]._id,
          productId: productMilk._id,
          matchedSupplierOfferId: singleOffer._id,
          quantity: 5,
          productSnapshot: {
            name: productMilk.name,
            unit: productMilk.unit,
          },
        },
      ],
    });

    const resp2 = await TestSupplierResponse.create({
      supplierRequestId: sr2._id,
      purchaseRequestId: rfq2._id,
      supplierId: supplierA._id,
      cafeId: cafe._id,
      respondedByUserId: supplier1User._id,
      deliveryDays: 1,
      shippingCost: 10000,
      itemSubtotal: 180000,
      estimatedTotal: 190000,
      items: [
        {
          purchaseRequestItemId: rfq2.items[0]._id,
          productId: productMilk._id,
          status: "quoted",
          unitPrice: 36000,
          confirmedQuantity: 5,
          itemSubtotal: 180000,
        },
      ],
      respondedAt: new Date(),
    });

    await savePurchaseRequestSelection(
      {
        purchaseRequestId: rfq2._id.toString(),
        items: [
          {
            purchaseRequestItemId: rfq2.items[0]._id.toString(),
            supplierResponseId: resp2._id.toString(),
            selectedQuantity: 5,
          },
        ],
      },
      cafeIdentity,
    );

    const order2Result = await createOrdersFromPurchaseRequestSelection(
      { purchaseRequestId: rfq2._id.toString() },
      cafeIdentity,
    );

    // Stock decremented from 20 to 15
    const offerAfterOrder = await TestSupplierOffer.findById(singleOffer._id);
    assert.equal(offerAfterOrder.stock, 15);

    // Supplier A rejects: placed -> rejected
    const rejectedOrder = await rejectSupplierOrder(
      {
        orderId: order2Result.orders[0].orderId,
        rejectReason: "عدم امکان ارسال به موقع",
      },
      supplierAIdentity,
    );
    assert.equal(rejectedOrder.status, "rejected");
    assert.equal(rejectedOrder.rejection.rejectReason, "عدم امکان ارسال به موقع");

    // Stock restored back from 15 to 20
    const offerAfterReject = await TestSupplierOffer.findById(singleOffer._id);
    assert.equal(offerAfterReject.stock, 20);

    // 20. Test: RFQ cancellation does not delete historical orders (Test 51)
    await TestPurchaseRequest.updateOne(
      { _id: rfq._id },
      { $set: { status: "cancelled" } },
    );
    const existingHistoricalOrder = await TestOrder.findById(orderSummaryA.orderId);
    assert.ok(existingHistoricalOrder);
    assert.equal(existingHistoricalOrder.status, "delivered");
  } catch (err) {
    console.error("TEST FAILED WITH ERROR:", err);
    throw err;
  } finally {
    if (conn) {
      await conn.close();
    }
    await mongoose.disconnect();
  }
});
