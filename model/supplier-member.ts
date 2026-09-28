import { Schema, model, models } from "mongoose";

const supplierMemberSchema = new Schema(
  {
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
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
      enum: ["owner", "manager", "sales", "warehouse", "accountant", "employee"],
      required: true,
    },
    status: {
      type: String,
      enum: ["invited", "active", "suspended", "removed"],
      default: "invited",
      index: true,
    },
    permissions: {
      canManageProducts: { type: Boolean, default: false },
      canManageOffers: { type: Boolean, default: false },
      canViewRequests: { type: Boolean, default: false },
      canRespondToRequests: { type: Boolean, default: false },
      canViewOrders: { type: Boolean, default: true },
      canUpdateOrders: { type: Boolean, default: false },
      canViewFinancials: { type: Boolean, default: false },
      canManageMembers: { type: Boolean, default: false },
    },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User" },
    joinedAt: Date,
    removedAt: Date,
  },
  { timestamps: true },
);

supplierMemberSchema.index({ supplierId: 1, userId: 1 }, { unique: true });
supplierMemberSchema.index({ supplierId: 1, status: 1 });
supplierMemberSchema.index({ userId: 1, status: 1 });

export const SupplierMember =
  models.SupplierMember || model("SupplierMember", supplierMemberSchema);
