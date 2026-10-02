"use client";

import {
  IconAlertCircle,
  IconCheck,
  IconClock,
  IconCreditCard,
  IconRefresh,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { FinanceAmount } from "@/app/(dashboard)/_components/finance-ui";
import { InternalRequestDialog } from "@/app/(dashboard)/cafe/internal-requests/_components/internal-request-dialog";
import {
  createOrderPaymentAction,
  type FinanceActionState,
} from "@/app/actions/finance";
import type {
  CafeOrderPaymentDTO,
  CafePaymentAttemptDTO,
} from "@/src/domain/finance";
import { formatPersianDateTime } from "@/src/lib/persian-format";

function paymentMutationError(message?: string) {
  if (/قبلاً.*پرداخت|موفقیت پرداخت/.test(message ?? "")) {
    return "وضعیت پرداخت سفارش به‌روز شده است. اطلاعات تازه در حال دریافت است.";
  }
  if (/تأیید نشده|لغو یا رد|وضعیت سفارش/.test(message ?? "")) {
    return "وضعیت سفارش تغییر کرده و اکنون امکان شروع پرداخت وجود ندارد.";
  }
  if (/دسترسی/.test(message ?? "")) {
    return "شما دسترسی لازم برای شروع پرداخت این سفارش را ندارید.";
  }
  if (/mongo|mongoose|duplicate key|validation failed|cast to|stack|zod|provider|\bat\s+\w+/i.test(message ?? "")) {
    return "شروع پرداخت انجام نشد. لطفاً دوباره تلاش کنید.";
  }
  return message?.slice(0, 240) || "شروع پرداخت انجام نشد. لطفاً دوباره تلاش کنید.";
}

function isStateConflict(message?: string) {
  return /قبلاً|وضعیت|تأیید نشده|لغو یا رد|همزمان/.test(message ?? "");
}

export function OrderPaymentCard({
  initialPayment,
  canPayOrder,
  orderStatus,
  supplierName,
}: {
  initialPayment: CafeOrderPaymentDTO;
  canPayOrder: boolean;
  orderStatus: string;
  supplierName: string;
}) {
  const router = useRouter();
  const continueRef = useRef<HTMLButtonElement>(null);
  const [payment, setPayment] = useState(initialPayment);
  const [open, setOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const openReview = () => {
    if (!idempotencyKey) {
      setIdempotencyKey(globalThis.crypto.randomUUID());
    }
    setFeedback(null);
    setOpen(true);
  };

  const submitPayment = () => {
    if (!idempotencyKey || isPending) return;
    setFeedback(null);
    startTransition(async () => {
      const initialState: FinanceActionState<CafePaymentAttemptDTO> = {
        ok: false,
      };
      const result = await createOrderPaymentAction(initialState, {
        orderId: payment.orderId,
        idempotencyKey,
      });

      if (!result.ok || !result.data) {
        setFeedback(paymentMutationError(result.error));
        if (isStateConflict(result.error)) router.refresh();
        return;
      }

      setPayment((current) => ({
        ...current,
        paymentStatus: "pending",
        paidAt: null,
        latestPayment: {
          ...result.data!,
          paidAt: null,
          failureMessage: null,
        },
      }));
      setFeedback("درخواست پرداخت ثبت شد و در انتظار نتیجه است.");
      setOpen(false);
      router.refresh();
    });
  };

  const attempt = payment.latestPayment;
  const canInitiate = canPayOrder && ["unpaid", "failed"].includes(payment.paymentStatus);

  return (
    <>
      <section
        className="rounded-card border border-line bg-surface p-5 shadow-card"
        aria-labelledby="order-payment-heading"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <IconCreditCard className="size-5 text-primary" aria-hidden="true" />
              <h2 id="order-payment-heading" className="text-base font-black text-ink">
                پرداخت سفارش
              </h2>
            </div>
            <p className="mt-1 text-xs leading-6 text-ink-muted">
              وضعیت پرداخت و آخرین تلاش ثبت‌شده
            </p>
          </div>
          <PaymentStateIcon status={payment.paymentStatus} />
        </div>

        <div aria-live="polite" aria-atomic="true">
          {feedback ? (
            <p className="mt-4 rounded-control border border-primary/20 bg-primary-soft px-3 py-2.5 text-xs font-bold leading-6 text-primary">
              {feedback}
            </p>
          ) : null}
        </div>

        {payment.paymentStatus === "unpaid" ? (
          <div className="mt-5">
            <p className="text-xs font-bold text-ink-muted">مبلغ قابل پرداخت</p>
            <FinanceAmount
              value={payment.totalAmount}
              className="mt-1 block text-xl font-black text-ink"
            />
            {orderStatus === "placed" ? (
              <p className="mt-4 rounded-control border border-warning/25 bg-warning-soft px-3 py-3 text-xs font-bold leading-6 text-warning">
                پس از تأیید سفارش توسط تأمین‌کننده، امکان پرداخت فعال می‌شود.
              </p>
            ) : ["cancelled", "rejected"].includes(orderStatus) ? (
              <p className="mt-4 rounded-control border border-line bg-surface-subtle px-3 py-3 text-xs font-bold leading-6 text-ink-muted">
                برای سفارش لغوشده یا ردشده امکان پرداخت وجود ندارد.
              </p>
            ) : null}
          </div>
        ) : null}

        {payment.paymentStatus === "pending" && attempt ? (
          <PaymentAttemptDetails
            tone="warning"
            title="پرداخت در انتظار نتیجه است."
            attempt={attempt}
          />
        ) : null}

        {payment.paymentStatus === "paid" && attempt ? (
          <PaymentAttemptDetails
            tone="success"
            title="پرداخت شده"
            attempt={attempt}
            paidAt={payment.paidAt}
          />
        ) : null}

        {payment.paymentStatus === "failed" && attempt ? (
          <div className="mt-5">
            <PaymentAttemptDetails
              tone="danger"
              title="پرداخت ناموفق"
              attempt={attempt}
            />
            {attempt.failureMessage ? (
              <p className="mt-3 rounded-control border border-danger/20 bg-danger-soft px-3 py-2.5 text-xs font-bold leading-6 text-danger">
                {attempt.failureMessage}
              </p>
            ) : null}
          </div>
        ) : null}

        {canInitiate ? (
          <button
            type="button"
            onClick={openReview}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-black text-white transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {payment.paymentStatus === "failed" ? (
              <IconRefresh className="size-4" aria-hidden="true" />
            ) : (
              <IconCreditCard className="size-4" aria-hidden="true" />
            )}
            {payment.paymentStatus === "failed" ? "تلاش مجدد" : "پرداخت سفارش"}
          </button>
        ) : null}
      </section>

      <InternalRequestDialog
        open={open}
        onClose={() => setOpen(false)}
        title="پرداخت سفارش"
        description="اطلاعات پرداخت را مرور کنید. مبلغ از اطلاعات رسمی سفارش خوانده شده و قابل ویرایش نیست."
        size="sm"
        busy={isPending}
        initialFocusRef={continueRef}
      >
        <div className="overflow-y-auto p-4 sm:p-6">
          <dl className="space-y-3 rounded-card border border-line bg-surface-subtle p-4 text-sm">
            <ReviewRow label="شماره سفارش">
              <span dir="ltr" className="inline-block font-black">
                {payment.orderNumber}
              </span>
            </ReviewRow>
            <ReviewRow label="تأمین‌کننده">{supplierName}</ReviewRow>
            <ReviewRow label="مبلغ">
              <FinanceAmount value={payment.totalAmount} className="font-black" />
            </ReviewRow>
          </dl>
          <p className="mt-4 flex items-start gap-2 rounded-control border border-primary/20 bg-primary-soft px-3 py-3 text-xs font-bold leading-6 text-primary">
            <IconShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            با ادامه، یک درخواست پرداخت ثبت می‌شود. نتیجه پرداخت فقط توسط سرویس پرداخت تعیین خواهد شد.
          </p>
          <div aria-live="assertive" aria-atomic="true">
            {feedback ? (
              <p role="alert" className="mt-3 text-xs font-bold leading-6 text-danger">
                {feedback}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-line px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="min-h-11 rounded-control border border-line px-4 text-sm font-bold text-ink-muted transition hover:bg-surface-subtle disabled:opacity-50"
          >
            انصراف
          </button>
          <button
            ref={continueRef}
            type="button"
            onClick={submitPayment}
            disabled={isPending}
            className="min-h-11 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
          >
            {isPending ? "در حال ثبت درخواست…" : "ادامه پرداخت"}
          </button>
        </div>
      </InternalRequestDialog>
    </>
  );
}

function PaymentStateIcon({ status }: { status: CafeOrderPaymentDTO["paymentStatus"] }) {
  const config = {
    unpaid: { className: "bg-surface-subtle text-ink-muted", icon: IconCreditCard },
    pending: { className: "bg-warning-soft text-warning", icon: IconClock },
    paid: { className: "bg-success-soft text-success", icon: IconCheck },
    failed: { className: "bg-danger-soft text-danger", icon: IconAlertCircle },
  }[status];
  const Icon = config.icon;
  return (
    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${config.className}`}>
      <Icon className="size-5" aria-hidden="true" />
    </span>
  );
}

function PaymentAttemptDetails({
  title,
  tone,
  attempt,
  paidAt,
}: {
  title: string;
  tone: "warning" | "success" | "danger";
  attempt: NonNullable<CafeOrderPaymentDTO["latestPayment"]>;
  paidAt?: string | null;
}) {
  const toneClass = {
    warning: "border-warning/25 bg-warning-soft text-warning",
    success: "border-success/25 bg-success-soft text-success",
    danger: "border-danger/25 bg-danger-soft text-danger",
  }[tone];
  return (
    <div className="mt-5">
      <p className={`rounded-control border px-3 py-2.5 text-sm font-black ${toneClass}`}>
        {title}
      </p>
      <dl className="mt-4 space-y-3 text-xs">
        <ReviewRow label="کد پیگیری">
          <span dir="ltr" className="inline-block font-black">
            {attempt.paymentReference}
          </span>
        </ReviewRow>
        <ReviewRow label="مبلغ">
          <FinanceAmount value={attempt.amount} className="font-black" />
        </ReviewRow>
        <ReviewRow label={paidAt ? "زمان پرداخت" : "زمان ثبت"}>
          {formatPersianDateTime(paidAt || attempt.createdAt)}
        </ReviewRow>
      </dl>
    </div>
  );
}

function ReviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/70 pb-3 last:border-0 last:pb-0">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-end font-bold text-ink">{children}</dd>
    </div>
  );
}
