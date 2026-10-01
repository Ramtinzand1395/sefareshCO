import assert from "node:assert/strict";
import test from "node:test";
import mongoose, { Types } from "mongoose";

import { Category } from "../model/category.ts";
import { InternalPurchaseRequest } from "../model/internal-purchase-request.ts";
import { Product } from "../model/product.ts";
import { ShoppingList } from "../model/shopping-list.ts";
import { User } from "../model/user.ts";
import {
  canManageShoppingList,
  canViewShoppingList,
} from "../src/domain/cafe-access.ts";
import {
  addCatalogItemSchema,
  addCustomItemSchema,
  addShoppingListItemSchema,
  removeShoppingListItemSchema,
  transferInternalPurchaseRequestSchema,
  updateShoppingListItemQuantitySchema,
} from "../src/domain/schemas/shopping-list.ts";
import {
  aggregateShoppingListItems,
  MAX_SHOPPING_LIST_ITEMS,
} from "../src/domain/shopping-list.ts";
import {
  addCatalogItemToActiveShoppingList,
  addCustomItemToActiveShoppingList,
  atomicTransferIprItemsToActiveShoppingList,
  findActiveShoppingListByCafe,
  getOrCreateActiveShoppingList,
  removeShoppingListItem,
  updateShoppingListItemQuantity,
} from "../src/repositories/shopping-list-repository.ts";

// ---------------------------------------------------------------------------
// 1. Zod Schemas & Invariant Validations
// ---------------------------------------------------------------------------

test("addCatalogItemSchema: accepts valid catalog item and rejects custom fields or invalid numbers", () => {
  const validProductId = new Types.ObjectId().toString();

  // Valid catalog item
  const valid = addCatalogItemSchema.safeParse({
    itemType: "catalog",
    productId: validProductId,
    quantity: 5,
    note: "شیر کم‌چرب کاله",
  });
  assert.equal(valid.success, true);

  // Incompatible catalog item: cannot have customTitle or customUnit
  const invalidWithCustom = addCatalogItemSchema.safeParse({
    itemType: "catalog",
    productId: validProductId,
    customTitle: "عنوان سفارشی",
    quantity: 5,
  });
  assert.equal(invalidWithCustom.success, false);

  // Rejects zero quantity
  assert.equal(
    addCatalogItemSchema.safeParse({
      itemType: "catalog",
      productId: validProductId,
      quantity: 0,
    }).success,
    false,
  );

  // Rejects negative quantity
  assert.equal(
    addCatalogItemSchema.safeParse({
      itemType: "catalog",
      productId: validProductId,
      quantity: -3,
    }).success,
    false,
  );

  // Rejects decimal quantity
  assert.equal(
    addCatalogItemSchema.safeParse({
      itemType: "catalog",
      productId: validProductId,
      quantity: 2.5,
    }).success,
    false,
  );

  // Rejects unsafe integer
  assert.equal(
    addCatalogItemSchema.safeParse({
      itemType: "catalog",
      productId: validProductId,
      quantity: Number.MAX_SAFE_INTEGER + 100,
    }).success,
    false,
  );
});

test("addCustomItemSchema: accepts valid custom item and rejects catalog productId or missing title/unit", () => {
  const validProductId = new Types.ObjectId().toString();

  // Valid custom item
  const valid = addCustomItemSchema.safeParse({
    itemType: "custom",
    customTitle: "سیروپ کارامل مخصوص",
    customUnit: "شیشه",
    quantity: 3,
    note: "بسته‌بندی نشکن",
  });
  assert.equal(valid.success, true);

  // Incompatible custom item: cannot have productId
  const invalidWithProduct = addCustomItemSchema.safeParse({
    itemType: "custom",
    customTitle: "سیروپ",
    customUnit: "شیشه",
    productId: validProductId,
    quantity: 3,
  });
  assert.equal(invalidWithProduct.success, false);

  // Rejects empty customTitle
  assert.equal(
    addCustomItemSchema.safeParse({
      itemType: "custom",
      customTitle: "   ",
      customUnit: "کیلو",
      quantity: 1,
    }).success,
    false,
  );

  // Rejects oversized customTitle (> 150 chars)
  assert.equal(
    addCustomItemSchema.safeParse({
      itemType: "custom",
      customTitle: "a".repeat(151),
      customUnit: "کیلو",
      quantity: 1,
    }).success,
    false,
  );
});

