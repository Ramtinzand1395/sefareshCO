import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const selectionItemSchema = new Schema(
  {
    purchaseRequestItemId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    supplierRequestId: {
      type: Schema.Types.ObjectId,
      ref: "SupplierRequest",
      required: true,
    },
    supplierResponseId: {
      type: Schema.Types.ObjectId,
      ref: "SupplierResponse",
      required: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    selectedQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 1,
    },
    itemSubtotal: {
      type: Number,
      required: true,
      min: 1,
    },
    supplierResponseUpdatedAt: {
      type: Date,
      required: true,
    },
  },
  { _id: true },
);

const selectionSupplierGroupSchema = new Schema(
  {
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    supplierResponseId: {
      type: Schema.Types.ObjectId,
      ref: "SupplierResponse",
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
    itemsSubtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    supplierTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const selectionTotalsSchema = new Schema(
  {
    selectedItemCount: {
      type: Number,
      required: true,
      min: 0,
    },
    fullySelectedItemCount: {
      type: Number,
      required: true,
      min: 0,
    },
    partiallySelectedItemCount: {
      type: Number,
      required: true,
      min: 0,
    },
    unselectedItemCount: {
      type: Number,
      required: true,
      min: 0,
    },
    estimatedItemsTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    shippingTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    estimatedTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const purchaseRequestSelectionSchema = new Schema(
  {
    purchaseRequestId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseRequest",
      required: true,
    },
    cafeId: {
      type: Schema.Types.ObjectId,
      ref: "Cafe",
      required: true,
    },
    selectedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    items: {
      type: [selectionItemSchema],
      default: [],
    },
    supplierGroups: {
      type: [selectionSupplierGroupSchema],
      default: [],
    },
    totals: {
      type: selectionTotalsSchema,
      required: true,
    },
    isFinalized: {
      type: Boolean,
      default: false,
    },
    finalizedAt: {
      type: Date,
      default: null,
    },
    finalizedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// ---------------------------------------------------------------------------
// Indexes:
// 1. Unique index on purchaseRequestId ensures at most one active Selection per RFQ.
// 2. Compound index on { cafeId: 1, createdAt: -1 } for tenant-scoped querying.
// ---------------------------------------------------------------------------
purchaseRequestSelectionSchema.index(
  { purchaseRequestId: 1 },
  { unique: true },
);

purchaseRequestSelectionSchema.index({
  cafeId: 1,
  createdAt: -1,
});

export const PurchaseRequestSelection =
  models.PurchaseRequestSelection ||
  model("PurchaseRequestSelection", purchaseRequestSelectionSchema);
