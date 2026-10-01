import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export const supplierResponseItemStatusValues = [
  "quoted",
  "unavailable",
] as const;
export type SupplierResponseItemStatus =
  (typeof supplierResponseItemStatusValues)[number];

const supplierResponseItemSchema = new Schema(
  {
    purchaseRequestItemId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    status: {
      type: String,
      enum: supplierResponseItemStatusValues,
      required: true,
    },
    unitPrice: {
      type: Number,
      default: null,
      min: 1,
    },
    confirmedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    itemSubtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },
  },
  { _id: true },
);

const supplierResponseSchema = new Schema(
  {
    supplierRequestId: {
      type: Schema.Types.ObjectId,
      ref: "SupplierRequest",
      required: true,
    },
    purchaseRequestId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseRequest",
      required: true,
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    cafeId: {
      type: Schema.Types.ObjectId,
      ref: "Cafe",
      required: true,
      index: true,
    },
    respondedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deliveryDays: {
      type: Number,
      required: true,
      min: 0,
    },
    shippingCost: {
      type: Number,
      required: true,
      min: 0,
    },
    itemSubtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    estimatedTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    items: {
      type: [supplierResponseItemSchema],
      required: true,
      validate: [
        (items: unknown[]) => Array.isArray(items) && items.length > 0,
        "حداقل یک قلم در پاسخ تأمین‌کننده الزامی است",
      ],
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    respondedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// ---------------------------------------------------------------------------
// Indexes:
// 1. Compound unique index: guarantees at most one SupplierResponse per SupplierRequest
// 2. Query index for Cafe RFQ Comparison: batch read all responses for a PurchaseRequest
// 3. Query index for Supplier history / responses
// 4. Query index for Cafe tenant isolation
// ---------------------------------------------------------------------------

supplierResponseSchema.index(
  { supplierRequestId: 1 },
  { unique: true },
);

supplierResponseSchema.index({
  purchaseRequestId: 1,
  createdAt: -1,
});

supplierResponseSchema.index({
  supplierId: 1,
  createdAt: -1,
});

supplierResponseSchema.index({
  cafeId: 1,
  createdAt: -1,
});

export const SupplierResponse =
  models.SupplierResponse || model("SupplierResponse", supplierResponseSchema);
