import assert from "node:assert/strict";
import test from "node:test";
import mongoose, { Types } from "mongoose";

import { Cafe } from "../model/cafe.ts";
import { Order } from "../model/order.ts";
import { Payment } from "../model/payment.ts";
import { Supplier } from "../model/supplier.ts";
import { SupplierPayable } from "../model/supplier-payable.ts";
import { SupplierSettlement } from "../model/supplier-settlement.ts";
import { Transaction } from "../model/transaction.ts";
import { User } from "../model/user.ts";
import {
  canInitiateCafePayment,
  canViewCafePayments,
} from "../src/domain/cafe-access.ts";
import {
  deriveOrderPaymentStatus,
  generatePaymentReference,
  generateSettlementNumber,
  generateTransactionNumber,
  isOrderPayable,
  PAYABLE_ORDER_STATUSES,
} from "../src/domain/finance.ts";
import {
  adminPaymentQuerySchema,
  adminSettlementQuerySchema,
  createPaymentAttemptSchema,
  createSettlementSchema,
  financeEntityIdSchema,
  markPaymentFailedInternalSchema,
  markPaymentPaidInternalSchema,
  supplierPayableQuerySchema,
} from "../src/domain/schemas/finance.ts";
import { canViewSupplierFinancials } from "../src/domain/supplier-access.ts";
import {
  createOrderPaymentAttempt,
  createSupplierSettlement,
  FinanceAuthError,
  FinanceInvalidStatusError,
  FinanceNotFoundError,
  FinanceValidationError,
  getAdminFinanceOverview,
  getAdminSettlementCandidates,
  getCafeOrderPayment,
  getSupplierFinanceOverview,
  listAdminPayments,
  listAdminSettlements,
  listSupplierPayables,
  listSupplierSettlements,
  markPaymentFailedInternal,
  markPaymentPaidInternal,
  syncPayableOnOrderDelivered,
} from "../src/services/finance-service.ts";

// ---------------------------------------------------------------------------
// 1. Pure Domain Unit Tests: Schemas, Reference Generators, Lifecycle & Derivations
// ---------------------------------------------------------------------------

test("finance schema validation: ObjectId, strings, and bounds", () => {
  const validId = new Types.ObjectId().toString();

  assert.equal(financeEntityIdSchema.safeParse(validId).success, true);
  assert.equal(financeEntityIdSchema.safeParse("invalid-id").success, false);

  // createPaymentAttemptSchema
  assert.equal(
    createPaymentAttemptSchema.safeParse({
      orderId: validId,
      idempotencyKey: "key-12345",
    }).success,
    true,
  );
  assert.equal(
    createPaymentAttemptSchema.safeParse({
      orderId: "invalid",
      idempotencyKey: "key-12345",
    }).success,
    false,
  );
  assert.equal(
    createPaymentAttemptSchema.safeParse({
      orderId: validId,
      idempotencyKey: "",
    }).success,
    false,
  );

  // markPaymentPaidInternalSchema
  assert.equal(
    markPaymentPaidInternalSchema.safeParse({
      paymentId: validId,
      providerReference: "REF-9999",
    }).success,
    true,
  );

  // markPaymentFailedInternalSchema
  assert.equal(
    markPaymentFailedInternalSchema.safeParse({
      paymentId: validId,
      failureCode: "ERR_TIMEOUT",
      failureMessage: "Bank gateway unreachable",
    }).success,
    true,
  );

  // createSettlementSchema
  assert.equal(
    createSettlementSchema.safeParse({
      supplierId: validId,
      payableIds: [validId],
      note: "Weekly settlement",
    }).success,
    true,
  );
  assert.equal(
    createSettlementSchema.safeParse({
      supplierId: validId,
      payableIds: [],
    }).success,
    false,
  );

  // query schemas
  assert.equal(
    supplierPayableQuerySchema.safeParse({ page: "2", pageSize: "10" }).success,
    true,
  );
  assert.equal(
    adminPaymentQuerySchema.safeParse({ page: 1, pageSize: 20 }).success,
    true,
  );
  assert.equal(
    adminSettlementQuerySchema.safeParse({ page: 1, pageSize: 20 }).success,
    true,
  );
});

