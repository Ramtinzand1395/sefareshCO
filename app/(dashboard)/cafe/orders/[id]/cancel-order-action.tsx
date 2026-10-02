"use client";

import { IconBan } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { InternalRequestDialog } from "@/app/(dashboard)/cafe/internal-requests/_components/internal-request-dialog";
import { cancelCafeOrderAction } from "@/app/actions/orders";

function mutationError(message?: string) {
  if (message && /وضعیت|فقط سفارش.*قابل لغو/.test(message)) {
    return "وضعیت سفارش تغییر کرده و دیگر امکان لغو آن وجود ندارد.";
  }
  if (message && !/mongo|mongoose|validation failed|cast to|stack|zod|\bat\s+\w+/i.test(message)) {
    return message.slice(0, 300);
  }
  return "لغو سفارش انجام نشد. لطفاً دوباره تلاش کنید.";
}

export function CancelOrderAction({ orderId, canCancel }: { orderId: string; canCancel: boolean }) {
  const router = useRouter();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!canCancel && !open && !feedback) return null;

  function submit() {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await cancelCafeOrderAction({ ok: false }, {
          orderId,
          cancelReason: reason.trim() || undefined,
        });
        if (!result.ok) {
          setError(mutationError(result.error));
          if (result.error && /وضعیت|فقط سفارش.*قابل لغو/.test(result.error)) router.refresh();
          return;
        }
        setOpen(false);
        setReason("");
        setFeedback("سفارش لغو شد.");
        router.refresh();
      } catch {
        setError("ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.");
      }
    });
  }

  return (
    <>
      <div aria-live="polite" aria-atomic="true">
        {feedback ? (
          <p className="mb-3 rounded-control border border-success/25 bg-success-soft px-4 py-3 text-xs font-black text-success">{feedback}</p>
        ) : null}
      </div>
      {canCancel ? (
        <button
          type="button"
          onClick={() => { setFeedback(null); setError(null); setOpen(true); }}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-danger/30 bg-danger-soft px-4 text-sm font-black text-danger transition hover:bg-danger/10"
        >
          <IconBan className="size-4" aria-hidden="true" />
          لغو سفارش
        </button>
      ) : null}

      <InternalRequestDialog
        open={open}
        title="لغو سفارش"
        description="این سفارش هنوز توسط تأمین‌کننده تأیید نشده است. آیا از لغو آن مطمئن هستید؟"
        onClose={() => !isPending && setOpen(false)}
        busy={isPending}
        size="sm"
        initialFocusRef={confirmRef}
      >
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
          {error ? <p role="alert" className="mb-4 rounded-control border border-danger/25 bg-danger-soft px-4 py-3 text-xs font-bold leading-6 text-danger">{error}</p> : null}
          <label htmlFor="cancel-reason" className="block text-xs font-black text-ink">دلیل لغو <span className="font-normal text-ink-muted">(اختیاری)</span></label>
          <textarea
            id="cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={4}
            disabled={isPending}
            className="mt-2 w-full resize-y rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
          />
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line p-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={() => setOpen(false)} disabled={isPending} className="min-h-11 rounded-control border border-line px-4 text-sm font-bold text-ink-muted disabled:opacity-50">بازگشت</button>
          <button ref={confirmRef} type="button" onClick={submit} disabled={isPending || !canCancel} className="min-h-11 rounded-control bg-danger px-5 text-sm font-black text-white disabled:opacity-50">
            {isPending ? "در حال لغو…" : "تأیید لغو سفارش"}
          </button>
        </div>
      </InternalRequestDialog>
    </>
  );
}
