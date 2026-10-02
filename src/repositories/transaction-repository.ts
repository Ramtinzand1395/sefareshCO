import { Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import {
  Transaction,
  type TransactionDirection,
  type TransactionType,
} from "@/model/transaction";
import { generateTransactionNumber } from "@/src/domain/finance";

export type TransactionDocLean = {
  _id: Types.ObjectId | { toString(): string };
  transactionNumber: string;
  cafeId?: Types.ObjectId | { toString(): string } | null;
  supplierId?: Types.ObjectId | { toString(): string } | null;
  orderId?: Types.ObjectId | { toString(): string } | null;
  paymentId?: Types.ObjectId | { toString(): string } | null;
  payableId?: Types.ObjectId | { toString(): string } | null;
  settlementId?: Types.ObjectId | { toString(): string } | null;
  type: TransactionType;
  amount: number;
  direction: TransactionDirection;
  referenceNumber: string;
  description: string;
  createdAt: Date;
};

export async function createTransactionInRepo(input: {
  cafeId?: string | null;
  supplierId?: string | null;
  orderId?: string | null;
  paymentId?: string | null;
  payableId?: string | null;
  settlementId?: string | null;
  type: TransactionType;
  amount: number;
  direction: TransactionDirection;
  referenceNumber: string;
  description: string;
}): Promise<TransactionDocLean> {
  await dbConnect();

  // Retry loop for unique transactionNumber
  let attempts = 0;
  while (attempts < 5) {
    attempts++;
    const transactionNumber = generateTransactionNumber();

    try {
      const created = await Transaction.create({
        transactionNumber,
        cafeId: input.cafeId ? new Types.ObjectId(input.cafeId) : null,
        supplierId: input.supplierId
          ? new Types.ObjectId(input.supplierId)
          : null,
        orderId: input.orderId ? new Types.ObjectId(input.orderId) : null,
        paymentId: input.paymentId ? new Types.ObjectId(input.paymentId) : null,
        payableId: input.payableId ? new Types.ObjectId(input.payableId) : null,
        settlementId: input.settlementId
          ? new Types.ObjectId(input.settlementId)
          : null,
        type: input.type,
        amount: input.amount,
        direction: input.direction,
        referenceNumber: input.referenceNumber,
        description: input.description,
      });

      return created.toObject() as TransactionDocLean;
    } catch (err: unknown) {
      const mongoErr = err as {
        code?: number;
        keyPattern?: Record<string, number>;
      };
      if (mongoErr.code === 11000) {
        // If duplicate on source idempotency, retrieve existing
        if (
          mongoErr.keyPattern?.paymentId ||
          mongoErr.keyPattern?.payableId ||
          mongoErr.keyPattern?.settlementId
        ) {
          const filter: Record<string, unknown> = { type: input.type };
          if (input.paymentId)
            filter.paymentId = new Types.ObjectId(input.paymentId);
          if (input.payableId)
            filter.payableId = new Types.ObjectId(input.payableId);
          if (input.settlementId)
            filter.settlementId = new Types.ObjectId(input.settlementId);

          const existing = await Transaction.findOne(filter)
            .lean<TransactionDocLean | null>()
            .exec();
          if (existing) {
            return existing;
          }
        }
        if (mongoErr.keyPattern?.transactionNumber) {
          continue; // collision retry
        }
      }
      throw err;
    }
  }

  throw new Error(
    "تولید شماره یکتای تراکنش با شکست مواجه شد؛ لطفاً دوباره تلاش کنید",
  );
}

export async function findTransactionByPaymentId(
  paymentId: string,
  type: TransactionType,
): Promise<TransactionDocLean | null> {
  await dbConnect();
  return Transaction.findOne({
    paymentId: new Types.ObjectId(paymentId),
    type,
  })
    .lean<TransactionDocLean | null>()
    .exec();
}
