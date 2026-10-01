import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export const supplierRequestStatusValues = ["pending", "cancelled"] as const;
export type SupplierRequestStatus =
  (typeof supplierRequestStatusValues)[number];

const supplierRequestItemProductSnapshotSchema = new Schema(
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

const supplierRequestItemSchema = new Schema(
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
    matchedSupplierOfferId: {
      type: Schema.Types.ObjectId,
      ref: "SupplierOffer",
      default: null,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    productSnapshot: {
      type: supplierRequestItemProductSnapshotSchema,
      required: true,
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

const supplierRequestSchema = new Schema(
  {
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
    status: {
      type: String,
      enum: supplierRequestStatusValues,
      default: "pending",
      required: true,
      index: true,
    },
    items: {
      type: [supplierRequestItemSchema],
      required: true,
      validate: [
        (items: unknown[]) => Array.isArray(items) && items.length > 0,
        "حداقل یک قلم برای درخواست به تأمین‌کننده الزامی است",
      ],
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// ---------------------------------------------------------------------------
// Indexes:
// 1. Compound unique index: guarantees at most one SupplierRequest per RFQ + Supplier
// 2. Query index for Supplier Inbox (/supplier/requests)
// 3. Query index for Cafe RFQ detail / history
// 4. Scoped query index for Cafe tenant
// ---------------------------------------------------------------------------

supplierRequestSchema.index(
  { purchaseRequestId: 1, supplierId: 1 },
  { unique: true },
);

supplierRequestSchema.index({
  supplierId: 1,
  status: 1,
  createdAt: -1,
});

supplierRequestSchema.index({
  purchaseRequestId: 1,
  createdAt: -1,
});

supplierRequestSchema.index({
  cafeId: 1,
  createdAt: -1,
});

export const SupplierRequest =
  models.SupplierRequest || model("SupplierRequest", supplierRequestSchema);
