import { Schema, model, models } from "mongoose";

const cafeSchema = new Schema(
  {
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },

    type: {
      type: String,
      enum: ["cafe", "restaurant", "fast_food", "bakery", "catering", "other"],
      default: "cafe",
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

    location: {
      lat: Number,
      lng: Number,
    },

    logoUrl: {
      type: String,
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
    },

    verifiedAt: {
      type: Date,
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

cafeSchema.index({
  ownerUserId: 1,
  status: 1,
});

cafeSchema.index({
  city: 1,
  status: 1,
});

export const Cafe = models.Cafe || model("Cafe", cafeSchema);