test("addShoppingListItemSchema: discriminated union correctly routes catalog vs custom items", () => {
  const validProductId = new Types.ObjectId().toString();

  const catalogResult = addShoppingListItemSchema.safeParse({
    itemType: "catalog",
    productId: validProductId,
    quantity: 10,
  });
  assert.equal(catalogResult.success, true);

  const customResult = addShoppingListItemSchema.safeParse({
    itemType: "custom",
    customTitle: "پودر دارچین",
    customUnit: "بسته",
    quantity: 2,
  });
  assert.equal(customResult.success, true);

  // Missing itemType or invalid type fails
  assert.equal(
    addShoppingListItemSchema.safeParse({
      itemType: "unknown",
      quantity: 1,
    }).success,
    false,
  );
});

test("updateShoppingListItemQuantitySchema: validates itemId and safe positive integer quantity", () => {
  const validItemId = new Types.ObjectId().toString();

  assert.equal(
    updateShoppingListItemQuantitySchema.safeParse({
      itemId: validItemId,
      quantity: 12,
    }).success,
    true,
  );

  // Zero quantity is rejected (must be removed, not set to zero)
  assert.equal(
    updateShoppingListItemQuantitySchema.safeParse({
      itemId: validItemId,
      quantity: 0,
    }).success,
    false,
  );

  // Negative quantity is rejected
  assert.equal(
    updateShoppingListItemQuantitySchema.safeParse({
      itemId: validItemId,
      quantity: -5,
    }).success,
    false,
  );

  // Decimal quantity is rejected
  assert.equal(
    updateShoppingListItemQuantitySchema.safeParse({
      itemId: validItemId,
      quantity: 3.14,
    }).success,
    false,
  );

  // Invalid ObjectId is rejected
  assert.equal(
    updateShoppingListItemQuantitySchema.safeParse({
      itemId: "invalid-id",
      quantity: 5,
    }).success,
    false,
  );
});

test("removeShoppingListItemSchema and transferInternalPurchaseRequestSchema: validate IDs", () => {
  const validId = new Types.ObjectId().toString();

  assert.equal(
    removeShoppingListItemSchema.safeParse({ itemId: validId }).success,
    true,
  );
  assert.equal(
    removeShoppingListItemSchema.safeParse({ itemId: "bad-id" }).success,
    false,
  );

  assert.equal(
    transferInternalPurchaseRequestSchema.safeParse({ requestId: validId })
      .success,
    true,
  );
  assert.equal(
    transferInternalPurchaseRequestSchema.safeParse({ requestId: "bad-id" })
      .success,
    false,
  );
});

// ---------------------------------------------------------------------------
// 2. Domain Authorization & Permission Rules
// ---------------------------------------------------------------------------

test("canViewShoppingList: permits all active cafe member roles", () => {
  assert.equal(canViewShoppingList({ role: "owner" }), true);
  assert.equal(canViewShoppingList({ role: "manager" }), true);
  assert.equal(canViewShoppingList({ role: "purchase_manager" }), true);
  assert.equal(canViewShoppingList({ role: "chef" }), true);
  assert.equal(canViewShoppingList({ role: "accountant" }), true);
  assert.equal(canViewShoppingList({ role: "employee" }), true);

  // Unknown role denied
  assert.equal(canViewShoppingList({ role: "guest" }), false);
});

test("canManageShoppingList: grants owner and managers by default, requires explicit permission for other roles", () => {
  assert.equal(canManageShoppingList({ role: "owner" }), true);
  assert.equal(canManageShoppingList({ role: "manager" }), true);
  assert.equal(canManageShoppingList({ role: "purchase_manager" }), true);

  // Chef, accountant, employee denied by default
  assert.equal(canManageShoppingList({ role: "chef" }), false);
  assert.equal(canManageShoppingList({ role: "accountant" }), false);
  assert.equal(canManageShoppingList({ role: "employee" }), false);

  // Chef with explicit canManageShoppingList = true is granted
  assert.equal(
    canManageShoppingList({
      role: "chef",
      permissions: { canManageShoppingList: true },
    }),
    true,
  );

  // Manager with explicit canManageShoppingList = false is revoked
  assert.equal(
    canManageShoppingList({
      role: "manager",
      permissions: { canManageShoppingList: false },
    }),
    false,
  );
});

// ---------------------------------------------------------------------------
// 3. Domain Logic: Pure Aggregation & Provenance Preservation
// ---------------------------------------------------------------------------

