import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export const transactionTypeValues = [
  "payment_received",
  "supplier_payable_created",
  "supplier_settlement_paid",
] as const;
export type TransactionType = (typeof transactionTypeValues)[number];

export const transactionDirectionValues = ["credit", "debit"] as const;
export type TransactionDirection = (typeof transactionDirectionValues)[number];

const transactionSchema = new Schema(
  {
    transactionNumber: {
      type: String,
      required: true,
      trim: true,
    },
    cafeId: {
      type: Schema.Types.ObjectId,
      ref: "Cafe",
      default: null,
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
      index: true,
    },
    payableId: {
      type: Schema.Types.ObjectId,
      ref: "SupplierPayable",
      default: null,
      index: true,
    },
    settlementId: {
      type: Schema.Types.ObjectId,
      ref: "SupplierSettlement",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: transactionTypeValues,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: (v: number) => Number.isSafeInteger(v) && v > 0,
        message: "مبلغ تراکنش باید عدد صحیح مثبت به تومان باشد",
      },
    },
    direction: {
      type: String,
      enum: transactionDirectionValues,
      required: true,
    },
    referenceNumber: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: false,
  },
);

// ---------------------------------------------------------------------------
// Indexes:
// 1. Unique human-readable transactionNumber
// 2. Idempotency unique constraints per source financial event
// 3. Tenant query indexes
// ---------------------------------------------------------------------------
transactionSchema.index({ transactionNumber: 1 }, { unique: true });

// Ensure a single payment_received entry per payment
transactionSchema.index(
  { paymentId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { paymentId: { $type: "objectId" } },
  },
);

// Ensure a single supplier_payable_created entry per payable
transactionSchema.index(
  { payableId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { payableId: { $type: "objectId" } },
  },
);

// Ensure a single supplier_settlement_paid entry per settlement
transactionSchema.index(
  { settlementId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { settlementId: { $type: "objectId" } },
  },
);

transactionSchema.index({ cafeId: 1, createdAt: -1 });
transactionSchema.index({ supplierId: 1, createdAt: -1 });
transactionSchema.index({ type: 1, createdAt: -1 });

export const Transaction =
  models.Transaction || model("Transaction", transactionSchema);
