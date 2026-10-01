"use client";

import {
  IconAlertTriangle,
  IconBan,
  IconSend,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import {
  cancelPurchaseRequestAction,
  submitPurchaseRequestAction,
} from "@/app/actions/purchase-requests";
import { InternalRequestDialog } from "@/app/(dashboard)/cafe/internal-requests/_components/internal-request-dialog";

type Dialog = "submit" | "cancel" | null;

function safeActionError(message?: string) {
  if (
    !message ||
    /mongo|mongoose|validation failed|cast to|stack|\bat\s+\w+/i.test(message)
  ) {
    return "عملیات انجام نشد. لطفاً دوباره تلاش کنید.";
  }
  return message.slice(0, 300);
}

export function PurchaseRequestActions({
  requestId,
  canSubmit,
  canCancel,
}: {
  requestId: string;
  canSubmit: boolean;
  canCancel: boolean;
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const submitRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  function runSubmit() {
    if (isPending) return;
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await submitPurchaseRequestAction({}, { requestId });
        if (!result.ok) {
          setError(safeActionError(result.error));
          return;
        }
        setDialog(null);
        setFeedback("استعلام با موفقیت ثبت و ارسال شد.");
        router.refresh();
      } catch {
        setError("ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.");
      }
    });
  }

  function runCancel() {
    if (isPending) return;
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await cancelPurchaseRequestAction(
          {},
          { requestId, reason: reason.trim() || undefined },
        );
        if (!result.ok) {
          setError(safeActionError(result.error));
          return;
        }
        setDialog(null);
        setFeedback("استعلام با موفقیت لغو شد و مقدارهای آن دوباره قابل استعلام‌اند.");
        router.refresh();
      } catch {
        setError("ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.");
      }
    });
  }

  if (!canSubmit && !canCancel && !feedback) return null;

  return (
    <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:items-end">
      <div aria-live="polite" aria-atomic="true">
        {feedback ? (
          <p className="rounded-control border border-success/25 bg-success-soft px-4 py-3 text-xs font-bold leading-6 text-success">
            {feedback}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {canCancel ? (
          <button type="button" onClick={() => { setError(null); setDialog("cancel"); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-danger/30 bg-surface px-4 text-sm font-black text-danger transition hover:bg-danger-soft">
            <IconBan className="size-4" aria-hidden="true" />
            لغو استعلام
          </button>
        ) : null}
        {canSubmit ? (
          <button type="button" onClick={() => { setError(null); setDialog("submit"); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover">
            <IconSend className="size-4" aria-hidden="true" />
            ثبت و ارسال استعلام
          </button>
        ) : null}
      </div>

      <InternalRequestDialog open={dialog === "submit"} title="استعلام ثبت و ارسال شود؟" description="پس از ارسال، این استعلام رسمی می‌شود و آماده ورود به مرحله تطبیق با تأمین‌کنندگان خواهد بود." onClose={() => setDialog(null)} busy={isPending} size="sm" initialFocusRef={submitRef}>
        <div className="p-4 sm:p-6">
          {error ? <p role="alert" className="mb-4 rounded-control border border-danger/25 bg-danger-soft px-4 py-3 text-xs font-bold leading-6 text-danger">{error}</p> : null}
          <div className="flex items-start gap-3 rounded-control bg-primary-soft p-3 text-primary"><IconAlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><p className="text-xs font-bold leading-6">اقلام و مقدارهای ثبت‌شده بدون تغییر وارد فرایند رسمی استعلام می‌شوند.</p></div>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setDialog(null)} disabled={isPending} className="min-h-11 rounded-control border border-line px-4 text-sm font-bold text-ink-muted transition hover:bg-surface-subtle disabled:opacity-50">بازگشت</button><button ref={submitRef} type="button" onClick={runSubmit} disabled={isPending} className="min-h-11 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover disabled:opacity-50">{isPending ? "در حال ارسال…" : "بله، ثبت و ارسال شود"}</button></div>
        </div>
      </InternalRequestDialog>

      <InternalRequestDialog open={dialog === "cancel"} title="لغو این استعلام؟" description="با لغو استعلام، مقدارهای رزروشده آن دوباره در لیست خرید قابل استعلام می‌شوند." onClose={() => setDialog(null)} busy={isPending} size="sm" initialFocusRef={reasonRef}>
        <div className="p-4 sm:p-6">
          {error ? <p role="alert" className="mb-4 rounded-control border border-danger/25 bg-danger-soft px-4 py-3 text-xs font-bold leading-6 text-danger">{error}</p> : null}
          <label htmlFor="rfq-cancel-reason" className="mb-1.5 block text-xs font-bold text-ink-muted">دلیل لغو</label>
          <textarea ref={reasonRef} id="rfq-cancel-reason" maxLength={500} rows={4} value={reason} onChange={(event) => setReason(event.target.value)} disabled={isPending} placeholder="اختیاری؛ مثلاً نیاز برطرف شد یا مقدارها تغییر کردند" className="w-full resize-y rounded-control border border-line bg-surface px-3 py-2.5 text-sm leading-7 text-ink outline-none transition focus:border-primary disabled:opacity-60" />
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setDialog(null)} disabled={isPending} className="min-h-11 rounded-control border border-line px-4 text-sm font-bold text-ink-muted transition hover:bg-surface-subtle disabled:opacity-50">انصراف</button><button type="button" onClick={runCancel} disabled={isPending} className="min-h-11 rounded-control bg-danger px-5 text-sm font-black text-white transition hover:brightness-95 disabled:opacity-50">{isPending ? "در حال لغو…" : "تأیید لغو استعلام"}</button></div>
        </div>
      </InternalRequestDialog>
    </div>
  );
}
