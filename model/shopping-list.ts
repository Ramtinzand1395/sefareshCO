import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export const shoppingListStatusValues = ["active", "archived"] as const;
export type ShoppingListStatus = (typeof shoppingListStatusValues)[number];

export const shoppingListItemTypeValues = ["catalog", "custom"] as const;
export type ShoppingListItemType = (typeof shoppingListItemTypeValues)[number];

export const shoppingListSourceTypeValues = [
  "direct",
  "internal_request",
] as const;
export type ShoppingListSourceType =
  (typeof shoppingListSourceTypeValues)[number];

const shoppingListItemSchema = new Schema(
  {
    itemType: {
      type: String,
      enum: shoppingListItemTypeValues,
      required: true,
    },

    // For catalog items: reference to Product catalog
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    // For custom items: custom title and custom unit
    customTitle: {
      type: String,
      trim: true,
      maxlength: 150,
      default: null,
    },

    customUnit: {
      type: String,
      trim: true,
      maxlength: 50,
      default: null,
    },

    // Current shopping quantity (workspace quantity, positive integer)
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    // Provenance: origin of the item
    sourceType: {
      type: String,
      enum: shoppingListSourceTypeValues,
      required: true,
      default: "direct",
    },

    // Original quantity from the source (e.g. approvedQuantity from IPR)
    sourceQuantity: {
      type: Number,
      required: true,
      min: 1,
    },

    // References to source InternalPurchaseRequest if sourceType === "internal_request"
    internalPurchaseRequestId: {
      type: Schema.Types.ObjectId,
      ref: "InternalPurchaseRequest",
      default: null,
    },

    internalPurchaseRequestItemId: {
      type: Schema.Types.ObjectId,
      default: null,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  },
);

const shoppingListSchema = new Schema(
  {
    cafeId: {
      type: Schema.Types.ObjectId,
      ref: "Cafe",
      required: true,
    },

    status: {
      type: String,
      enum: shoppingListStatusValues,
      default: "active",
      required: true,
    },

    lockId: {
      type: String,
      default: null,
    },

    lockExpiresAt: {
      type: Date,
      default: null,
    },

    items: {
      type: [shoppingListItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// ---------------------------------------------------------------------------
// Indexes:
// 1. Partial unique index to enforce exactly ONE active shopping list per cafe.
// 2. Compound index for querying cafe shopping lists by status and update time.
// 3. Multikey index on items.internalPurchaseRequestItemId for fast idempotency lookup.
// 4. Multikey index on items.productId for product hydration and lookups.
// ---------------------------------------------------------------------------

shoppingListSchema.index(
  { cafeId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
  },
);

shoppingListSchema.index({
  cafeId: 1,
  status: 1,
  updatedAt: -1,
});

shoppingListSchema.index({
  "items.internalPurchaseRequestItemId": 1,
});

shoppingListSchema.index({
  "items.productId": 1,
});

export const ShoppingList =
  models.ShoppingList || model("ShoppingList", shoppingListSchema);
