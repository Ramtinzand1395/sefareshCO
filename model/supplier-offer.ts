import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

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
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    minOrderQuantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    deliveryDays: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
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

// unique compound index: one offer per supplier per product
supplierOfferSchema.index({ supplierId: 1, productId: 1 }, { unique: true });
supplierOfferSchema.index({ supplierId: 1, status: 1 });
supplierOfferSchema.index({ productId: 1, status: 1 });
// for eligible offers query (buyer-facing future)
supplierOfferSchema.index({ status: 1, stock: 1 });

export const SupplierOffer =
  models.SupplierOffer || model("SupplierOffer", supplierOfferSchema);