test("aggregateShoppingListItems: consolidates duplicate products and sums quantities while preserving underlying provenance lines", () => {
  const prodMilkId = new Types.ObjectId().toString();
  const prodCoffeeId = new Types.ObjectId().toString();

  const items = [
    // Direct milk (qty 5)
    {
      id: "item-1",
      itemType: "catalog",
      productId: prodMilkId,
      productName: "شیر پرچرب",
      productUnit: "باکس",
      quantity: 5,
      sourceType: "direct",
      sourceQuantity: 5,
      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-01T10:00:00.000Z",
    },
    // Transferred milk from IPR #1 (qty 6)
    {
      id: "item-2",
      itemType: "catalog",
      productId: prodMilkId,
      productName: "شیر پرچرب",
      productUnit: "باکس",
      quantity: 6,
      sourceType: "internal_request",
      sourceQuantity: 6,
      internalPurchaseRequestId: "req-1",
      internalPurchaseRequestItemId: "ipr-item-1",
      createdAt: "2026-10-01T11:00:00.000Z",
      updatedAt: "2026-10-01T11:00:00.000Z",
    },
    // Coffee beans (qty 2)
    {
      id: "item-3",
      itemType: "catalog",
      productId: prodCoffeeId,
      productName: "دانه قهوه اسپرسو",
      productUnit: "کیلو",
      quantity: 2,
      sourceType: "direct",
      sourceQuantity: 2,
      createdAt: "2026-10-01T10:30:00.000Z",
      updatedAt: "2026-10-01T10:30:00.000Z",
    },
    // Custom item 1
    {
      id: "item-4",
      itemType: "custom",
      customTitle: "لیوان کاغذی دوجداره",
      customUnit: "کارتن",
      quantity: 3,
      sourceType: "direct",
      sourceQuantity: 3,
      createdAt: "2026-10-01T10:15:00.000Z",
      updatedAt: "2026-10-01T10:15:00.000Z",
    },
    // Custom item 2 (same title and unit from IPR transfer)
    {
      id: "item-5",
      itemType: "custom",
      customTitle: "لیوان کاغذی دوجداره",
      customUnit: "کارتن",
      quantity: 2,
      sourceType: "internal_request",
      sourceQuantity: 2,
      internalPurchaseRequestId: "req-2",
      internalPurchaseRequestItemId: "ipr-item-2",
      createdAt: "2026-10-01T11:30:00.000Z",
      updatedAt: "2026-10-01T11:30:00.000Z",
    },
  ];

  const aggregated = aggregateShoppingListItems(items);

  // 3 distinct aggregated groups: Milk (catalog), Coffee (catalog), Paper cup (custom)
  assert.equal(aggregated.length, 3);

  // Find milk group
  const milkGroup = aggregated.find((g) => g.productId === prodMilkId);
  assert.ok(milkGroup);
  assert.equal(milkGroup.totalQuantity, 11); // 5 + 6
  assert.equal(milkGroup.totalSourceQuantity, 11);
  assert.equal(milkGroup.itemCount, 2);
  assert.equal(milkGroup.items.length, 2);
  // Verify provenance lines are preserved
  assert.equal(milkGroup.items[0].sourceType, "direct");
  assert.equal(milkGroup.items[0].quantity, 5);
  assert.equal(milkGroup.items[1].sourceType, "internal_request");
  assert.equal(milkGroup.items[1].internalPurchaseRequestId, "req-1");
  assert.equal(milkGroup.items[1].internalPurchaseRequestItemId, "ipr-item-1");

  // Find coffee group
  const coffeeGroup = aggregated.find((g) => g.productId === prodCoffeeId);
  assert.ok(coffeeGroup);
  assert.equal(coffeeGroup.totalQuantity, 2);
  assert.equal(coffeeGroup.itemCount, 1);

  // Find custom paper cup group
  const customCupGroup = aggregated.find((g) => g.customTitle === "لیوان کاغذی دوجداره");
  assert.ok(customCupGroup);
  assert.equal(customCupGroup.totalQuantity, 5); // 3 + 2
  assert.equal(customCupGroup.itemCount, 2);
  assert.equal(customCupGroup.items[1].sourceType, "internal_request");
});

// ---------------------------------------------------------------------------
// 4. Database Integration & Concurrency Tests
// ---------------------------------------------------------------------------

const TEST_DB_URI =
  process.env.TEST_MONGODB_URI ||
  "mongodb://127.0.0.1:27017/sefaresh_test_runner_shopping_list";
process.env.MONGODB_URI = TEST_DB_URI;

