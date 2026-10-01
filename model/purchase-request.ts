import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export const purchaseRequestStatusValues = [
  "draft",
  "submitted",
  "cancelled",
] as const;
export type PurchaseRequestStatus =
  (typeof purchaseRequestStatusValues)[number];

export const purchaseRequestItemTypeValues = ["catalog", "custom"] as const;
export type PurchaseRequestItemType =
  (typeof purchaseRequestItemTypeValues)[number];

const purchaseRequestAllocationSchema = new Schema(
  {
    shoppingListItemId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false },
);

const productSnapshotSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
      default: null,
    },
    categoryName: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { _id: false },
);

const purchaseRequestItemSchema = new Schema(
  {
    itemType: {
      type: String,
      enum: purchaseRequestItemTypeValues,
      required: true,
    },

    // For catalog items:
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    productSnapshot: {
      type: productSnapshotSchema,
      default: null,
    },

    // For custom items:
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

    // Total requested quantity in this RFQ
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },

    // Provenance / allocation to shopping list raw item lines
    allocations: {
      type: [purchaseRequestAllocationSchema],
      required: true,
      validate: [
        (arr: unknown[]) => Array.isArray(arr) && arr.length > 0,
        "حداقل یک تخصیص از لیست خرید الزامی است",
      ],
    },
  },
  { _id: true },
);

const purchaseRequestSchema = new Schema(
  {
    cafeId: {
      type: Schema.Types.ObjectId,
      ref: "Cafe",
      required: true,
      index: true,
    },

    referenceNumber: {
      type: String,
      required: true,
      trim: true,
    },

    createdByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      trim: true,
      maxlength: 150,
      default: null,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    neededByDate: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: purchaseRequestStatusValues,
      default: "draft",
      required: true,
      index: true,
    },

    items: {
      type: [purchaseRequestItemSchema],
      required: true,
      validate: [
        (items: unknown[]) => Array.isArray(items) && items.length > 0,
        "حداقل یک قلم برای ثبت استعلام قیمت الزامی است",
      ],
    },

    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 128,
      default: null,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    cancelledByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancelReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// ---------------------------------------------------------------------------
// Indexes:
// 1. Unique index on human-readable RFQ reference number
// 2. Compound index for querying cafe requests ordered chronologically
// 3. Compound index for querying cafe requests filtered by status
// 4. Sparse unique index on cafeId + idempotencyKey to prevent duplicate requests
// 5. Multikey index on items.allocations.shoppingListItemId for active allocations
// ---------------------------------------------------------------------------

purchaseRequestSchema.index({ referenceNumber: 1 }, { unique: true });

purchaseRequestSchema.index({
  cafeId: 1,
  createdAt: -1,
  _id: -1,
});

purchaseRequestSchema.index({
  cafeId: 1,
  status: 1,
  createdAt: -1,
  _id: -1,
});

purchaseRequestSchema.index(
  {
    cafeId: 1,
    idempotencyKey: 1,
  },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  },
);

purchaseRequestSchema.index({
  cafeId: 1,
  "items.allocations.shoppingListItemId": 1,
});

export const PurchaseRequest =
  models.PurchaseRequest ||
  model("PurchaseRequest", purchaseRequestSchema);
