import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export const supplierSettlementStatusValues = ["paid"] as const;
export type SupplierSettlementStatus =
  (typeof supplierSettlementStatusValues)[number];

const supplierSettlementSchema = new Schema(
  {
    settlementNumber: {
      type: String,
      required: true,
      trim: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    payableIds: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "SupplierPayable",
        },
      ],
      required: true,
      validate: [
        (val: unknown[]) => Array.isArray(val) && val.length > 0,
        "حداقل یک قلم تسویه الزامی است",
      ],
    },
    payableCount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: (v: number) => Number.isSafeInteger(v) && v > 0,
        message: "تعداد اقلام تسویه باید عدد صحیح مثبت باشد",
      },
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: (v: number) => Number.isSafeInteger(v) && v > 0,
        message: "مبلغ کل تسویه باید عدد صحیح مثبت به تومان باشد",
      },
    },
    status: {
      type: String,
      enum: supplierSettlementStatusValues,
      default: "paid",
      required: true,
    },
    settledByAdminUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    settledAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    note: {
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
// 1. Unique human-readable settlementNumber
// 2. Query indexes for supplier history and admin audit
// ---------------------------------------------------------------------------
supplierSettlementSchema.index({ settlementNumber: 1 }, { unique: true });
supplierSettlementSchema.index({ supplierId: 1, settledAt: -1 });
supplierSettlementSchema.index({ settledAt: -1 });

export const SupplierSettlement =
  models.SupplierSettlement ||
  model("SupplierSettlement", supplierSettlementSchema);
