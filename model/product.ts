import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export type ProductStatus = "draft" | "active" | "inactive";

const productAttributeSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    value: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 220,
    },

    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },

    brand: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 3000,
    },

    images: {
      type: [String],
      default: [],
    },

    barcode: {
      type: String,
      trim: true,
      maxlength: 60,
    },

    sku: {
      type: String,
      trim: true,
      maxlength: 60,
    },

    attributes: {
      type: [productAttributeSchema],
      default: [],
    },

    status: {
      type: String,
      enum: ["draft", "active", "inactive"],
      default: "draft",
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Slug unique among active/non-deleted products
productSchema.index(
  { slug: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  },
);

// Optional unique index on SKU & Barcode among non-deleted products
productSchema.index(
  { sku: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { deletedAt: null, sku: { $type: "string" } },
  },
);

productSchema.index(
  { barcode: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { deletedAt: null, barcode: { $type: "string" } },
  },
);

productSchema.index({
  categoryId: 1,
  status: 1,
});

productSchema.index({
  status: 1,
  createdAt: -1,
});

export const Product = models.Product || model("Product", productSchema);
