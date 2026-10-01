import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export const internalRequestStatusValues = [
  "pending",
  "approved",
  "partially_approved",
  "rejected",
  "cancelled",
] as const;

export type InternalRequestStatus =
  (typeof internalRequestStatusValues)[number];

export const internalRequestItemStatusValues = [
  "pending",
  "approved",
  "partially_approved",
  "rejected",
] as const;

export type InternalRequestItemStatus =
  (typeof internalRequestItemStatusValues)[number];

const internalPurchaseRequestItemSchema = new Schema(
  {
    itemType: {
      type: String,
      enum: ["catalog", "custom"],
      required: true,
    },

    // For catalog items: points to Product catalog (unit is obtained from Product)
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

    requestedQuantity: {
      type: Number,
      required: true,
      min: 1,
    },

    approvedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: internalRequestItemStatusValues,
      default: "pending",
      required: true,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },
  },
  {
    _id: true,
  },
);

const internalPurchaseRequestSchema = new Schema(
  {
    cafeId: {
      type: Schema.Types.ObjectId,
      ref: "Cafe",
      required: true,
      index: true,
    },

    requestedByUserId: {
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

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    status: {
      type: String,
      enum: internalRequestStatusValues,
      default: "pending",
      required: true,
      index: true,
    },

    items: {
      type: [internalPurchaseRequestItemSchema],
      required: true,
      validate: [
        (items: unknown[]) => Array.isArray(items) && items.length > 0,
        "حداقل یک قلم برای ثبت درخواست الزامی است",
      ],
    },

    reviewedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
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

// Compound index for querying a cafe's requests with stable descending order
internalPurchaseRequestSchema.index({
  cafeId: 1,
  createdAt: -1,
  _id: -1,
});

// Compound index for querying a cafe's requests filtered by status
internalPurchaseRequestSchema.index({
  cafeId: 1,
  status: 1,
  createdAt: -1,
  _id: -1,
});

// Index for listing requests requested by a specific user within a cafe
internalPurchaseRequestSchema.index({
  cafeId: 1,
  requestedByUserId: 1,
  createdAt: -1,
});

export const InternalPurchaseRequest =
  models.InternalPurchaseRequest ||
  model("InternalPurchaseRequest", internalPurchaseRequestSchema);
