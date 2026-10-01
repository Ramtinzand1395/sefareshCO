import assert from "node:assert/strict";
import test from "node:test";
import mongoose, { Types } from "mongoose";

import { Category } from "../model/category.ts";
import { InternalPurchaseRequest } from "../model/internal-purchase-request.ts";
import { Product } from "../model/product.ts";
import { User } from "../model/user.ts";
import {
  canCancelInternalRequest,
  canCreateInternalRequest,
  canReviewInternalRequest,
} from "../src/domain/cafe-access.ts";
import {
  deriveItemReviewStatus,
  deriveParentRequestStatus,
} from "../src/domain/internal-purchase-request.ts";
import {
  cancelInternalPurchaseRequestSchema,
  createInternalPurchaseRequestSchema,
  createInternalRequestItemSchema,
  internalPurchaseRequestQuerySchema,
  reviewInternalPurchaseRequestSchema,
} from "../src/domain/schemas/internal-purchase-request.ts";
import {
  atomicCancelInternalPurchaseRequest,
  atomicReviewInternalPurchaseRequest,
  createInternalPurchaseRequest,
  findInternalPurchaseRequestById,
  findInternalPurchaseRequestsByCafe,
} from "../src/repositories/internal-purchase-request-repository.ts";

// ---------------------------------------------------------------------------
// 1. Zod Schemas & Invariant Validations
// ---------------------------------------------------------------------------

test("createInternalRequestItemSchema: enforces catalog item vs custom item invariant", () => {
  const validProductId = new Types.ObjectId().toString();

  // Valid catalog item
  const validCatalog = createInternalRequestItemSchema.safeParse({
    itemType: "catalog",
    productId: validProductId,
    requestedQuantity: 5,
    note: "شیر کم‌چرب",
  });
  assert.equal(validCatalog.success, true);

  // Incompatible catalog item: cannot have customTitle or customUnit
  const invalidCatalog = createInternalRequestItemSchema.safeParse({
    itemType: "catalog",
    productId: validProductId,
    customTitle: "عنوان تکراری",
    requestedQuantity: 5,
  });
  assert.equal(invalidCatalog.success, false);

  // Valid custom item
  const validCustom = createInternalRequestItemSchema.safeParse({
    itemType: "custom",
    customTitle: "پودر وانیل فرانسوی",
    customUnit: "بسته",
    requestedQuantity: 3,
  });
  assert.equal(validCustom.success, true);

  // Incompatible custom item: cannot have productId
  const invalidCustom = createInternalRequestItemSchema.safeParse({
    itemType: "custom",
    customTitle: "پودر شکلات",
    customUnit: "کیلو",
    productId: validProductId,
    requestedQuantity: 2,
  });
  assert.equal(invalidCustom.success, false);
});

test("createInternalRequestItemSchema: rejects decimal, zero, negative, and unsafe quantities", () => {
  const validProductId = new Types.ObjectId().toString();

  assert.equal(
    createInternalRequestItemSchema.safeParse({
      itemType: "catalog",
      productId: validProductId,
      requestedQuantity: 1,
    }).success,
    true,
  );

  assert.equal(
    createInternalRequestItemSchema.safeParse({
      itemType: "catalog",
      productId: validProductId,
      requestedQuantity: 0,
    }).success,
    false,
  );

  assert.equal(
    createInternalRequestItemSchema.safeParse({
      itemType: "catalog",
      productId: validProductId,
      requestedQuantity: -4,
    }).success,
    false,
  );

  assert.equal(
    createInternalRequestItemSchema.safeParse({
      itemType: "catalog",
      productId: validProductId,
      requestedQuantity: 2.7,
    }).success,
    false,
  );

  assert.equal(
    createInternalRequestItemSchema.safeParse({
      itemType: "catalog",
      productId: validProductId,
      requestedQuantity: Number.MAX_SAFE_INTEGER + 10,
    }).success,
    false,
  );
});

test("createInternalPurchaseRequestSchema: requires at least 1 item and bounds fields", () => {
  const validProductId = new Types.ObjectId().toString();

  // Rejects empty items array
  assert.equal(
    createInternalPurchaseRequestSchema.safeParse({
      items: [],
    }).success,
    false,
  );

  // Accepts valid request with title and description
  const valid = createInternalPurchaseRequestSchema.safeParse({
    title: "خرید هفتگی آشپزخانه",
    description: "مواد اولیه مورد نیاز برای بار و آشپزخانه",
    items: [
      {
        itemType: "catalog",
        productId: validProductId,
        requestedQuantity: 10,
      },
    ],
  });
  assert.equal(valid.success, true);

  // Rejects oversized title (> 150 chars)
  assert.equal(
    createInternalPurchaseRequestSchema.safeParse({
      title: "a".repeat(151),
      items: [
        {
          itemType: "catalog",
          productId: validProductId,
          requestedQuantity: 1,
        },
      ],
    }).success,
    false,
  );
});

