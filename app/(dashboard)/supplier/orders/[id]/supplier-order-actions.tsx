"use client";

import {
  IconCheck,
  IconPackageExport,
  IconPackageImport,
  IconTruckDelivery,
  IconX,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { InternalRequestDialog } from "@/app/(dashboard)/cafe/internal-requests/_components/internal-request-dialog";
import {
  confirmSupplierOrderAction,
  markSupplierOrderDeliveredAction,
  markSupplierOrderPreparingAction,
  markSupplierOrderShippedAction,
  rejectSupplierOrderAction,
} from "@/app/actions/orders";
import type { SupplierOrderAllowedActionsDTO } from "@/src/domain/order";

type Mode = "confirm" | "reject" | "preparing" | "shipped" | "delivered";

const dialogCopy: Record<Mode, { title: string; description: string; submit: string }> = {
  confirm: {
    title: "تأیید سفارش",
    description: "با تأیید سفارش، مسئولیت آماده‌سازی اقلام این سفارش را می‌پذیرید.",
    submit: "تأیید سفارش",
  },
  reject: {
    title: "رد سفارش",
    description: "با رد سفارش، این سفارش بسته می‌شود.",
    submit: "رد سفارش",
  },
  preparing: {
    title: "شروع آماده‌سازی",
    description: "وضعیت سفارش به «در حال آماده‌سازی» تغییر می‌کند.",
    submit: "شروع آماده‌سازی",
  },
  shipped: {
    title: "ثبت ارسال سفارش",
    description: "پس از ثبت ارسال، سفارش در انتظار تأیید تحویل خواهد بود.",
    submit: "ثبت ارسال",
  },
  delivered: {
    title: "ثبت تحویل سفارش",
    description: "آیا از تحویل این سفارش مطمئن هستید؟",
    submit: "تأیید تحویل",
  },
};

function raceError(message?: string) {
  return Boolean(message && /وضعیت|امکان .* وجود ندارد/.test(message));
}

function mutationError(message?: string) {
  if (raceError(message)) return "وضعیت سفارش تغییر کرده است. اطلاعات تازه بارگذاری شد؛ لطفاً اکشن‌های مجاز جدید را بررسی کنید.";
  if (message && !/mongo|mongoose|validation failed|cast to|stack|zod|\bat\s+\w+/i.test(message)) return message.slice(0, 300);
  return "تغییر وضعیت سفارش انجام نشد. لطفاً دوباره تلاش کنید.";
}

export function SupplierOrderActions({
  orderId,
  allowedActions,
}: {
  orderId: string;
  allowedActions: SupplierOrderAllowedActionsDTO;
}) {
  const router = useRouter();
  const submitRef = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [reason, setReason] = useState("");
  const [shippingNote, setShippingNote] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasActions = Object.values(allowedActions).some(Boolean);
  const modeAllowed = mode === "confirm"
    ? allowedActions.canConfirm
    : mode === "reject"
      ? allowedActions.canReject
      : mode === "preparing"
        ? allowedActions.canMarkPreparing
        : mode === "shipped"
          ? allowedActions.canMarkShipped
          : mode === "delivered"
            ? allowedActions.canMarkDelivered
            : false;
  if (!hasActions && !feedback && !mode) return null;

  function openDialog(nextMode: Mode) {
    setFeedback(null);
    setError(null);
    setMode(nextMode);
  }

  function submit() {
    if (!mode || isPending) return;
    const submittedMode = mode;
    setError(null);
    startTransition(async () => {
      try {
        const result = submittedMode === "confirm"
          ? await confirmSupplierOrderAction(orderId)
          : submittedMode === "reject"
            ? await rejectSupplierOrderAction({ ok: false }, { orderId, rejectReason: reason.trim() || undefined })
            : submittedMode === "preparing"
              ? await markSupplierOrderPreparingAction(orderId)
              : submittedMode === "shipped"
                ? await markSupplierOrderShippedAction({ ok: false }, { orderId, shippingNote: shippingNote.trim() || undefined })
                : await markSupplierOrderDeliveredAction(orderId);

        if (!result.ok) {
          setError(mutationError(result.error));
          if (raceError(result.error)) router.refresh();
          return;
        }

        setMode(null);
        setReason("");
        setShippingNote("");
        setFeedback(
          submittedMode === "delivered"
            ? "سفارش به‌عنوان تحویل‌شده ثبت شد."
            : submittedMode === "confirm"
              ? "سفارش تأیید شد."
              : submittedMode === "reject"
                ? "سفارش رد شد."
                : submittedMode === "preparing"
                  ? "آماده‌سازی سفارش آغاز شد."
                  : "ارسال سفارش ثبت شد.",
        );
        router.refresh();
      } catch {
        setError("ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.");
      }
    });
  }

  const copy = mode ? dialogCopy[mode] : null;

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card" aria-labelledby="order-actions-heading">
      <h2 id="order-actions-heading" className="text-base font-black text-ink">مدیریت سفارش</h2>
      <div aria-live="polite" aria-atomic="true">
        {feedback ? <p className="mt-3 rounded-control border border-success/25 bg-success-soft px-4 py-3 text-xs font-black text-success">{feedback}</p> : null}
      </div>
      {hasActions ? (
        <div className="mt-4 grid gap-2">
          {allowedActions.canConfirm ? <ActionButton onClick={() => openDialog("confirm")} icon={<IconCheck className="size-4" />} primary>تأیید سفارش</ActionButton> : null}
          {allowedActions.canReject ? <ActionButton onClick={() => openDialog("reject")} icon={<IconX className="size-4" />} danger>رد سفارش</ActionButton> : null}
          {allowedActions.canMarkPreparing ? <ActionButton onClick={() => openDialog("preparing")} icon={<IconPackageImport className="size-4" />} primary>شروع آماده‌سازی</ActionButton> : null}
          {allowedActions.canMarkShipped ? <ActionButton onClick={() => openDialog("shipped")} icon={<IconPackageExport className="size-4" />} primary>ثبت ارسال سفارش</ActionButton> : null}
          {allowedActions.canMarkDelivered ? <ActionButton onClick={() => openDialog("delivered")} icon={<IconTruckDelivery className="size-4" />} primary>ثبت تحویل سفارش</ActionButton> : null}
        </div>
      ) : null}

      {copy ? (
        <InternalRequestDialog
          open={Boolean(mode)}
          title={copy.title}
          description={copy.description}
          onClose={() => !isPending && setMode(null)}
          busy={isPending}
          size="sm"
          initialFocusRef={submitRef}
        >
          <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
            {error ? <p role="alert" className="mb-4 rounded-control border border-danger/25 bg-danger-soft px-4 py-3 text-xs font-bold leading-6 text-danger">{error}</p> : null}
            {mode === "reject" ? (
              <div>
                <label htmlFor="reject-reason" className="block text-xs font-black text-ink">دلیل رد <span className="font-normal text-ink-muted">(اختیاری)</span></label>
                <textarea id="reject-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={4} disabled={isPending} className="mt-2 w-full resize-y rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60" />
              </div>
            ) : null}
            {mode === "shipped" ? (
              <div>
                <label htmlFor="shipping-note" className="block text-xs font-black text-ink">یادداشت ارسال <span className="font-normal text-ink-muted">(اختیاری)</span></label>
                <textarea id="shipping-note" value={shippingNote} onChange={(event) => setShippingNote(event.target.value)} maxLength={500} rows={4} disabled={isPending} className="mt-2 w-full resize-y rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60" />
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line p-4 sm:flex-row sm:justify-end sm:px-6">
            <button type="button" onClick={() => setMode(null)} disabled={isPending} className="min-h-11 rounded-control border border-line px-4 text-sm font-bold text-ink-muted disabled:opacity-50">بازگشت</button>
            <button ref={submitRef} type="button" onClick={submit} disabled={isPending || !modeAllowed} className={`min-h-11 rounded-control px-5 text-sm font-black text-white disabled:opacity-50 ${mode === "reject" ? "bg-danger" : "bg-primary"}`}>
              {isPending ? "در حال ثبت…" : copy.submit}
            </button>
          </div>
        </InternalRequestDialog>
      ) : null}
    </section>
  );
}

function ActionButton({
  children,
  icon,
  onClick,
  primary = false,
  danger = false,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control border px-4 text-sm font-black transition ${
        danger
          ? "border-danger/30 bg-danger-soft text-danger hover:bg-danger/10"
          : primary
            ? "border-primary bg-primary text-white hover:bg-primary-hover"
            : "border-line text-ink-muted"
      }`}
    >
      <span aria-hidden="true">{icon}</span>
      {children}
    </button>
  );
}
