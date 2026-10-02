import { Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { Cafe } from "@/model/cafe";
import { Order } from "@/model/order";
import { Payment, type PaymentStatus } from "@/model/payment";
import { Supplier } from "@/model/supplier";
import { SupplierPayable } from "@/model/supplier-payable";
import { SupplierSettlement } from "@/model/supplier-settlement";
import type {
  AdminFinanceOverviewDTO,
  AdminPaymentListItemDTO,
  AdminPaymentListResult,
} from "@/src/domain/finance";
import type { PaymentDocLean } from "@/src/repositories/payment-repository";

export async function getAdminFinanceOverview(): Promise<AdminFinanceOverviewDTO> {
  await dbConnect();

  const [paymentStats, payableStats, settlementStats] = await Promise.all([
    Payment.aggregate([
      { $match: { status: "paid" } },
      {
        $group: {
          _id: null,
          totalReceivedAmount: { $sum: "$amount" },
          totalSuccessfulPayments: { $sum: 1 },
        },
      },
    ]),
    SupplierPayable.aggregate([
      {
        $group: {
          _id: "$status",
          totalAmount: { $sum: "$netAmount" },
        },
      },
    ]),
    SupplierSettlement.aggregate([
      {
        $group: {
          _id: null,
          totalSettledAmount: { $sum: "$totalAmount" },
        },
      },
    ]),
  ]);

  const totalSuccessfulPayments =
    paymentStats[0]?.totalSuccessfulPayments || 0;
  const totalReceivedAmount = paymentStats[0]?.totalReceivedAmount || 0;

  let pendingSupplierPayableAmount = 0;
  let eligibleSettlementAmount = 0;

  for (const s of payableStats) {
    if (s._id === "pending") {
      pendingSupplierPayableAmount = s.totalAmount;
    } else if (s._id === "eligible") {
      eligibleSettlementAmount = s.totalAmount;
    }
  }

  const settledAmount = settlementStats[0]?.totalSettledAmount || 0;

  return {
    totalSuccessfulPayments,
    totalReceivedAmount,
    pendingSupplierPayableAmount,
    eligibleSettlementAmount,
    settledAmount,
  };
}

export async function listPaymentsForAdmin(query: {
  page: number;
  pageSize: number;
  status?: PaymentStatus;
  cafeId?: string;
  supplierId?: string;
}): Promise<AdminPaymentListResult> {
  await dbConnect();

  const filter: Record<string, unknown> = {};
  if (query.status) {
    filter.status = query.status;
  }
  if (query.cafeId) {
    filter.cafeId = new Types.ObjectId(query.cafeId);
  }

  // If supplierId filter is passed, we resolve orders belonging to this supplier
  if (query.supplierId) {
    const supplierOrders = await Order.find(
      { supplierId: new Types.ObjectId(query.supplierId) },
      { _id: 1 },
    )
      .lean<Array<{ _id: Types.ObjectId }>>()
      .exec();
    const orderIds = supplierOrders.map((o) => o._id);
    filter.orderId = { $in: orderIds };
  }

  const skip = (query.page - 1) * query.pageSize;

  const [total, payments] = await Promise.all([
    Payment.countDocuments(filter),
    Payment.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.pageSize)
      .lean<PaymentDocLean[]>()
      .exec(),
  ]);

  if (payments.length === 0) {
    return { items: [], total };
  }

  const orderIds = payments.map((p) => p.orderId);
  const cafeIds = payments.map((p) => p.cafeId);

  const [orders, cafes] = await Promise.all([
    Order.find({ _id: { $in: orderIds } }, { orderNumber: 1, supplierId: 1 })
      .lean<
        Array<{
          _id: Types.ObjectId;
          orderNumber: string;
          supplierId: Types.ObjectId;
        }>
      >()
      .exec(),
    Cafe.find({ _id: { $in: cafeIds } }, { name: 1 })
      .lean<Array<{ _id: Types.ObjectId; name?: string }>>()
      .exec(),
  ]);

  const supplierIds = orders.map((o) => o.supplierId);
  const suppliers = await Supplier.find(
    { _id: { $in: supplierIds } },
    { businessName: 1 },
  )
    .lean<Array<{ _id: Types.ObjectId; businessName?: string }>>()
    .exec();

  const orderMap = new Map(orders.map((o) => [o._id.toString(), o]));
  const cafeMap = new Map(
    cafes.map((c) => [c._id.toString(), c.name || "کافه"]),
  );
  const supplierMap = new Map(
    suppliers.map((s) => [s._id.toString(), s.businessName || "تأمین‌کننده"]),
  );

  const items: AdminPaymentListItemDTO[] = payments.map((p) => {
    const order = orderMap.get(p.orderId.toString());
    const supplierIdStr = order ? order.supplierId.toString() : "";
    return {
      id: p._id.toString(),
      paymentReference: p.paymentReference,
      orderId: p.orderId.toString(),
      orderNumber: order?.orderNumber || "نامشخص",
      cafeId: p.cafeId.toString(),
      cafeName: cafeMap.get(p.cafeId.toString()) || "کافه ناشناس",
      supplierId: supplierIdStr,
      supplierName: supplierMap.get(supplierIdStr) || "تأمین‌کننده ناشناس",
      amount: p.amount,
      status: p.status,
      method: p.method,
      provider: p.provider,
      createdAt: p.createdAt.toISOString(),
      paidAt: p.paidAt ? p.paidAt.toISOString() : null,
      failureMessage: p.failureMessage || null,
    };
  });

  return { items, total };
}
