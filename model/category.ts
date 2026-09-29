import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export type CategoryStatus = "active" | "inactive";

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 140,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },

    displayOrder: {
      type: Number,
      default: 0,
      min: 0,
    },

    icon: {
      type: String,
      trim: true,
    },

    image: {
      type: String,
      trim: true,
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

// Slug must be unique among non-deleted categories
categorySchema.index(
  { slug: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  },
);

categorySchema.index({
  parentId: 1,
  status: 1,
});

categorySchema.index({
  displayOrder: 1,
  createdAt: -1,
});

export const Category = models.Category || model("Category", categorySchema);