test("reference number generators: correct prefix and format", () => {
  const payRef = generatePaymentReference();
  assert.match(payRef, /^PAY-\d{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/);

  const txnNum = generateTransactionNumber();
  assert.match(txnNum, /^TXN-\d{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/);

  const stlNum = generateSettlementNumber();
  assert.match(stlNum, /^STL-\d{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/);
});

test("payable order status policy: rejects placed, cancelled, rejected; allows confirmed, preparing, shipped, delivered", () => {
  assert.equal(isOrderPayable("placed"), false);
  assert.equal(isOrderPayable("cancelled"), false);
  assert.equal(isOrderPayable("rejected"), false);

  assert.equal(isOrderPayable("confirmed"), true);
  assert.equal(isOrderPayable("preparing"), true);
  assert.equal(isOrderPayable("shipped"), true);
  assert.equal(isOrderPayable("delivered"), true);

  assert.deepEqual(PAYABLE_ORDER_STATUSES, [
    "confirmed",
    "preparing",
    "shipped",
    "delivered",
  ]);
});

test("derived order payment status: paid, pending, failed, unpaid", () => {
  // Empty or no payments -> unpaid
  assert.equal(deriveOrderPaymentStatus([]), "unpaid");

  // Single paid -> paid
  assert.equal(deriveOrderPaymentStatus([{ status: "paid" }]), "paid");

  // Failed followed by paid -> paid
  assert.equal(
    deriveOrderPaymentStatus([{ status: "paid" }, { status: "failed" }]),
    "paid",
  );

  // Pending attempt -> pending
  assert.equal(deriveOrderPaymentStatus([{ status: "pending" }]), "pending");

  // Failed attempts only -> failed
  assert.equal(
    deriveOrderPaymentStatus([{ status: "failed" }, { status: "failed" }]),
    "failed",
  );

  // Cancelled attempts only -> unpaid
  assert.equal(deriveOrderPaymentStatus([{ status: "cancelled" }]), "unpaid");
});

test("role and permission checks for finance: Cafe, Supplier, and Admin", () => {
  // Cafe View Payments
  assert.equal(canViewCafePayments({ role: "owner" }), true);
  assert.equal(canViewCafePayments({ role: "manager" }), true);
  assert.equal(canViewCafePayments({ role: "accountant" }), true);
  assert.equal(canViewCafePayments({ role: "employee" }), true);
  assert.equal(
    canViewCafePayments({
      role: "employee",
      permissions: { canViewCosts: false },
    }),
    false,
  );

  // Cafe Initiate Payment
  assert.equal(canInitiateCafePayment({ role: "owner" }), true);
  assert.equal(canInitiateCafePayment({ role: "manager" }), true);
  assert.equal(canInitiateCafePayment({ role: "purchase_manager" }), true);
  assert.equal(canInitiateCafePayment({ role: "accountant" }), true);
  assert.equal(canInitiateCafePayment({ role: "chef" }), false);
  assert.equal(
    canInitiateCafePayment({
      role: "chef",
      permissions: { canInitiatePayment: true },
    }),
    true,
  );
  assert.equal(
    canInitiateCafePayment({
      role: "manager",
      permissions: { canInitiatePayment: false },
    }),
    false,
  );

  // Supplier View Financials
  assert.equal(canViewSupplierFinancials({ role: "owner" }), true);
  assert.equal(canViewSupplierFinancials({ role: "manager" }), true);
  assert.equal(canViewSupplierFinancials({ role: "accountant" }), true);
  assert.equal(canViewSupplierFinancials({ role: "sales" }), true);
  assert.equal(canViewSupplierFinancials({ role: "warehouse" }), false);
  assert.equal(canViewSupplierFinancials({ role: "employee" }), false);
  assert.equal(
    canViewSupplierFinancials({
      role: "warehouse",
      permissions: { canViewFinancials: true },
    }),
    true,
  );
  assert.equal(
    canViewSupplierFinancials({
      role: "manager",
      permissions: { canViewFinancials: false },
    }),
    false,
  );
});

// ---------------------------------------------------------------------------
// 2. Database Integration Tests: Complete Finance Lifecycle, Concurrency, & Idempotency
// ---------------------------------------------------------------------------

const TEST_DB_URI =
  process.env.TEST_MONGODB_URI ||
  "mongodb://127.0.0.1:27017/sefaresh_test_runner_finance";
process.env.MONGODB_URI = TEST_DB_URI;

test("database: Payment, Immutable Transaction Ledger, Supplier Payable, Settlement & Read Models", async () => {
  let conn;
  try {
    conn = await mongoose.createConnection(TEST_DB_URI).asPromise();
  } catch {
    return; // Skip if local mongodb is unreachable
  }

  try {
    const TestCafe = conn.model("Cafe", Cafe.schema);
    const TestUser = conn.model("User", User.schema);
    const TestSupplier = conn.model("Supplier", Supplier.schema);
    const TestOrder = conn.model("Order", Order.schema);
    const TestPayment = conn.model("Payment", Payment.schema);
    const TestTransaction = conn.model("Transaction", Transaction.schema);
    const TestSupplierPayable = conn.model(
      "SupplierPayable",
      SupplierPayable.schema,
    );
    const TestSupplierSettlement = conn.model(
      "SupplierSettlement",
      SupplierSettlement.schema,
    );

    // Clean up
    await TestCafe.deleteMany({});
    await TestUser.deleteMany({});
    await TestSupplier.deleteMany({});
    await TestOrder.deleteMany({});
    await TestPayment.deleteMany({});
    await TestTransaction.deleteMany({});
    await TestSupplierPayable.deleteMany({});
    await TestSupplierSettlement.deleteMany({});

    await TestPayment.syncIndexes();
    await TestTransaction.syncIndexes();
    await TestSupplierPayable.syncIndexes();
    await TestSupplierSettlement.syncIndexes();
    await TestOrder.syncIndexes();

    // 1. Seed Users
    const cafeUser = await TestUser.create({
      mobile: "09121111111",
      firstName: "مدیر",
      lastName: "کافه اول",
      status: "active",
    });

    const cafeBUser = await TestUser.create({
      mobile: "09122222222",
      firstName: "مدیر",
      lastName: "کافه دوم",
      status: "active",
    });

    const supplierUser = await TestUser.create({
      mobile: "09123333333",
      firstName: "مدیر",
      lastName: "تأمین‌کننده اول",
      status: "active",
    });

    const adminUser = await TestUser.create({
      mobile: "09120000000",
      firstName: "ادمین",
      lastName: "سیستم",
      isAdmin: true,
      status: "active",
    });

    // 2. Seed Cafes & Suppliers
    const cafeA = await TestCafe.create({
      name: "کافه لمیز میدان ونک",
      slug: "lamiz-vanak",
      status: "active",
      ownerUserId: cafeUser._id,
    });

    const cafeB = await TestCafe.create({
      name: "کافه سام",
      slug: "sam-cafe",
      status: "active",
      ownerUserId: cafeBUser._id,
    });

    const supplierA = await TestSupplier.create({
      businessName: "بازرگانی قهوه راشین",
      slug: "rashin-coffee",
      status: "active",
      ownerUserId: supplierUser._id,
    });

    const supplierB = await TestSupplier.create({
      businessName: "تجهیزات و قهوه پارس",
      slug: "pars-equipment",
      status: "active",
      ownerUserId: supplierUser._id,
    });

    // Helper identities
    const cafeAIdentity = {
      userId: cafeUser._id.toString(),
      cafeId: cafeA._id.toString(),
      role: "owner",
    };

    const cafeBIdentity = {
      userId: cafeBUser._id.toString(),
      cafeId: cafeB._id.toString(),
      role: "owner",
    };

    const supplierAIdentity = {
      userId: supplierUser._id.toString(),
      supplierId: supplierA._id.toString(),
      role: "owner",
    };

    const adminIdentity = {
      userId: adminUser._id.toString(),
      email: "admin@sefaresh.com",
    };

    // 3. Seed Orders in various statuses
    const dummyPurchaseRequestId = new Types.ObjectId();

    // Order 1: placed (status not payable)
    const orderPlaced = await TestOrder.create({
      orderNumber: "ORD-2610-TEST1",
      cafeId: cafeA._id,
      supplierId: supplierA._id,
      purchaseRequestId: dummyPurchaseRequestId,
      purchaseRequestSelectionId: new Types.ObjectId(),
      status: "placed",
      items: [
        {
          purchaseRequestItemId: new Types.ObjectId(),
          supplierRequestId: new Types.ObjectId(),
          supplierResponseId: new Types.ObjectId(),
          itemType: "custom",
          title: "قهوه کلمبیا",
          unit: "کیلوگرم",
          quantity: 5,
          unitPrice: 100000,
          subtotal: 500000,
        },
      ],
      itemsSubtotal: 500000,
      shippingCost: 50000,
      totalAmount: 550000,
      deliveryDays: 2,
      createdByUserId: cafeUser._id,
    });

    // Order 2: confirmed (payable)
    const orderConfirmed = await TestOrder.create({
      orderNumber: "ORD-2610-TEST2",
      cafeId: cafeA._id,
      supplierId: supplierA._id,
      purchaseRequestId: dummyPurchaseRequestId,
      purchaseRequestSelectionId: new Types.ObjectId(),
      status: "confirmed",
      items: [
        {
          purchaseRequestItemId: new Types.ObjectId(),
          supplierRequestId: new Types.ObjectId(),
          supplierResponseId: new Types.ObjectId(),
          itemType: "custom",
          title: "شیر پرچرب",
          unit: "بطری",
          quantity: 10,
          unitPrice: 50000,
          subtotal: 500000,
        },
      ],
      itemsSubtotal: 500000,
      shippingCost: 30000,
      totalAmount: 530000,
      deliveryDays: 1,
      createdByUserId: cafeUser._id,
      confirmedAt: new Date(),
    });

    // Order 3: cancelled (not payable)
    const orderCancelled = await TestOrder.create({
      orderNumber: "ORD-2610-TEST3",
      cafeId: cafeA._id,
      supplierId: supplierA._id,
      purchaseRequestId: dummyPurchaseRequestId,
      purchaseRequestSelectionId: new Types.ObjectId(),
      status: "cancelled",
      items: [
        {
          purchaseRequestItemId: new Types.ObjectId(),
          supplierRequestId: new Types.ObjectId(),
          supplierResponseId: new Types.ObjectId(),
          itemType: "custom",
          title: "لیوان کاغذی",
          unit: "بسته",
          quantity: 2,
          unitPrice: 80000,
          subtotal: 160000,
        },
      ],
      itemsSubtotal: 160000,
      shippingCost: 0,
      totalAmount: 160000,
      deliveryDays: 1,
      createdByUserId: cafeUser._id,
      cancelledAt: new Date(),
    });

    // Order 4: delivered before payment (for reverse event order test)
    const orderDeliveredFirst = await TestOrder.create({
      orderNumber: "ORD-2610-TEST4",
      cafeId: cafeA._id,
      supplierId: supplierA._id,
      purchaseRequestId: dummyPurchaseRequestId,
      purchaseRequestSelectionId: new Types.ObjectId(),
      status: "delivered",
      items: [
        {
          purchaseRequestItemId: new Types.ObjectId(),
          supplierRequestId: new Types.ObjectId(),
          supplierResponseId: new Types.ObjectId(),
          itemType: "custom",
          title: "سیروپ وانیل",
          unit: "بطری",
          quantity: 4,
          unitPrice: 150000,
          subtotal: 600000,
        },
      ],
      itemsSubtotal: 600000,
      shippingCost: 40000,
      totalAmount: 640000,
      deliveryDays: 1,
      createdByUserId: cafeUser._id,
      confirmedAt: new Date(),
      deliveredAt: new Date(),
    });

    // Order 5: belongs to Supplier A, for multiple payables settlement test
    const orderConfirmed2 = await TestOrder.create({
      orderNumber: "ORD-2610-TEST5",
      cafeId: cafeA._id,
      supplierId: supplierA._id,
      purchaseRequestId: dummyPurchaseRequestId,
      purchaseRequestSelectionId: new Types.ObjectId(),
      status: "confirmed",
      items: [
        {
          purchaseRequestItemId: new Types.ObjectId(),
          supplierRequestId: new Types.ObjectId(),
          supplierResponseId: new Types.ObjectId(),
          itemType: "custom",
          title: "پودر کاکائو",
          unit: "بسته",
          quantity: 2,
          unitPrice: 200000,
          subtotal: 400000,
        },
      ],
      itemsSubtotal: 400000,
      shippingCost: 0,
      totalAmount: 400000,
      deliveryDays: 1,
      createdByUserId: cafeUser._id,
      confirmedAt: new Date(),
    });

    // -------------------------------------------------------------------------
    // TEST SECTION A: Payment Initiation & Authorization Rules
    // -------------------------------------------------------------------------

    // 1. Order in placed status cannot be paid
    await assert.rejects(
      () =>
        createOrderPaymentAttempt(
          {
            orderId: orderPlaced._id.toString(),
            idempotencyKey: "key-placed-1",
          },
          cafeAIdentity,
        ),
      (err) =>
        err instanceof FinanceInvalidStatusError &&
        err.message.includes("تأیید"),
    );

    // 2. Order in cancelled status cannot be paid
    await assert.rejects(
      () =>
        createOrderPaymentAttempt(
          {
            orderId: orderCancelled._id.toString(),
            idempotencyKey: "key-cancelled-1",
          },
          cafeAIdentity,
        ),
      (err) => err instanceof FinanceInvalidStatusError,
    );

    // 3. Cafe B cannot pay for Order of Cafe A (Tenant Isolation)
    await assert.rejects(
      () =>
        createOrderPaymentAttempt(
          {
            orderId: orderConfirmed._id.toString(),
            idempotencyKey: "key-cafeB-1",
          },
          cafeBIdentity,
        ),
      (err) => err instanceof FinanceNotFoundError,
    );

    // 4. Client cannot inject amount (Authority check): Amount is taken strictly from Order.totalAmount
    const paymentAttempt1 = await createOrderPaymentAttempt(
      {
        orderId: orderConfirmed._id.toString(),
        idempotencyKey: "idem-key-100",
        amount: 1, // Malicious injection must be completely ignored
      },
      cafeAIdentity,
    );

    assert.equal(paymentAttempt1.amount, 530000); // Equal to orderConfirmed.totalAmount
    assert.equal(paymentAttempt1.status, "pending");
    assert.equal(paymentAttempt1.method, "online");

    // 5. Idempotency: Double submission with same key returns identical attempt without creating duplicate
    const paymentAttempt1Duplicate = await createOrderPaymentAttempt(
      {
        orderId: orderConfirmed._id.toString(),
        idempotencyKey: "idem-key-100",
      },
      cafeAIdentity,
    );

    assert.equal(paymentAttempt1Duplicate.id, paymentAttempt1.id);
    assert.equal(
      paymentAttempt1Duplicate.paymentReference,
      paymentAttempt1.paymentReference,
    );

    const totalPaymentsCount = await TestPayment.countDocuments({
      orderId: orderConfirmed._id,
    });
    assert.equal(totalPaymentsCount, 1);

    // 6. Check Cafe read model before payment is marked paid (derived status: pending)
    const readBeforePaid = await getCafeOrderPayment(
      orderConfirmed._id.toString(),
      cafeAIdentity,
    );
    assert.equal(readBeforePaid.paymentStatus, "pending");
    assert.equal(readBeforePaid.paidAt, null);
    assert.equal(readBeforePaid.latestPayment?.id, paymentAttempt1.id);

    // -------------------------------------------------------------------------
    // TEST SECTION B: Failed Payment & Retry Lifecycle
    // -------------------------------------------------------------------------

    // 7. Mark attempt 1 as failed
    const failedResult = await markPaymentFailedInternal({
      paymentId: paymentAttempt1.id,
      failureCode: "CARD_LIMIT_EXCEEDED",
      failureMessage: "موجودی حساب کافی نیست",
    });
    assert.equal(failedResult.status, "failed");

    // Verify Order is NOT mutated by payment failure
    const orderAfterFailed = await TestOrder.findById(orderConfirmed._id);
    assert.equal(orderAfterFailed.status, "confirmed");

    // Check Cafe read model after failure (derived status: failed)
    const readAfterFailed = await getCafeOrderPayment(
      orderConfirmed._id.toString(),
      cafeAIdentity,
    );
    assert.equal(readAfterFailed.paymentStatus, "failed");
    assert.equal(
      readAfterFailed.latestPayment?.failureMessage,
      "موجودی حساب کافی نیست",
    );

    // 8. Retry with a new idempotencyKey
    const paymentAttempt2 = await createOrderPaymentAttempt(
      {
        orderId: orderConfirmed._id.toString(),
        idempotencyKey: "idem-key-200",
      },
      cafeAIdentity,
    );
    assert.notEqual(paymentAttempt2.id, paymentAttempt1.id);
    assert.equal(paymentAttempt2.status, "pending");

    // -------------------------------------------------------------------------
    // TEST SECTION C: Mark Payment Paid, Ledger & Payable Invariants
    // -------------------------------------------------------------------------

    // 9. Mark attempt 2 as paid
    const paidResult = await markPaymentPaidInternal({
      paymentId: paymentAttempt2.id,
      providerReference: "MOCK-TXN-777",
    });
    assert.equal(paidResult.status, "paid");
    assert.ok(paidResult.paidAt);

    // 10. Invariant: One successful payment per Order
    // Attempting to create or mark another payment as paid for this order must fail
    await assert.rejects(
      () =>
        createOrderPaymentAttempt(
          {
            orderId: orderConfirmed._id.toString(),
            idempotencyKey: "idem-key-300",
          },
          cafeAIdentity,
        ),
      (err) =>
        err instanceof FinanceInvalidStatusError &&
        err.message.includes("قبلاً با موفقیت پرداخت شده است"),
    );

    // Verify DB invariant: Attempting to insert a duplicate paid payment directly into MongoDB
    // must trigger Mongo E11000 duplicate key on partial unique index { orderId: 1 } where status: "paid"
    await assert.rejects(
      () =>
        TestPayment.create({
          cafeId: cafeA._id,
          orderId: orderConfirmed._id,
          amount: 530000,
          status: "paid",
          method: "online",
          paymentReference: generatePaymentReference(),
          idempotencyKey: "raw-mongo-duplicate-paid",
          initiatedByUserId: cafeUser._id,
          provider: "mock",
        }),
      (err) => err.code === 11000,
    );

    // 11. Transaction Ledger Verification: payment_received entry
    const paymentReceivedTx = await TestTransaction.findOne({
      paymentId: paymentAttempt2.id,
      type: "payment_received",
    });
    assert.ok(paymentReceivedTx);
    assert.equal(paymentReceivedTx.amount, 530000);
    assert.equal(paymentReceivedTx.direction, "credit");
    assert.equal(
      paymentReceivedTx.referenceNumber,
      paymentAttempt2.paymentReference,
    );
    assert.equal(
      paymentReceivedTx.cafeId.toString(),
      cafeA._id.toString(),
    );
    assert.equal(
      paymentReceivedTx.supplierId.toString(),
      supplierA._id.toString(),
    );
    assert.equal(
      paymentReceivedTx.orderId.toString(),
      orderConfirmed._id.toString(),
    );

    // Ledger idempotency: Retrying markPaymentPaidInternal must NOT duplicate ledger transaction
    await markPaymentPaidInternal({ paymentId: paymentAttempt2.id });
    const paymentTxCount = await TestTransaction.countDocuments({
      paymentId: paymentAttempt2.id,
      type: "payment_received",
    });
    assert.equal(paymentTxCount, 1);

    // 12. SupplierPayable Verification: Status is pending (because order is not yet delivered!)
    const payableDoc = await TestSupplierPayable.findOne({
      orderId: orderConfirmed._id,
    });
    assert.ok(payableDoc);
    assert.equal(payableDoc.grossAmount, 530000);
    assert.equal(payableDoc.platformFee, 0); // Platform fee default 0
    assert.equal(payableDoc.netAmount, 530000);
    assert.equal(payableDoc.status, "pending");
    assert.equal(payableDoc.eligibleAt, null);
    assert.equal(payableDoc.settlementId, null);

    // 13. Order Delivery Integration: When Order transitions to delivered -> Payable becomes eligible
    // First, verify transition with delivery sync
    await syncPayableOnOrderDelivered(orderConfirmed._id.toString());

    const payableAfterDelivery = await TestSupplierPayable.findOne({
      orderId: orderConfirmed._id,
    });
    assert.equal(payableAfterDelivery.status, "eligible");
    assert.ok(payableAfterDelivery.eligibleAt);

    // Delivery event is retry-safe (idempotent)
    await syncPayableOnOrderDelivered(orderConfirmed._id.toString());
    const payableAfterDuplicateSync = await TestSupplierPayable.findOne({
      orderId: orderConfirmed._id,
    });
    assert.equal(payableAfterDuplicateSync.status, "eligible");

    // -------------------------------------------------------------------------
    // TEST SECTION D: Reverse Event Ordering (Order Delivered BEFORE Payment)
    // -------------------------------------------------------------------------

    // 14. Order 4 is already delivered. Now cafe initiates and completes payment.
    // Payable must directly become eligible upon payment!
    const paymentOrder4 = await createOrderPaymentAttempt(
      {
        orderId: orderDeliveredFirst._id.toString(),
        idempotencyKey: "idem-order4-1",
      },
      cafeAIdentity,
    );

    await markPaymentPaidInternal({
      paymentId: paymentOrder4.id,
    });

    const payableOrder4 = await TestSupplierPayable.findOne({
      orderId: orderDeliveredFirst._id,
    });
    assert.ok(payableOrder4);
    assert.equal(payableOrder4.grossAmount, 640000);
    assert.equal(payableOrder4.netAmount, 640000);
    assert.equal(payableOrder4.status, "eligible"); // Directly eligible!
    assert.ok(payableOrder4.eligibleAt);

    // -------------------------------------------------------------------------
    // TEST SECTION E: Multiple Payables for Supplier & Settlement Invariants
    // -------------------------------------------------------------------------

    // 15. Create and pay for Order 5 (400,000 Toman) and deliver it
    const paymentOrder5 = await createOrderPaymentAttempt(
      {
        orderId: orderConfirmed2._id.toString(),
        idempotencyKey: "idem-order5-1",
      },
      cafeAIdentity,
    );
    await markPaymentPaidInternal({ paymentId: paymentOrder5.id });
    await syncPayableOnOrderDelivered(orderConfirmed2._id.toString());

    const payableOrder5 = await TestSupplierPayable.findOne({
      orderId: orderConfirmed2._id,
    });
    assert.equal(payableOrder5.status, "eligible");

    // At this point, Supplier A has three eligible payables:
    // - payableDoc (Order 2): 530,000 Toman
    // - payableOrder4 (Order 4): 640,000 Toman
    // - payableOrder5 (Order 5): 400,000 Toman
    // Total eligible: 1,570,000 Toman

    // 16. Supplier Finance Overview Read Model
    const supplierOverview = await getSupplierFinanceOverview(
      supplierAIdentity,
    );
    assert.equal(supplierOverview.pendingPayableAmount, 0);
    assert.equal(supplierOverview.eligibleSettlementAmount, 1570000);
    assert.equal(supplierOverview.settledAmount, 0);
    assert.equal(supplierOverview.totalPayableCount, 3);

    // 17. Settlement Precondition & Security checks
    // A) Non-admin cannot create settlement
    await assert.rejects(
      () =>
        createSupplierSettlement(
          {
            supplierId: supplierA._id.toString(),
            payableIds: [payableDoc._id.toString()],
          },
          null, // No admin identity -> redirect or throw
        ),
      (err) => err instanceof FinanceAuthError,
    );

    // B) Settle payables belonging to Supplier A under Supplier B must be rejected
    await assert.rejects(
      () =>
        createSupplierSettlement(
          {
            supplierId: supplierB._id.toString(), // Wrong supplier!
            payableIds: [payableDoc._id.toString()],
          },
          adminIdentity,
        ),
      (err) =>
        err instanceof FinanceValidationError &&
        err.message.includes("دیگری"),
    );

    // C) Admin settles a SUBSET of eligible payables:
    // Settle Order 2 (530k) + Order 5 (400k) = 930k authoritative total
    const settlementResult = await createSupplierSettlement(
      {
        supplierId: supplierA._id.toString(),
        payableIds: [payableDoc._id.toString(), payableOrder5._id.toString()],
        note: "بابت تسویه هفتگی سفارشات 2 و 5",
      },
      adminIdentity,
    );

    assert.equal(settlementResult.payableCount, 2);
    assert.equal(settlementResult.totalAmount, 930000); // 530,000 + 400,000
    assert.match(settlementResult.settlementNumber, /^STL-\d{4}-/);

    // 18. Verify settled payables status in database
    const refreshedPayable2 = await TestSupplierPayable.findById(
      payableDoc._id,
    );
    const refreshedPayable5 = await TestSupplierPayable.findById(
      payableOrder5._id,
    );
    const unSettledPayable4 = await TestSupplierPayable.findById(
      payableOrder4._id,
    );

    assert.equal(refreshedPayable2.status, "settled");
    assert.equal(
      refreshedPayable2.settlementId.toString(),
      settlementResult.settlementId,
    );
    assert.ok(refreshedPayable2.settledAt);

    assert.equal(refreshedPayable5.status, "settled");
    assert.equal(
      refreshedPayable5.settlementId.toString(),
      settlementResult.settlementId,
    );

    // Unsettled item remains eligible
    assert.equal(unSettledPayable4.status, "eligible");
    assert.equal(unSettledPayable4.settlementId, null);

    // 19. Double Settlement Prevention: Already settled payable cannot be settled again
    await assert.rejects(
      () =>
        createSupplierSettlement(
          {
            supplierId: supplierA._id.toString(),
            payableIds: [refreshedPayable2._id.toString()],
          },
          adminIdentity,
        ),
      (err) =>
        err instanceof FinanceValidationError &&
        err.message.includes("قابل تسویه"),
    );

    // 20. Settlement Ledger Transaction verification: supplier_settlement_paid
    const settlementTx = await TestTransaction.findOne({
      settlementId: settlementResult.settlementId,
      type: "supplier_settlement_paid",
    });
    assert.ok(settlementTx);
    assert.equal(settlementTx.amount, 930000);
    assert.equal(settlementTx.direction, "debit");
    assert.equal(
      settlementTx.referenceNumber,
      settlementResult.settlementNumber,
    );

    // -------------------------------------------------------------------------
    // TEST SECTION F: Admin & Supplier Finance Read Models
    // -------------------------------------------------------------------------

    // 21. Supplier Finance Overview after partial settlement
    const supplierOverviewAfter = await getSupplierFinanceOverview(
      supplierAIdentity,
    );
    assert.equal(supplierOverviewAfter.pendingPayableAmount, 0);
    assert.equal(supplierOverviewAfter.eligibleSettlementAmount, 640000); // Only Order 4 remaining
    assert.equal(supplierOverviewAfter.settledAmount, 930000); // 930k settled
    assert.equal(supplierOverviewAfter.totalPayableCount, 3);

    // 22. Supplier Payables List
    const supplierPayablesList = await listSupplierPayables(
      { page: 1, pageSize: 10 },
      supplierAIdentity,
    );
    assert.equal(supplierPayablesList.total, 3);
    assert.equal(supplierPayablesList.items.length, 3);
    assert.equal(
      typeof supplierPayablesList.items[0].netAmount,
      "number",
    );

    // 23. Supplier Settlements List
    const supplierSettlementsList = await listSupplierSettlements(
      { page: 1, pageSize: 10 },
      supplierAIdentity,
    );
    assert.equal(supplierSettlementsList.total, 1);
    assert.equal(
      supplierSettlementsList.items[0].settlementNumber,
      settlementResult.settlementNumber,
    );
    assert.equal(supplierSettlementsList.items[0].totalAmount, 930000);

    // 24. Admin Finance Overview
    const adminOverview = await getAdminFinanceOverview(adminIdentity);
    // Total successful payments: 3 (Order 2: 530k + Order 4: 640k + Order 5: 400k = 1,570,000)
    assert.equal(adminOverview.totalSuccessfulPayments, 3);
    assert.equal(adminOverview.totalReceivedAmount, 1570000);
    assert.equal(adminOverview.pendingSupplierPayableAmount, 0);
    assert.equal(adminOverview.eligibleSettlementAmount, 640000);
    assert.equal(adminOverview.settledAmount, 930000);

    // 25. Admin Payments List
    const adminPaymentsList = await listAdminPayments(
      { page: 1, pageSize: 20 },
      adminIdentity,
    );
    assert.ok(adminPaymentsList.total >= 4); // attempt1 (failed) + attempt2 (paid) + attempt4 + attempt5
    const samplePayment = adminPaymentsList.items[0];
    assert.ok(samplePayment.cafeName);
    assert.ok(samplePayment.supplierName);
    assert.ok(samplePayment.orderNumber);

    // 26. Admin Settlements List
    const adminSettlementsList = await listAdminSettlements(
      { page: 1, pageSize: 20 },
      adminIdentity,
    );
    assert.equal(adminSettlementsList.total, 1);
    assert.equal(
      adminSettlementsList.items[0].supplierName,
      "بازرگانی قهوه راشین",
    );

    // 27. Admin Settlement Candidates (for remaining unsettled item)
    const candidates = await getAdminSettlementCandidates(
      supplierA._id.toString(),
      adminIdentity,
    );
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].orderNumber, "ORD-2610-TEST4");
    assert.equal(candidates[0].netAmount, 640000);

    // 28. DTO Clean Serialization Verification
    const jsonStr = JSON.stringify({
      readAfterFailed,
      supplierOverviewAfter,
      supplierPayablesList,
      adminOverview,
      adminPaymentsList,
      settlementResult,
    });
    const rehydrated = JSON.parse(jsonStr);
    assert.equal(
      rehydrated.supplierOverviewAfter.settledAmount,
      930000,
    );
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

