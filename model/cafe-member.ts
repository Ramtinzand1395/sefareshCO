import { Schema, model, models } from "mongoose";

const cafeMemberSchema = new Schema(
  {
    cafeId: {
      type: Schema.Types.ObjectId,
      ref: "Cafe",
      required: true,
      index: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    role: {
      type: String,
      enum: [
        "owner",
        "manager",
        "purchase_manager",
        "chef",
        "accountant",
        "employee",
      ],
      required: true,
    },

    status: {
      type: String,
      enum: ["invited", "active", "suspended", "removed"],
      default: "invited",
    },

    permissions: {
      canCreatePurchaseRequest: {
        type: Boolean,
        default: false,
      },

      canApprovePurchaseRequest: {
        type: Boolean,
        default: false,
      },

      canManageShoppingList: {
        type: Boolean,
        default: false,
      },

      canCompareSuppliers: {
        type: Boolean,
        default: false,
      },

      canCreateOrder: {
        type: Boolean,
        default: false,
      },

      canViewOrders: {
        type: Boolean,
        default: true,
      },

      canViewCosts: {
        type: Boolean,
        default: false,
      },

      canManageMembers: {
        type: Boolean,
        default: false,
      },
    },

    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    joinedAt: {
      type: Date,
    },

    removedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// یک کاربر فقط یک عضویت فعال در هر کافه
cafeMemberSchema.index(
  {
    cafeId: 1,
    userId: 1,
  },
  {
    unique: true,
  },
);

cafeMemberSchema.index({
  cafeId: 1,
  status: 1,
});

cafeMemberSchema.index({
  userId: 1,
  status: 1,
});

export const CafeMember =
  models.CafeMember || model("CafeMember", cafeMemberSchema);
