import { Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { Order } from "@/model/order";
import {
  SupplierPayable,
  type SupplierPayableStatus,
} from "@/model/supplier-payable";
import { SupplierSettlement } from "@/model/supplier-settlement";
import type {
  AdminSettlementCandidateDTO,
  SupplierFinanceOverviewDTO,
  SupplierPayableListItemDTO,
  SupplierPayableListResult,
} from "@/src/domain/finance";

export type SupplierPayableDocLean = {
  _id: Types.ObjectId | { toString(): string };
  orderId: Types.ObjectId | { toString(): string };
  supplierId: Types.ObjectId | { toString(): string };
  cafeId: Types.ObjectId | { toString(): string };
  paymentId: Types.ObjectId | { toString(): string };
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  status: SupplierPayableStatus;
  settlementId?: Types.ObjectId | { toString(): string } | null;
  eligibleAt?: Date | null;
  settledAt?: Date | null;
  cancelledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function findPayableByOrderId(
  orderId: string,
): Promise<SupplierPayableDocLean | null> {
  await dbConnect();
  return SupplierPayable.findOne({
    orderId: new Types.ObjectId(orderId),
  })
    .lean<SupplierPayableDocLean | null>()
    .exec();
}

export async function findPayableById(
  payableId: string,
): Promise<SupplierPayableDocLean | null> {
  await dbConnect();
  return SupplierPayable.findById(payableId)
    .lean<SupplierPayableDocLean | null>()
    .exec();
}

export async function findPayablesByIds(
  payableIds: string[],
): Promise<SupplierPayableDocLean[]> {
  await dbConnect();
  const objIds = payableIds.map((id) => new Types.ObjectId(id));
  return SupplierPayable.find({
    _id: { $in: objIds },
  })
    .lean<SupplierPayableDocLean[]>()
    .exec();
}

export async function createOrUpdatePayableOnPaymentInRepo(input: {
  orderId: string;
  supplierId: string;
  cafeId: string;
  paymentId: string;
  grossAmount: number;
  isDelivered: boolean;
}): Promise<SupplierPayableDocLean> {
  await dbConnect();

  const now = new Date();
  const initialStatus: SupplierPayableStatus = input.isDelivered
    ? "eligible"
    : "pending";
  const initialEligibleAt = input.isDelivered ? now : null;

  // Idempotent upsert by orderId
  const result = await SupplierPayable.findOneAndUpdate(
    { orderId: new Types.ObjectId(input.orderId) },
    {
      $setOnInsert: {
        orderId: new Types.ObjectId(input.orderId),
        supplierId: new Types.ObjectId(input.supplierId),
        cafeId: new Types.ObjectId(input.cafeId),
        paymentId: new Types.ObjectId(input.paymentId),
        grossAmount: input.grossAmount,
        platformFee: 0,
        netAmount: input.grossAmount,
        status: initialStatus,
        eligibleAt: initialEligibleAt,
      },
    },
    { upsert: true, returnDocument: "after" },
  )
    .lean<SupplierPayableDocLean | null>()
    .exec();

  if (!result) {
    throw new Error("ایجاد یا بازیابی رکورد پرداختنی با شکست مواجه شد");
  }

  // If payable was already created earlier and is still pending, but the order is delivered now:
  if (input.isDelivered && result.status === "pending") {
    const updated = await SupplierPayable.findByIdAndUpdate(
      result._id,
      {
        $set: {
          status: "eligible",
          eligibleAt: now,
        },
      },
      { returnDocument: "after" },
    )
      .lean<SupplierPayableDocLean | null>()
      .exec();
    return updated || result;
  }

  return result;
}


export async function syncPayableOnDeliveredInRepo(
  orderId: string,
): Promise<SupplierPayableDocLean | null> {
  await dbConnect();

  const now = new Date();
  // Atomically make eligible if status is pending
  const updated = await SupplierPayable.findOneAndUpdate(
    {
      orderId: new Types.ObjectId(orderId),
      status: "pending",
    },
    {
      $set: {
        status: "eligible",
        eligibleAt: now,
      },
    },
    { returnDocument: "after" },
  )
    .lean<SupplierPayableDocLean | null>()
    .exec();

  return updated;
}

export async function getSupplierFinanceOverview(
  supplierId: string,
): Promise<SupplierFinanceOverviewDTO> {
  await dbConnect();

  const supplierObjId = new Types.ObjectId(supplierId);

  const stats = await SupplierPayable.aggregate([
    { $match: { supplierId: supplierObjId } },
    {
      $group: {
        _id: "$status",
        totalAmount: { $sum: "$netAmount" },
        count: { $sum: 1 },
      },
    },
  ]);

  let pendingPayableAmount = 0;
  let eligibleSettlementAmount = 0;
  let settledAmount = 0;
  let totalPayableCount = 0;

  for (const s of stats) {
    if (s._id === "pending") {
      pendingPayableAmount = s.totalAmount;
      totalPayableCount += s.count;
    } else if (s._id === "eligible") {
      eligibleSettlementAmount = s.totalAmount;
      totalPayableCount += s.count;
    } else if (s._id === "settled") {
      settledAmount = s.totalAmount;
      totalPayableCount += s.count;
    }
  }

  return {
    pendingPayableAmount,
    eligibleSettlementAmount,
    settledAmount,
    totalPayableCount,
  };
}

export async function listPayablesForSupplier(
  supplierId: string,
  query: {
    page: number;
    pageSize: number;
    status?: SupplierPayableStatus;
  },
): Promise<SupplierPayableListResult> {
  await dbConnect();

  const filter: Record<string, unknown> = {
    supplierId: new Types.ObjectId(supplierId),
  };
  if (query.status) {
    filter.status = query.status;
  }

  const skip = (query.page - 1) * query.pageSize;

  const [total, payables] = await Promise.all([
    SupplierPayable.countDocuments(filter),
    SupplierPayable.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.pageSize)
      .lean<SupplierPayableDocLean[]>()
      .exec(),
  ]);

  if (payables.length === 0) {
    return { items: [], total };
  }

  // Populate orderNumbers and settlementNumbers
  const orderIds = payables.map((p) => p.orderId);
  const settlementIds = payables
    .map((p) => p.settlementId)
    .filter(Boolean) as Types.ObjectId[];

  const [orders, settlements] = await Promise.all([
    Order.find({ _id: { $in: orderIds } }, { orderNumber: 1 })
      .lean<Array<{ _id: Types.ObjectId; orderNumber: string }>>()
      .exec(),
    settlementIds.length > 0
      ? SupplierSettlement.find(
          { _id: { $in: settlementIds } },
          { settlementNumber: 1 },
        )
          .lean<Array<{ _id: Types.ObjectId; settlementNumber: string }>>()
          .exec()
      : [],
  ]);

  const orderMap = new Map(orders.map((o) => [o._id.toString(), o.orderNumber]));
  const settlementMap = new Map(
    settlements.map((s) => [s._id.toString(), s.settlementNumber]),
  );

  const items: SupplierPayableListItemDTO[] = payables.map((p) => ({
    id: p._id.toString(),
    orderId: p.orderId.toString(),
    orderNumber: orderMap.get(p.orderId.toString()) || "نامشخص",
    grossAmount: p.grossAmount,
    platformFee: p.platformFee,
    netAmount: p.netAmount,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    eligibleAt: p.eligibleAt ? p.eligibleAt.toISOString() : null,
    settledAt: p.settledAt ? p.settledAt.toISOString() : null,
    settlementNumber: p.settlementId
      ? settlementMap.get(p.settlementId.toString()) || null
      : null,
  }));

  return { items, total };
}

export async function findEligiblePayablesForSupplier(
  supplierId: string,
): Promise<AdminSettlementCandidateDTO[]> {
  await dbConnect();

  const payables = await SupplierPayable.find({
    supplierId: new Types.ObjectId(supplierId),
    status: "eligible",
    settlementId: null,
  })
    .sort({ createdAt: 1 })
    .lean<SupplierPayableDocLean[]>()
    .exec();

  if (payables.length === 0) return [];

  const orderIds = payables.map((p) => p.orderId);
  const orders = await Order.find(
    { _id: { $in: orderIds } },
    { orderNumber: 1 },
  )
    .lean<Array<{ _id: Types.ObjectId; orderNumber: string }>>()
    .exec();

  const orderMap = new Map(orders.map((o) => [o._id.toString(), o.orderNumber]));

  return payables.map((p) => ({
    id: p._id.toString(),
    orderId: p.orderId.toString(),
    orderNumber: orderMap.get(p.orderId.toString()) || "نامشخص",
    grossAmount: p.grossAmount,
    platformFee: p.platformFee,
    netAmount: p.netAmount,
    status: "eligible",
    eligibleAt: p.eligibleAt ? p.eligibleAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  }));
}
