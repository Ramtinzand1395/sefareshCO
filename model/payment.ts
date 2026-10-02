import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export const paymentStatusValues = [
  "pending",
  "paid",
  "failed",
  "cancelled",
] as const;
export type PaymentStatus = (typeof paymentStatusValues)[number];

export const paymentMethodValues = ["online", "manual"] as const;
export type PaymentMethod = (typeof paymentMethodValues)[number];

export const paymentProviderValues = ["mock", "manual"] as const;
export type PaymentProvider = (typeof paymentProviderValues)[number];

const paymentSchema = new Schema(
  {
    cafeId: {
      type: Schema.Types.ObjectId,
      ref: "Cafe",
      required: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: (v: number) => Number.isSafeInteger(v) && v > 0,
        message: "مبلغ پرداخت باید عدد صحیح مثبت به تومان باشد",
      },
    },
    status: {
      type: String,
      enum: paymentStatusValues,
      default: "pending",
      required: true,
      index: true,
    },
    method: {
      type: String,
      enum: paymentMethodValues,
      default: "online",
      required: true,
    },
    paymentReference: {
      type: String,
      required: true,
      trim: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
    },
    initiatedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    provider: {
      type: String,
      enum: paymentProviderValues,
      default: "mock",
      required: true,
    },
    providerReference: {
      type: String,
      trim: true,
      default: null,
    },
    failureCode: {
      type: String,
      trim: true,
      default: null,
    },
    failureMessage: {
      type: String,
      trim: true,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    failedAt: {
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
// 1. Unique human-readable paymentReference
// 2. Unique compound index for idempotency per cafe
// 3. Unique invariant: At most ONE successful (paid) payment per order
// 4. Query indexes: Cafe orders, Order payments, Status filters
// ---------------------------------------------------------------------------
paymentSchema.index({ paymentReference: 1 }, { unique: true });
paymentSchema.index({ cafeId: 1, idempotencyKey: 1 }, { unique: true });
paymentSchema.index(
  { orderId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "paid" },
  },
);
paymentSchema.index({ cafeId: 1, createdAt: -1, _id: -1 });
paymentSchema.index({ orderId: 1, createdAt: -1, _id: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

export const Payment = models.Payment || model("Payment", paymentSchema);
