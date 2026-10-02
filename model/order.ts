import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export const orderStatusValues = [
  "placed",
  "confirmed",
  "rejected",
  "cancelled",
  "preparing",
  "shipped",
  "delivered",
] as const;
export type OrderStatus = (typeof orderStatusValues)[number];

export const orderItemTypeValues = ["catalog", "custom"] as const;
export type OrderItemType = (typeof orderItemTypeValues)[number];

const orderItemSchema = new Schema(
  {
    purchaseRequestItemId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    supplierRequestId: {
      type: Schema.Types.ObjectId,
      ref: "SupplierRequest",
      required: true,
    },
    supplierResponseId: {
      type: Schema.Types.ObjectId,
      ref: "SupplierResponse",
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    matchedSupplierOfferId: {
      type: Schema.Types.ObjectId,
      ref: "SupplierOffer",
      default: null,
    },
    itemType: {
      type: String,
      enum: orderItemTypeValues,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
      default: null,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: (v: number) => Number.isSafeInteger(v) && v > 0,
        message: "تعداد سفارش باید عدد صحیح مثبت باشد",
      },
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: (v: number) => Number.isSafeInteger(v) && v > 0,
        message: "قیمت واحد باید عدد صحیح مثبت به تومان باشد",
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: (v: number) => Number.isSafeInteger(v) && v > 0,
        message: "مبلغ قلم باید عدد صحیح مثبت به تومان باشد",
      },
    },
  },
  { _id: true },
);

const orderSchema = new Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      trim: true,
    },
    cafeId: {
      type: Schema.Types.ObjectId,
      ref: "Cafe",
      required: true,
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    purchaseRequestId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseRequest",
      required: true,
      index: true,
    },
    purchaseRequestSelectionId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseRequestSelection",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: orderStatusValues,
      default: "placed",
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: [
        (items: unknown[]) => Array.isArray(items) && items.length > 0,
        "حداقل یک قلم در سفارش الزامی است",
      ],
    },
    itemsSubtotal: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (v: number) => Number.isSafeInteger(v) && v >= 0,
        message: "مجموع اقلام باید عدد صحیح نامنفی باشد",
      },
    },
    shippingCost: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (v: number) => Number.isSafeInteger(v) && v >= 0,
        message: "هزینه ارسال باید عدد صحیح نامنفی باشد",
      },
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (v: number) => Number.isSafeInteger(v) && v >= 0,
        message: "مبلغ کل سفارش باید عدد صحیح نامنفی باشد",
      },
    },
    deliveryDays: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (v: number) => Number.isSafeInteger(v) && v >= 0,
        message: "زمان تحویل باید عدد صحیح نامنفی باشد",
      },
    },
    createdByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    shippingNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    cancelReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    cancelledByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    rejectReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    rejectedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    placedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    preparingAt: {
      type: Date,
      default: null,
    },
    shippedAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
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
// 1. Unique index on human-readable orderNumber
// 2. Unique compound index on purchaseRequestSelectionId + supplierId (Idempotency)
// 3. Cafe tenant scoped query index
// 4. Cafe status filtered query index
// 5. Supplier tenant scoped query index
// 6. Supplier status filtered query index
// 7. RFQ query index
// ---------------------------------------------------------------------------
orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index(
  { purchaseRequestSelectionId: 1, supplierId: 1 },
  { unique: true },
);
orderSchema.index({ cafeId: 1, createdAt: -1, _id: -1 });
orderSchema.index({ cafeId: 1, status: 1, createdAt: -1, _id: -1 });
orderSchema.index({ supplierId: 1, createdAt: -1, _id: -1 });
orderSchema.index({ supplierId: 1, status: 1, createdAt: -1, _id: -1 });
orderSchema.index({ purchaseRequestId: 1, createdAt: -1 });

export const Order = models.Order || model("Order", orderSchema);
