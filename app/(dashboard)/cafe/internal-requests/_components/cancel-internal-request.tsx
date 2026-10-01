"use client";

import { IconAlertTriangle, IconBan } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useRef, useState } from "react";

import {
  cancelInternalPurchaseRequestAction,
  type InternalPurchaseRequestActionState,
} from "@/app/actions/internal-purchase-requests";
import { InternalRequestDialog } from "@/app/(dashboard)/cafe/internal-requests/_components/internal-request-dialog";

const initialActionState: InternalPurchaseRequestActionState = {};

export function CancelInternalRequest({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const router = useRouter();
  const submitAction = useCallback(
    async (
      previousState: InternalPurchaseRequestActionState,
      payload: FormData,
    ) => {
      const result = await cancelInternalPurchaseRequestAction(
        previousState,
        payload,
      );
      if (result.ok) {
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    [router],
  );
  const [state, formAction, isPending] = useActionState(
    submitAction,
    initialActionState,
  );
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-danger/30 bg-surface px-4 text-sm font-black text-danger transition hover:bg-danger-soft sm:w-auto"
      >
        <IconBan className="size-4" aria-hidden="true" />
        لغو درخواست
      </button>

      <InternalRequestDialog
        open={open}
        title="لغو این درخواست؟"
        description="پس از لغو، این درخواست دیگر قابل بررسی نیست. در صورت نیاز دلیل لغو را برای اعضای تیم ثبت کنید."
        onClose={() => setOpen(false)}
        busy={isPending}
        size="sm"
        initialFocusRef={reasonRef}
      >
        <form action={formAction} className="p-4 sm:p-6">
          <input type="hidden" name="requestId" value={requestId} />
          <div className="mb-4 flex items-start gap-3 rounded-control bg-danger-soft p-3 text-danger">
            <IconAlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="text-xs font-bold leading-6">
              این عملیات روی وضعیت درخواست اثر نهایی دارد. قبل از ادامه از تصمیم خود مطمئن شوید.
            </p>
          </div>

          {state.error ? <p role="alert" className="mb-4 text-xs font-bold leading-6 text-danger">{state.error}</p> : null}

          <label htmlFor="cancel-reason" className="mb-1.5 block text-xs font-bold text-ink-muted">
            دلیل لغو
          </label>
          <textarea
            ref={reasonRef}
            id="cancel-reason"
            name="cancelReason"
            maxLength={500}
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={isPending}
            placeholder="اختیاری؛ مثلاً نیاز برطرف شد یا درخواست اشتباه ثبت شد"
            className="w-full resize-y rounded-control border border-line bg-surface px-3 py-2.5 text-sm leading-7 text-ink outline-none transition focus:border-primary disabled:opacity-60"
          />

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setOpen(false)} disabled={isPending} className="min-h-11 rounded-control border border-line px-4 text-sm font-bold text-ink-muted transition hover:bg-surface-subtle disabled:opacity-50">
              انصراف
            </button>
            <button type="submit" disabled={isPending} className="min-h-11 rounded-control bg-danger px-5 text-sm font-black text-white transition hover:brightness-95 disabled:opacity-50">
              {isPending ? "در حال لغو…" : "تأیید لغو درخواست"}
            </button>
          </div>
        </form>
      </InternalRequestDialog>
    </>
  );
}
