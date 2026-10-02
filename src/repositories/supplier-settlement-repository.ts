import { Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { Supplier } from "@/model/supplier";
import { SupplierPayable } from "@/model/supplier-payable";
import {
  SupplierSettlement,
  type SupplierSettlementStatus,
} from "@/model/supplier-settlement";
import {
  generateSettlementNumber,
  type AdminSettlementListItemDTO,
  type AdminSettlementListResult,
  type CreateSettlementResultDTO,
  type SupplierSettlementListItemDTO,
  type SupplierSettlementListResult,
} from "@/src/domain/finance";
import { createTransactionInRepo } from "@/src/repositories/transaction-repository";

export class SettlementValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettlementValidationError";
  }
}

export class SettlementConcurrencyError extends Error {
  constructor(
    message = "یک یا چند قلم انتخاب‌شده همزمان توسط عملیات دیگری تسویه شد؛ لطفاً صفحه را تازه‌سازی کنید",
  ) {
    super(message);
    this.name = "SettlementConcurrencyError";
  }
}

export type SupplierSettlementDocLean = {
  _id: Types.ObjectId | { toString(): string };
  settlementNumber: string;
  supplierId: Types.ObjectId | { toString(): string };
  payableIds: Array<Types.ObjectId | { toString(): string }>;
  payableCount: number;
  totalAmount: number;
  status: SupplierSettlementStatus;
  settledByAdminUserId: Types.ObjectId | { toString(): string };
  settledAt: Date;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function createSettlementWithPayablesInRepo(input: {
  supplierId: string;
  payableIds: string[];
  adminUserId: string;
  note?: string;
}): Promise<CreateSettlementResultDTO> {
  await dbConnect();

  const supplierObjId = new Types.ObjectId(input.supplierId);
  const payableObjIds = input.payableIds.map((id) => new Types.ObjectId(id));

  // 1. Verify supplier existence
  const supplier = await Supplier.findById(supplierObjId)
    .lean<{ _id: Types.ObjectId; businessName?: string } | null>()
    .exec();
  if (!supplier) {
    throw new SettlementValidationError("تأمین‌کننده مورد نظر یافت نشد");
  }

  // 2. Query candidates for settlement verification
  const candidates = await SupplierPayable.find({
    _id: { $in: payableObjIds },
  })
    .lean<
      Array<{
        _id: Types.ObjectId;
        supplierId: Types.ObjectId;
        status: string;
        settlementId: Types.ObjectId | null;
        netAmount: number;
      }>
    >()
    .exec();

  if (candidates.length !== payableObjIds.length) {
    throw new SettlementValidationError(
      "یک یا چند شناسه پرداختنی نامعتبر بوده یا یافت نشدند",
    );
  }

  // 3. Invariants check: Must belong to supplier, must be eligible, must be unsettled
  let authoritativeTotal = 0;
  for (const c of candidates) {
    if (c.supplierId.toString() !== input.supplierId) {
      throw new SettlementValidationError(
        "اقلام پرداختنی انتخاب‌شده متعلق به تأمین‌کننده دیگری هستند",
      );
    }
    if (c.status !== "eligible" || c.settlementId !== null) {
      throw new SettlementValidationError(
        "فقط اقلام پرداختنی با وضعیت قابل تسویه (eligible) و تسویه‌نشده امکان ثبت در تسویه را دارند",
      );
    }

    if (
      typeof c.netAmount !== "number" ||
      !Number.isInteger(c.netAmount) ||
      c.netAmount <= 0 ||
      !Number.isSafeInteger(c.netAmount)
    ) {
      throw new SettlementValidationError(
        "مبلغ یکی از اقلام پرداختنی نامعتبر است",
      );
    }

    authoritativeTotal += c.netAmount;
    if (
      !Number.isSafeInteger(authoritativeTotal) ||
      authoritativeTotal > Number.MAX_SAFE_INTEGER
    ) {
      throw new SettlementValidationError("مبلغ کل تسویه از سقف مجاز فراتر رفت");
    }
  }

  // 4. Generate unique settlementNumber with retry
  let attempts = 0;
  let createdSettlement: {
    _id: Types.ObjectId;
    settlementNumber: string;
    settledAt: Date;
  } | null = null;

  while (attempts < 5) {
    attempts++;
    const settlementNumber = generateSettlementNumber();

    try {
      const doc = await SupplierSettlement.create({
        settlementNumber,
        supplierId: supplierObjId,
        payableIds: payableObjIds,
        payableCount: payableObjIds.length,
        totalAmount: authoritativeTotal,
        status: "paid",
        settledByAdminUserId: new Types.ObjectId(input.adminUserId),
        settledAt: new Date(),
        note: input.note || null,
      });

      createdSettlement = {
        _id: doc._id,
        settlementNumber: doc.settlementNumber,
        settledAt: doc.settledAt,
      };
      break;
    } catch (err: unknown) {
      const mongoErr = err as {
        code?: number;
        keyPattern?: Record<string, number>;
      };
      if (
        mongoErr.code === 11000 &&
        mongoErr.keyPattern?.settlementNumber
      ) {
        continue;
      }
      throw err;
    }
  }

  if (!createdSettlement) {
    throw new Error("تولید شماره یکتای تسویه ناموفق بود");
  }

  // 5. Atomic Claim: Update payables conditionally
  const now = createdSettlement.settledAt;
  const updateRes = await SupplierPayable.updateMany(
    {
      _id: { $in: payableObjIds },
      supplierId: supplierObjId,
      status: "eligible",
      settlementId: null,
    },
    {
      $set: {
        status: "settled",
        settlementId: createdSettlement._id,
        settledAt: now,
      },
    },
  );

  // 6. Concurrency verification: If race won by someone else
  if (updateRes.modifiedCount !== payableObjIds.length) {
    // Compensating rollback: Revert any claimed items and delete settlement
    await SupplierPayable.updateMany(
      { settlementId: createdSettlement._id },
      {
        $set: {
          status: "eligible",
          settlementId: null,
          settledAt: null,
        },
      },
    );
    await SupplierSettlement.findByIdAndDelete(createdSettlement._id);

    throw new SettlementConcurrencyError();
  }

  // 7. Record immutable Ledger Transaction: supplier_settlement_paid
  try {
    await createTransactionInRepo({
      supplierId: input.supplierId,
      settlementId: createdSettlement._id.toString(),
      type: "supplier_settlement_paid",
      amount: authoritativeTotal,
      direction: "debit",
      referenceNumber: createdSettlement.settlementNumber,
      description: `تسویه حساب تأمین‌کننده با شماره ${createdSettlement.settlementNumber}`,
    });
  } catch (txErr) {
    console.error("Failed to append ledger entry for settlement:", txErr);
  }

  return {
    settlementId: createdSettlement._id.toString(),
    settlementNumber: createdSettlement.settlementNumber,
    supplierId: input.supplierId,
    supplierName: supplier.businessName || "تأمین‌کننده",
    payableCount: payableObjIds.length,
    totalAmount: authoritativeTotal,
    settledAt: createdSettlement.settledAt.toISOString(),
  };
}

export async function listSettlementsForSupplier(
  supplierId: string,
  query: { page: number; pageSize: number },
): Promise<SupplierSettlementListResult> {
  await dbConnect();

  const filter = { supplierId: new Types.ObjectId(supplierId) };
  const skip = (query.page - 1) * query.pageSize;

  const [total, settlements] = await Promise.all([
    SupplierSettlement.countDocuments(filter),
    SupplierSettlement.find(filter)
      .sort({ settledAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.pageSize)
      .lean<SupplierSettlementDocLean[]>()
      .exec(),
  ]);

  const items: SupplierSettlementListItemDTO[] = settlements.map((s) => ({
    id: s._id.toString(),
    settlementNumber: s.settlementNumber,
    payableCount: s.payableCount,
    totalAmount: s.totalAmount,
    settledAt: s.settledAt.toISOString(),
    note: s.note || null,
  }));

  return { items, total };
}

export async function listSettlementsForAdmin(query: {
  page: number;
  pageSize: number;
  supplierId?: string;
}): Promise<AdminSettlementListResult> {
  await dbConnect();

  const filter: Record<string, unknown> = {};
  if (query.supplierId) {
    filter.supplierId = new Types.ObjectId(query.supplierId);
  }

  const skip = (query.page - 1) * query.pageSize;

  const [total, settlements] = await Promise.all([
    SupplierSettlement.countDocuments(filter),
    SupplierSettlement.find(filter)
      .sort({ settledAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.pageSize)
      .lean<SupplierSettlementDocLean[]>()
      .exec(),
  ]);

  if (settlements.length === 0) {
    return { items: [], total };
  }

  const supplierIds = settlements.map((s) => s.supplierId);
  const suppliers = await Supplier.find(
    { _id: { $in: supplierIds } },
    { businessName: 1 },
  )
    .lean<Array<{ _id: Types.ObjectId; businessName?: string }>>()
    .exec();

  const supplierMap = new Map(
    suppliers.map((s) => [s._id.toString(), s.businessName || "تأمین‌کننده"]),
  );

  const items: AdminSettlementListItemDTO[] = settlements.map((s) => ({
    id: s._id.toString(),
    settlementNumber: s.settlementNumber,
    supplierId: s.supplierId.toString(),
    supplierName:
      supplierMap.get(s.supplierId.toString()) || "تأمین‌کننده ناشناس",
    payableCount: s.payableCount,
    totalAmount: s.totalAmount,
    settledAt: s.settledAt.toISOString(),
    settledByAdminUserId: s.settledByAdminUserId.toString(),
    note: s.note || null,
  }));

  return { items, total };
}