test("reviewInternalPurchaseRequestSchema: validates review inputs and approvedQuantity", () => {
  const requestId = new Types.ObjectId().toString();
  const itemId = new Types.ObjectId().toString();

  // Valid review payload
  const valid = reviewInternalPurchaseRequestSchema.safeParse({
    requestId,
    reviewNotes: "برخی اقلام کاهش یافت",
    items: [
      {
        itemId,
        approvedQuantity: 5,
        note: "تأیید شد",
      },
    ],
  });
  assert.equal(valid.success, true);

  // approvedQuantity can be 0 (rejected item)
  assert.equal(
    reviewInternalPurchaseRequestSchema.safeParse({
      requestId,
      items: [{ itemId, approvedQuantity: 0 }],
    }).success,
    true,
  );

  // Rejects negative approvedQuantity
  assert.equal(
    reviewInternalPurchaseRequestSchema.safeParse({
      requestId,
      items: [{ itemId, approvedQuantity: -1 }],
    }).success,
    false,
  );

  // Rejects decimal approvedQuantity
  assert.equal(
    reviewInternalPurchaseRequestSchema.safeParse({
      requestId,
      items: [{ itemId, approvedQuantity: 3.5 }],
    }).success,
    false,
  );
});

test("cancelInternalPurchaseRequestSchema and querySchema: validate inputs correctly", () => {
  const requestId = new Types.ObjectId().toString();

  assert.equal(
    cancelInternalPurchaseRequestSchema.safeParse({
      requestId,
      cancelReason: "عدم نیاز فعلی",
    }).success,
    true,
  );

  assert.equal(
    cancelInternalPurchaseRequestSchema.safeParse({
      requestId: "invalid-id",
    }).success,
    false,
  );

  // Query schema defaults
  const parsedQuery = internalPurchaseRequestQuerySchema.safeParse({});
  assert.equal(parsedQuery.success, true);
  if (parsedQuery.success) {
    assert.equal(parsedQuery.data.page, 1);
    assert.equal(parsedQuery.data.pageSize, 20);
    assert.equal(parsedQuery.data.status, undefined);
  }
});

// ---------------------------------------------------------------------------
// 2. Pure Domain Logic: Status Derivation & Item Review
// ---------------------------------------------------------------------------

test("deriveItemReviewStatus: correctly derives approved, partially_approved, and rejected", () => {
  assert.equal(deriveItemReviewStatus(10, 10), "approved");
  assert.equal(deriveItemReviewStatus(10, 0), "rejected");
  assert.equal(deriveItemReviewStatus(10, 6), "partially_approved");
  assert.equal(deriveItemReviewStatus(10, 1), "partially_approved");
  assert.equal(deriveItemReviewStatus(5, -1), "rejected");
});

test("deriveParentRequestStatus: derives status from items combinations", () => {
  // All approved -> approved
  assert.equal(
    deriveParentRequestStatus([
      { requestedQuantity: 10, approvedQuantity: 10 },
      { requestedQuantity: 5, approvedQuantity: 5 },
    ]),
    "approved",
  );

  // All rejected -> rejected
  assert.equal(
    deriveParentRequestStatus([
      { requestedQuantity: 10, approvedQuantity: 0 },
      { requestedQuantity: 5, approvedQuantity: 0 },
    ]),
    "rejected",
  );

  // Some fully approved, some rejected -> partially_approved
  assert.equal(
    deriveParentRequestStatus([
      { requestedQuantity: 10, approvedQuantity: 10 },
      { requestedQuantity: 5, approvedQuantity: 0 },
    ]),
    "partially_approved",
  );

  // Some partially approved -> partially_approved
  assert.equal(
    deriveParentRequestStatus([
      { requestedQuantity: 10, approvedQuantity: 7 },
      { requestedQuantity: 5, approvedQuantity: 5 },
    ]),
    "partially_approved",
  );
});

// ---------------------------------------------------------------------------
// 3. Domain Authorization & Permission Rules
// ---------------------------------------------------------------------------

test("canCreateInternalRequest: permits owner, manager, purchase_manager, chef, and authorized members", () => {
  assert.equal(canCreateInternalRequest({ role: "owner" }), true);
  assert.equal(canCreateInternalRequest({ role: "manager" }), true);
  assert.equal(canCreateInternalRequest({ role: "purchase_manager" }), true);
  assert.equal(canCreateInternalRequest({ role: "chef" }), true);

  // Employee without permission is denied
  assert.equal(canCreateInternalRequest({ role: "employee" }), false);
  assert.equal(
    canCreateInternalRequest({
      role: "employee",
      permissions: { canCreatePurchaseRequest: false },
    }),
    false,
  );

  // Employee with explicit permission is granted
  assert.equal(
    canCreateInternalRequest({
      role: "employee",
      permissions: { canCreatePurchaseRequest: true },
    }),
    true,
  );

  // Chef with explicitly revoked permission is denied
  assert.equal(
    canCreateInternalRequest({
      role: "chef",
      permissions: { canCreatePurchaseRequest: false },
    }),
    false,
  );
});

