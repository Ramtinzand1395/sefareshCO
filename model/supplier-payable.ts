import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export const supplierPayableStatusValues = [
  "pending",
  "eligible",
  "settled",
  "cancelled",
] as const;
export type SupplierPayableStatus =
  (typeof supplierPayableStatusValues)[number];

const supplierPayableSchema = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
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
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      index: true,
    },
    grossAmount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: (v: number) => Number.isSafeInteger(v) && v > 0,
        message: "مبلغ ناخالص پرداختنی باید عدد صحیح مثبت به تومان باشد",
      },
    },
    platformFee: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: (v: number) => Number.isSafeInteger(v) && v >= 0,
        message: "کارمزد پلتفرم باید عدد صحیح نامنفی به تومان باشد",
      },
    },
    netAmount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: (v: number) => Number.isSafeInteger(v) && v > 0,
        message: "مبلغ خالص پرداختنی باید عدد صحیح مثبت به تومان باشد",
      },
    },
    status: {
      type: String,
      enum: supplierPayableStatusValues,
      default: "pending",
      required: true,
      index: true,
    },
    settlementId: {
      type: Schema.Types.ObjectId,
      ref: "SupplierSettlement",
      default: null,
      index: true,
    },
    eligibleAt: {
      type: Date,
      default: null,
    },
    settledAt: {
      type: Date,
      default: null,
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
// 1. Unique index on orderId (one payable per order invariant)
// 2. Query indexes for supplier dashboard and settlement processing
// ---------------------------------------------------------------------------
supplierPayableSchema.index({ orderId: 1 }, { unique: true });
supplierPayableSchema.index({ supplierId: 1, status: 1, createdAt: -1 });
supplierPayableSchema.index({ supplierId: 1, settlementId: 1 });
supplierPayableSchema.index({ cafeId: 1, createdAt: -1 });
supplierPayableSchema.index({ status: 1, createdAt: -1 });

export const SupplierPayable =
  models.SupplierPayable ||
  model("SupplierPayable", supplierPayableSchema);