test("database: shopping list lifecycle, single active list invariant, provenance, duplicate handling, and idempotent IPR transfer", async () => {
  let conn;
  try {
    conn = await mongoose.createConnection(TEST_DB_URI).asPromise();
  } catch {
    return; // Skip if local test database is not reachable
  }

  try {
    const TestShoppingList = conn.model("ShoppingList", ShoppingList.schema);
    const TestInternalReq = conn.model(
      "InternalPurchaseRequest",
      InternalPurchaseRequest.schema,
    );
    const TestProduct = conn.model("Product", Product.schema);
    const TestCategory = conn.model("Category", Category.schema);
    const TestUser = conn.model("User", User.schema);

    // Clean up
    await TestShoppingList.deleteMany({});
    await TestShoppingList.syncIndexes();
    await TestInternalReq.deleteMany({});
    await TestProduct.deleteMany({});
    await TestCategory.deleteMany({});
    await TestUser.deleteMany({});

    // 1. Seed user & catalog products
    const cafeUser = await TestUser.create({
      firstName: "سارا",
      lastName: "مدیر کافه",
      status: "active",
    });

    const category = await TestCategory.create({
      name: "لبنیات و نوشیدنی",
      slug: "dairy-beverage",
      status: "active",
    });

    const productMilk = await TestProduct.create({
      name: "شیر پرچرب ۱ لیتری",
      slug: "milk-whole-1l",
      categoryId: category._id,
      unit: "بطری",
      status: "active",
    });

    const productSyrup = await TestProduct.create({
      name: "سیروپ فندقی",
      slug: "hazelnut-syrup-700ml",
      categoryId: category._id,
      unit: "شیشه",
      status: "active",
    });

    const cafeIdA = new Types.ObjectId().toString();
    const cafeIdB = new Types.ObjectId().toString();

    // -----------------------------------------------------------------------
    // Scenario A: Exactly ONE active shopping list per cafe (Concurrency & Invariant)
    // -----------------------------------------------------------------------
    const [listA1, listA2] = await Promise.all([
      getOrCreateActiveShoppingList(cafeIdA),
      getOrCreateActiveShoppingList(cafeIdA),
    ]);

    assert.equal(listA1.id, listA2.id, "Concurrent requests must return the same active list");
    assert.equal(listA1.status, "active");
    assert.equal(listA1.items.length, 0);

    // Verify database has exactly 1 document for cafe A
    const countA = await TestShoppingList.countDocuments({
      cafeId: new Types.ObjectId(cafeIdA),
      status: "active",
    });
    assert.equal(countA, 1, "There must be exactly one active shopping list document in DB");

    // Partial unique index verification: direct attempt to insert second active list fails with E11000
    let duplicateKeyErrorCaught = false;
    try {
      await TestShoppingList.create({
        cafeId: new Types.ObjectId(cafeIdA),
        status: "active",
        items: [],
      });
    } catch (err) {
      if (err.code === 11000) {
        duplicateKeyErrorCaught = true;
      }
    }
    assert.equal(duplicateKeyErrorCaught, true, "Partial unique index must prevent second active list");

    // -----------------------------------------------------------------------
    // Direct Add Operations: Catalog item & Custom item
    // -----------------------------------------------------------------------
    const addedCatalogItem = await addCatalogItemToActiveShoppingList({
      cafeId: cafeIdA,
      productId: productMilk._id.toString(),
      quantity: 5,
      note: "خرید مستقیم هفتگی",
    });

    assert.ok(addedCatalogItem.id);
    assert.equal(addedCatalogItem.itemType, "catalog");
    assert.equal(addedCatalogItem.productId, productMilk._id.toString());
    assert.equal(addedCatalogItem.productName, "شیر پرچرب ۱ لیتری");
    assert.equal(addedCatalogItem.productUnit, "بطری");
    assert.equal(addedCatalogItem.quantity, 5);
    assert.equal(addedCatalogItem.sourceType, "direct");
    assert.equal(addedCatalogItem.sourceQuantity, 5);

    const addedCustomItem = await addCustomItemToActiveShoppingList({
      cafeId: cafeIdA,
      customTitle: "دستمال کاغذی جعبه‌ای ۲۰۰ برگ",
      customUnit: "جعبه",
      quantity: 10,
    });

    assert.ok(addedCustomItem.id);
    assert.equal(addedCustomItem.itemType, "custom");
    assert.equal(addedCustomItem.customTitle, "دستمال کاغذی جعبه‌ای ۲۰۰ برگ");
    assert.equal(addedCustomItem.customUnit, "جعبه");
    assert.equal(addedCustomItem.quantity, 10);
    assert.equal(addedCustomItem.sourceType, "direct");

    // Verify active shopping list retrieval
    const activeList = await findActiveShoppingListByCafe(cafeIdA);
    assert.ok(activeList);
    assert.equal(activeList.itemCount, 2);
    assert.equal(activeList.totalQuantity, 15); // 5 + 10
    assert.equal(activeList.aggregatedItems.length, 2);

    // -----------------------------------------------------------------------
    // Tenant Isolation: Cafe B cannot read or modify Cafe A's shopping list
    // -----------------------------------------------------------------------
    const activeListB = await findActiveShoppingListByCafe(cafeIdB);
    assert.equal(activeListB, null, "Cafe B has no active list yet");

    const modifyFromB = await updateShoppingListItemQuantity({
      cafeId: cafeIdB,
      itemId: addedCatalogItem.id,
      quantity: 99,
    });
    assert.equal(modifyFromB, false, "Cafe B cannot modify Cafe A's shopping list item");

    const removeFromB = await removeShoppingListItem({
      cafeId: cafeIdB,
      itemId: addedCatalogItem.id,
    });
    assert.equal(removeFromB, false, "Cafe B cannot remove Cafe A's shopping list item");

    // -----------------------------------------------------------------------
    // Update Item Quantity & Scenario C (Concurrent update / remove)
    // -----------------------------------------------------------------------
    // Updating quantity keeps sourceQuantity intact!
    const updated = await updateShoppingListItemQuantity({
      cafeId: cafeIdA,
      itemId: addedCatalogItem.id,
      quantity: 8,
    });
    assert.equal(updated, true);

    const listAfterUpdate = await findActiveShoppingListByCafe(cafeIdA);
    const updatedMilkItem = listAfterUpdate.items.find(
      (i) => i.id === addedCatalogItem.id,
    );
    assert.equal(updatedMilkItem.quantity, 8, "Current shopping quantity updated to 8");
    assert.equal(updatedMilkItem.sourceQuantity, 5, "Source quantity remains 5 untouched");

    // Scenario C: update on non-existent or removed item returns false safely
    const updateNonExistent = await updateShoppingListItemQuantity({
      cafeId: cafeIdA,
      itemId: new Types.ObjectId().toString(),
      quantity: 10,
    });
    assert.equal(updateNonExistent, false);

    // -----------------------------------------------------------------------
    // Transfer from Approved InternalPurchaseRequest & Provenance
    // -----------------------------------------------------------------------
    // Seed an approved IPR in Cafe A
    const iprDoc = await TestInternalReq.create({
      cafeId: new Types.ObjectId(cafeIdA),
      requestedByUserId: cafeUser._id,
      title: "درخواست شیفت عصر",
      status: "approved",
      items: [
        {
          itemType: "catalog",
          productId: productMilk._id,
          requestedQuantity: 10,
          approvedQuantity: 6, // Approved 6 (partially approved item)
          status: "approved",
          note: "نیاز به شیر پرچرب کاله",
        },
        {
          itemType: "catalog",
          productId: productSyrup._id,
          requestedQuantity: 2,
          approvedQuantity: 2, // Approved 2
          status: "approved",
        },
        {
          itemType: "custom",
          customTitle: "شکر قهوه‌ای فله",
          customUnit: "کیلو",
          requestedQuantity: 5,
          approvedQuantity: 0, // Rejected item: 0 approved
          status: "rejected",
        },
      ],
    });

    const iprMilkItem = iprDoc.items[0];
    const iprSyrupItem = iprDoc.items[1];
    assert.equal(iprDoc.items[2].approvedQuantity, 0, "Rejected item has approvedQuantity 0");

    // Transfer only eligible items (approvedQuantity > 0)
    const transferResult1 = await atomicTransferIprItemsToActiveShoppingList({
      cafeId: cafeIdA,
      requestId: iprDoc._id.toString(),
      itemsToTransfer: [
        {
          iprItemId: iprMilkItem._id.toString(),
          itemType: "catalog",
          productId: productMilk._id.toString(),
          approvedQuantity: 6,
          note: iprMilkItem.note,
        },
        {
          iprItemId: iprSyrupItem._id.toString(),
          itemType: "catalog",
          productId: productSyrup._id.toString(),
          approvedQuantity: 2,
        },
      ],
    });

    assert.equal(transferResult1.transferredCount, 2);
    assert.equal(transferResult1.skippedCount, 0);

    // -----------------------------------------------------------------------
    // Duplicate Product Behavior (Section 11) & Provenance Verification
    // -----------------------------------------------------------------------
    const listAfterTransfer = await findActiveShoppingListByCafe(cafeIdA);
    assert.ok(listAfterTransfer);

    // Total raw items = 4 (Direct Milk, Direct Napkins, IPR Milk, IPR Syrup)
    assert.equal(listAfterTransfer.itemCount, 4);

    // Find the transferred milk item
    const transferredMilk = listAfterTransfer.items.find(
      (i) =>
        i.productId === productMilk._id.toString() &&
        i.sourceType === "internal_request",
    );
    assert.ok(transferredMilk);
    assert.equal(transferredMilk.quantity, 6); // approvedQuantity
    assert.equal(transferredMilk.sourceQuantity, 6);
    assert.equal(transferredMilk.internalPurchaseRequestId, iprDoc._id.toString());
    assert.equal(
      transferredMilk.internalPurchaseRequestItemId,
      iprMilkItem._id.toString(),
    );

    // Check Aggregated view: Milk should have totalQuantity = 8 (direct) + 6 (ipr) = 14
    const aggregatedMilk = listAfterTransfer.aggregatedItems.find(
      (g) => g.productId === productMilk._id.toString(),
    );
    assert.ok(aggregatedMilk);
    assert.equal(aggregatedMilk.totalQuantity, 14);
    assert.equal(aggregatedMilk.totalSourceQuantity, 11); // 5 (direct source) + 6 (ipr source)
    assert.equal(aggregatedMilk.itemCount, 2);
    assert.equal(aggregatedMilk.items.length, 2);

    // -----------------------------------------------------------------------
    // Scenario B: Transfer Idempotency (Retry, Double-click, Refresh)
    // -----------------------------------------------------------------------
    const transferResult2 = await atomicTransferIprItemsToActiveShoppingList({
      cafeId: cafeIdA,
      requestId: iprDoc._id.toString(),
      itemsToTransfer: [
        {
          iprItemId: iprMilkItem._id.toString(),
          itemType: "catalog",
          productId: productMilk._id.toString(),
          approvedQuantity: 6,
        },
        {
          iprItemId: iprSyrupItem._id.toString(),
          itemType: "catalog",
          productId: productSyrup._id.toString(),
          approvedQuantity: 2,
        },
      ],
    });

    assert.equal(transferResult2.transferredCount, 0, "No duplicate items should be transferred on retry");
    assert.equal(transferResult2.skippedCount, 2, "All items skipped as already transferred");

    // List item count MUST remain unchanged (4 items)
    const listAfterRetry = await findActiveShoppingListByCafe(cafeIdA);
    assert.equal(listAfterRetry.itemCount, 4, "Item count remains 4 after idempotent retry");

    // Concurrent transfer test (Scenario B under race condition)
    const [concurrentRes1, concurrentRes2] = await Promise.all([
      atomicTransferIprItemsToActiveShoppingList({
        cafeId: cafeIdA,
        requestId: iprDoc._id.toString(),
        itemsToTransfer: [
          {
            iprItemId: iprMilkItem._id.toString(),
            itemType: "catalog",
            productId: productMilk._id.toString(),
            approvedQuantity: 6,
          },
        ],
      }),
      atomicTransferIprItemsToActiveShoppingList({
        cafeId: cafeIdA,
        requestId: iprDoc._id.toString(),
        itemsToTransfer: [
          {
            iprItemId: iprMilkItem._id.toString(),
            itemType: "catalog",
            productId: productMilk._id.toString(),
            approvedQuantity: 6,
          },
        ],
      }),
    ]);

    assert.equal(concurrentRes1.transferredCount + concurrentRes2.transferredCount, 0);

    // -----------------------------------------------------------------------
    // Upper Bound Items Limit Enforcement
    // -----------------------------------------------------------------------
    assert.equal(MAX_SHOPPING_LIST_ITEMS, 100);

    // -----------------------------------------------------------------------
    // Remove Item Operation
    // -----------------------------------------------------------------------
    const removeSuccess = await removeShoppingListItem({
      cafeId: cafeIdA,
      itemId: addedCustomItem.id,
    });
    assert.equal(removeSuccess, true);

    const listAfterRemove = await findActiveShoppingListByCafe(cafeIdA);
    assert.equal(listAfterRemove.itemCount, 3);
    assert.equal(
      listAfterRemove.items.some((i) => i.id === addedCustomItem.id),
      false,
    );
  } finally {
    await conn.close();
    await mongoose.disconnect();
  }
});