test("canReviewInternalRequest: restricts review strictly to management roles", () => {
  assert.equal(canReviewInternalRequest({ role: "owner" }), true);
  assert.equal(canReviewInternalRequest({ role: "manager" }), true);
  assert.equal(canReviewInternalRequest({ role: "purchase_manager" }), true);

  // Chef and employee CANNOT review by default
  assert.equal(canReviewInternalRequest({ role: "chef" }), false);
  assert.equal(canReviewInternalRequest({ role: "employee" }), false);
  assert.equal(canReviewInternalRequest({ role: "accountant" }), false);

  // Employee granted explicit canApprovePurchaseRequest
  assert.equal(
    canReviewInternalRequest({
      role: "employee",
      permissions: { canApprovePurchaseRequest: true },
    }),
    true,
  );

  // Manager with revoked permission
  assert.equal(
    canReviewInternalRequest({
      role: "manager",
      permissions: { canApprovePurchaseRequest: false },
    }),
    false,
  );
});

test("canCancelInternalRequest: permits requester or manager on pending requests only", () => {
  const user1 = "user-111";
  const user2 = "user-222";

  // Requester cancelling their own pending request -> allowed
  assert.equal(
    canCancelInternalRequest(
      { userId: user1, role: "chef" },
      { requestedByUserId: user1, status: "pending" },
    ),
    true,
  );

  // Another non-manager user trying to cancel -> denied
  assert.equal(
    canCancelInternalRequest(
      { userId: user2, role: "chef" },
      { requestedByUserId: user1, status: "pending" },
    ),
    false,
  );

  // Manager cancelling another user's pending request -> allowed
  assert.equal(
    canCancelInternalRequest(
      { userId: user2, role: "manager" },
      { requestedByUserId: user1, status: "pending" },
    ),
    true,
  );

  // Cannot cancel non-pending request (even by requester or owner)
  assert.equal(
    canCancelInternalRequest(
      { userId: user1, role: "owner" },
      { requestedByUserId: user1, status: "approved" },
    ),
    false,
  );
});

// ---------------------------------------------------------------------------
// 4. Database Integration & Concurrency Tests
// ---------------------------------------------------------------------------

const TEST_DB_URI =
  process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/sefaresh_test_runner_internal_req";
process.env.MONGODB_URI = TEST_DB_URI;

