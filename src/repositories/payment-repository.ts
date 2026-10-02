import { Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import {
  Payment,
  type PaymentMethod,
  type PaymentProvider,
  type PaymentStatus,
} from "@/model/payment";
import { generatePaymentReference } from "@/src/domain/finance";

export type PaymentDocLean = {
  _id: Types.ObjectId | { toString(): string };
  cafeId: Types.ObjectId | { toString(): string };
  orderId: Types.ObjectId | { toString(): string };
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod;
  paymentReference: string;
  idempotencyKey: string;
  initiatedByUserId: Types.ObjectId | { toString(): string };
  provider: PaymentProvider;
  providerReference?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  paidAt?: Date | null;
  failedAt?: Date | null;
  cancelledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function findPaymentById(
  paymentId: string,
): Promise<PaymentDocLean | null> {
  await dbConnect();
  return Payment.findById(paymentId).lean<PaymentDocLean | null>().exec();
}

export async function findPaymentByIdempotencyKey(
  cafeId: string,
  idempotencyKey: string,
): Promise<PaymentDocLean | null> {
  await dbConnect();
  return Payment.findOne({
    cafeId: new Types.ObjectId(cafeId),
    idempotencyKey,
  })
    .lean<PaymentDocLean | null>()
    .exec();
}

export async function findPaidPaymentForOrder(
  orderId: string,
): Promise<PaymentDocLean | null> {
  await dbConnect();
  return Payment.findOne({
    orderId: new Types.ObjectId(orderId),
    status: "paid",
  })
    .lean<PaymentDocLean | null>()
    .exec();
}

export async function findPaymentsForOrder(
  orderId: string,
): Promise<PaymentDocLean[]> {
  await dbConnect();
  return Payment.find({
    orderId: new Types.ObjectId(orderId),
  })
    .sort({ createdAt: -1, _id: -1 })
    .lean<PaymentDocLean[]>()
    .exec();
}

export async function createPaymentAttemptInRepo(input: {
  cafeId: string;
  orderId: string;
  amount: number;
  initiatedByUserId: string;
  idempotencyKey: string;
  method?: PaymentMethod;
  provider?: PaymentProvider;
}): Promise<{ payment: PaymentDocLean; isExisting: boolean }> {
  await dbConnect();

  // 1. Idempotency check first
  const existing = await findPaymentByIdempotencyKey(
    input.cafeId,
    input.idempotencyKey,
  );
  if (existing) {
    return { payment: existing, isExisting: true };
  }

  // 2. Retry loop for collision-free paymentReference
  let attempts = 0;
  while (attempts < 5) {
    attempts++;
    const paymentReference = generatePaymentReference();

    try {
      const created = await Payment.create({
        cafeId: new Types.ObjectId(input.cafeId),
        orderId: new Types.ObjectId(input.orderId),
        amount: input.amount,
        status: "pending",
        method: input.method || "online",
        paymentReference,
        idempotencyKey: input.idempotencyKey,
        initiatedByUserId: new Types.ObjectId(input.initiatedByUserId),
        provider: input.provider || "mock",
      });

      const lean = created.toObject() as PaymentDocLean;
      return { payment: lean, isExisting: false };
    } catch (err: unknown) {
      const mongoErr = err as { code?: number; keyPattern?: Record<string, number> };
      if (mongoErr.code === 11000) {
        if (mongoErr.keyPattern?.idempotencyKey || mongoErr.keyPattern?.cafeId) {
          const raceExisting = await findPaymentByIdempotencyKey(
            input.cafeId,
            input.idempotencyKey,
          );
          if (raceExisting) {
            return { payment: raceExisting, isExisting: true };
          }
        }
        if (mongoErr.keyPattern?.paymentReference) {
          continue; // collision retry
        }
      }
      throw err;
    }
  }

  throw new Error("تولید شماره یکتای پرداخت با شکست مواجه شد؛ لطفاً دوباره تلاش کنید");
}

export async function markPaymentPaidInRepo(
  paymentId: string,
  providerReference?: string,
): Promise<PaymentDocLean | null> {
  await dbConnect();

  const updated = await Payment.findOneAndUpdate(
    {
      _id: new Types.ObjectId(paymentId),
      status: "pending",
    },
    {
      $set: {
        status: "paid",
        paidAt: new Date(),
        providerReference: providerReference || null,
      },
    },
    { returnDocument: "after" },
  )
    .lean<PaymentDocLean | null>()
    .exec();

  return updated;
}

export async function markPaymentFailedInRepo(
  paymentId: string,
  failureCode?: string,
  failureMessage?: string,
): Promise<PaymentDocLean | null> {
  await dbConnect();

  const updated = await Payment.findOneAndUpdate(
    {
      _id: new Types.ObjectId(paymentId),
      status: "pending",
    },
    {
      $set: {
        status: "failed",
        failedAt: new Date(),
        failureCode: failureCode || null,
        failureMessage: failureMessage || null,
      },
    },
    { returnDocument: "after" },
  )
    .lean<PaymentDocLean | null>()
    .exec();

  return updated;
}
