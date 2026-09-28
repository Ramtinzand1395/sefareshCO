import { Schema, model, models } from "mongoose";

const supplierSchema = new Schema(
  {
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    businessName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    legalName: {
      type: String,
      trim: true,
    },

    nationalId: {
      type: String,
      trim: true,
    },

    economicCode: {
      type: String,
      trim: true,
    },

    mobile: {
      type: String,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    province: {
      type: String,
      trim: true,
    },

    city: {
      type: String,
      trim: true,
    },

    address: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    postalCode: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "active", "suspended", "rejected"],
      default: "pending",
      index: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    verifiedAt: {
      type: Date,
    },

    minimumOrderAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    logoUrl: {
      type: String,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

supplierSchema.index({
  status: 1,
  isVerified: 1,
});

supplierSchema.index({
  city: 1,
  status: 1,
});

export const Supplier = models.Supplier || model("Supplier", supplierSchema);