test("database: create request, verify cafe isolation, batch hydration, and atomic review/cancel", async () => {
  let conn;
  try {
    conn = await mongoose.createConnection(TEST_DB_URI).asPromise();
  } catch {
    return; // Skip if local test database is not reachable
  }

  try {
    const TestInternalReq = conn.model(
      "InternalPurchaseRequest",
      InternalPurchaseRequest.schema,
    );
    const TestProduct = conn.model("Product", Product.schema);
    const TestCategory = conn.model("Category", Category.schema);
    const TestUser = conn.model("User", User.schema);

    // Clean up
    await TestInternalReq.deleteMany({});
    await TestProduct.deleteMany({});
    await TestCategory.deleteMany({});
    await TestUser.deleteMany({});

    // 1. Seed users
    const cafeUser = await TestUser.create({
      firstName: "علی",
      lastName: "سرآشپز",
      status: "active",
    });

    const managerUser = await TestUser.create({
      firstName: "رضا",
      lastName: "مدیر",
      status: "active",
    });

    // 2. Seed Category & Product
    const category = await TestCategory.create({
      name: "لبنیات",
      slug: "dairy-category",
      status: "active",
    });

    const product = await TestProduct.create({
      name: "شیر پرچرب ۱ لیتری",
      slug: "milk-1l",
      categoryId: category._id,
      unit: "لیتر",
      status: "active",
    });

    const cafeIdA = new Types.ObjectId().toString();
    const cafeIdB = new Types.ObjectId().toString();

    // 3. Create Internal Purchase Request in Cafe A
    const requestId = await createInternalPurchaseRequest({
      cafeId: cafeIdA,
      requestedByUserId: cafeUser._id.toString(),
      title: "درخواست مواد اولیه هفته",
      description: "برای شیفت صبح و عصر",
      items: [
        {
          itemType: "catalog",
          productId: product._id.toString(),
          requestedQuantity: 10,
          note: "برند کاله در اولویت است",
        },
        {
          itemType: "custom",
          customTitle: "سیروپ کارامل مخصوص",
          customUnit: "شیشه",
          requestedQuantity: 3,
        },
      ],
    });

    assert.ok(requestId);

    // 4. Verify Cafe Isolation: querying Cafe B returns null
    const detailCafeB = await findInternalPurchaseRequestById(cafeIdB, requestId);
    assert.equal(detailCafeB, null, "Cafe B must not access Cafe A requests");

    // 5. Query Detail for Cafe A: check batch hydration of user and product
    const detail = await findInternalPurchaseRequestById(cafeIdA, requestId);
    assert.ok(detail);
    assert.equal(detail.status, "pending");
    assert.equal(detail.requesterName, "علی سرآشپز");
    assert.equal(detail.items.length, 2);

    const catalogItem = detail.items.find((i) => i.itemType === "catalog");
    assert.ok(catalogItem);
    assert.equal(catalogItem.productName, "شیر پرچرب ۱ لیتری");
    assert.equal(catalogItem.productUnit, "لیتر");
    assert.equal(catalogItem.requestedQuantity, 10);
    assert.equal(catalogItem.approvedQuantity, 0);

    const customItem = detail.items.find((i) => i.itemType === "custom");
    assert.ok(customItem);
    assert.equal(customItem.customTitle, "سیروپ کارامل مخصوص");
    assert.equal(customItem.customUnit, "شیشه");
    assert.equal(customItem.requestedQuantity, 3);

    // 6. Test Listing & Pagination
    const listResult = await findInternalPurchaseRequestsByCafe(cafeIdA, {
      page: 1,
      pageSize: 10,
      status: "pending",
    });
    assert.equal(listResult.total, 1);
    assert.equal(listResult.items.length, 1);
    assert.equal(listResult.items[0].itemCount, 2);
    assert.equal(listResult.items[0].requesterName, "علی سرآشپز");

    // 7. Atomic Review: Manager reviews partially (8 milk approved, 0 syrup approved)
    const reviewResult = await atomicReviewInternalPurchaseRequest({
      cafeId: cafeIdA,
      requestId,
      reviewerUserId: managerUser._id.toString(),
      derivedStatus: "partially_approved",
      reviewNotes: "سیروپ در انبار موجود است؛ شیر ۸ عدد تأیید شد",
      reviewedItems: [
        {
          id: catalogItem.id,
          approvedQuantity: 8,
          status: "partially_approved",
          note: "۲ عدد کاهش یافت",
        },
        {
          id: customItem.id,
          approvedQuantity: 0,
          status: "rejected",
          note: "موجودی انبار کافی است",
        },
      ],
    });
    assert.equal(reviewResult, true);

    // Verify reviewed request detail
    const reviewedDetail = await findInternalPurchaseRequestById(cafeIdA, requestId);
    assert.ok(reviewedDetail);
    assert.equal(reviewedDetail.status, "partially_approved");
    assert.equal(reviewedDetail.reviewerName, "رضا مدیر");
    assert.equal(reviewedDetail.reviewNotes, "سیروپ در انبار موجود است؛ شیر ۸ عدد تأیید شد");
    assert.ok(reviewedDetail.reviewedAt);

    // 8. Concurrency / State Precondition Check:
    // Attempting to review or cancel an already reviewed request MUST fail
    const secondReview = await atomicReviewInternalPurchaseRequest({
      cafeId: cafeIdA,
      requestId,
      reviewerUserId: managerUser._id.toString(),
      derivedStatus: "approved",
      reviewedItems: [],
    });
    assert.equal(secondReview, false, "Cannot re-review a non-pending request");

    const cancelAfterReview = await atomicCancelInternalPurchaseRequest({
      cafeId: cafeIdA,
      requestId,
      cancelledByUserId: cafeUser._id.toString(),
    });
    assert.equal(cancelAfterReview, false, "Cannot cancel an already reviewed request");

    // 9. Create another request and verify Atomic Cancellation
    const request2Id = await createInternalPurchaseRequest({
      cafeId: cafeIdA,
      requestedByUserId: cafeUser._id.toString(),
      title: "درخواست لغوشونده",
      items: [
        {
          itemType: "catalog",
          productId: product._id.toString(),
          requestedQuantity: 2,
        },
      ],
    });

    const cancelSuccess = await atomicCancelInternalPurchaseRequest({
      cafeId: cafeIdA,
      requestId: request2Id,
      cancelledByUserId: cafeUser._id.toString(),
      cancelReason: "خرید اشتباه بود",
    });
    assert.equal(cancelSuccess, true);

    const cancelledDetail = await findInternalPurchaseRequestById(cafeIdA, request2Id);
    assert.ok(cancelledDetail);
    assert.equal(cancelledDetail.status, "cancelled");
    assert.equal(cancelledDetail.cancelReason, "خرید اشتباه بود");
  } finally {
    await conn.close();
    await mongoose.disconnect();
  }
});
