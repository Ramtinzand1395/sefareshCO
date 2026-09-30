import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export type OfferStatus = "active" | "inactive";

const supplierOfferSchema = new Schema(
  {
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: (v: number) => Number.isSafeInteger(v) && v > 0,
        message: "قیمت باید یک عدد صحیح معتبر و مثبت باشد",
      },
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: {
        validator: (v: number) => Number.isSafeInteger(v) && v >= 0,
        message: "موجودی باید یک عدد صحیح معتبر و نامنفی باشد",
      },
    },
    minOrderQuantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
      validate: {
        validator: (v: number) => Number.isSafeInteger(v) && v >= 1,
        message: "حداقل تعداد سفارش باید یک عدد صحیح معتبر و حداقل ۱ باشد",
      },
    },
    deliveryDays: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: {
        validator: (v: number) => Number.isSafeInteger(v) && v >= 0,
        message: "زمان تحویل باید عدد صحیح نامنفی باشد",
      },
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "inactive",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Unique compound index: strictly one offer per supplier per product
supplierOfferSchema.index({ supplierId: 1, productId: 1 }, { unique: true });

// Scoped listing & status filtering indexes
supplierOfferSchema.index({ supplierId: 1, status: 1 });
supplierOfferSchema.index({ supplierId: 1, createdAt: -1 });

// Index for buyer/RFQ queries
supplierOfferSchema.index({ productId: 1, status: 1, stock: 1 });

export const SupplierOffer =
  models.SupplierOffer || model("SupplierOffer", supplierOfferSchema);
