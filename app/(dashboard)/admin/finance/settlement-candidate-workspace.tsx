"use client";

import {
  IconAlertCircle,
  IconBuildingBank,
  IconCheck,
  IconRefresh,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import {
  FinanceAmount,
  FinanceEmptyState,
} from "@/app/(dashboard)/_components/finance-ui";
import { InternalRequestDialog } from "@/app/(dashboard)/cafe/internal-requests/_components/internal-request-dialog";
import {
  createSupplierSettlementAction,
  type FinanceActionState,
} from "@/app/actions/finance";
import type {
  AdminSettlementCandidateDTO,
  CreateSettlementResultDTO,
} from "@/src/domain/finance";
import {
  formatPersianDateTime,
  formatPersianNumber,
} from "@/src/lib/persian-format";

function settlementError(message?: string) {
  if (/همزمان|رقابت|قبلاً|eligible|تسویه شده|تسویه‌شده|وضعیت/.test(message ?? "")) {
    return {
      message: "برخی مطالبات انتخاب‌شده قبلاً توسط کاربر دیگری تسویه شده‌اند.",
      concurrency: true,
    };
  }
  if (/دسترسی|مدیر/.test(message ?? "")) {
    return { message: "شما دسترسی لازم برای ثبت تسویه را ندارید.", concurrency: false };
  }
  if (/mongo|mongoose|duplicate key|validation failed|cast to|stack|zod|\bat\s+\w+/i.test(message ?? "")) {
    return { message: "ثبت تسویه انجام نشد. لطفاً دوباره تلاش کنید.", concurrency: false };
  }
  return {
    message: message?.slice(0, 240) || "ثبت تسویه انجام نشد. لطفاً دوباره تلاش کنید.",
    concurrency: false,
  };
}

export function SettlementCandidateWorkspace({
  supplierId,
  supplierName,
  candidates,
}: {
  supplierId: string;
  supplierName: string;
  candidates: AdminSettlementCandidateDTO[];
}) {
  const router = useRouter();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "danger";
    message: string;
    concurrency?: boolean;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedCandidates = useMemo(
    () => candidates.filter((candidate) => selected.has(candidate.id)),
    [candidates, selected],
  );
  const selectedTotal = selectedCandidates.reduce(
    (sum, candidate) => sum + candidate.netAmount,
    0,
  );
  const allSelected = candidates.length > 0 && selected.size === candidates.length;

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setFeedback(null);
  };

  const toggleAll = () => {
    setSelected(
      allSelected ? new Set() : new Set(candidates.map((candidate) => candidate.id)),
    );
    setFeedback(null);
  };

  const submit = () => {
    if (selectedCandidates.length === 0 || isPending) return;
    setFeedback(null);
    startTransition(async () => {
      const initialState: FinanceActionState<CreateSettlementResultDTO> = {
        ok: false,
      };
      const result = await createSupplierSettlementAction(initialState, {
        supplierId,
        payableIds: selectedCandidates.map((candidate) => candidate.id),
        note: note.trim() || undefined,
      });

      if (!result.ok || !result.data) {
        const error = settlementError(result.error);
        setFeedback({ tone: "danger", ...error });
        if (error.concurrency) {
          setOpen(false);
          router.refresh();
        }
        return;
      }

      setFeedback({
        tone: "success",
        message: `تسویه با موفقیت ثبت شد. شماره تسویه: ${result.data.settlementNumber}`,
      });
      setSelected(new Set());
      setNote("");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <section aria-labelledby="candidate-supplier-heading" className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="border-b border-line px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold text-ink-muted">تأمین‌کننده منتخب</p>
            <h2 id="candidate-supplier-heading" className="mt-1 text-lg font-black text-ink">{supplierName}</h2>
            <p className="mt-1 text-xs leading-6 text-ink-muted">
              {formatPersianNumber(candidates.length)} مطالبه آماده تسویه
            </p>
          </div>
          <div className="text-start sm:text-end">
            <p className="text-xs text-ink-muted">مجموع آماده تسویه</p>
            <FinanceAmount
              value={candidates.reduce((sum, candidate) => sum + candidate.netAmount, 0)}
              className="mt-1 block text-lg font-black text-ink"
            />
          </div>
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true" className="px-4 pt-4 sm:px-6">
        {feedback ? (
          <div className={`flex items-start gap-2 rounded-control border px-3 py-3 text-xs font-bold leading-6 ${feedback.tone === "success" ? "border-success/25 bg-success-soft text-success" : "border-danger/25 bg-danger-soft text-danger"}`}>
            {feedback.tone === "success" ? <IconCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <IconAlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
            <span className="flex-1">{feedback.message}</span>
            {feedback.concurrency ? (
              <button type="button" onClick={() => router.refresh()} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-control border border-danger/25 px-2.5">
                <IconRefresh className="size-4" aria-hidden="true" />
                به‌روزرسانی فهرست
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {candidates.length === 0 ? (
        <FinanceEmptyState title="در حال حاضر مطالبه‌ای آماده تسویه نیست." />
      ) : (
        <fieldset className="min-w-0">
          <legend className="sr-only">انتخاب مطالبات برای ثبت تسویه</legend>
          <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-xs font-black text-ink">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="size-5 accent-primary" />
              انتخاب همه مطالبات
            </label>
            <div aria-live="polite" aria-atomic="true" className="text-xs font-bold text-ink-muted">
              <span>{formatPersianNumber(selectedCandidates.length)} مطالبه انتخاب شده</span>
              <span className="mx-2" aria-hidden="true">•</span>
              <span>مبلغ تسویه: <FinanceAmount value={selectedTotal} className="font-black text-ink" /></span>
            </div>
          </div>

          <div className="divide-y divide-line md:hidden">
            {candidates.map((candidate) => (
              <label key={candidate.id} className={`block cursor-pointer p-4 transition ${selected.has(candidate.id) ? "bg-primary-soft/35" : "bg-surface"}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={selected.has(candidate.id)} onChange={() => toggle(candidate.id)} className="mt-1 size-5 shrink-0 accent-primary" aria-label={`انتخاب سفارش ${candidate.orderNumber}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <span dir="ltr" className="inline-block font-black text-ink">{candidate.orderNumber}</span>
                      <FinanceAmount value={candidate.netAmount} className="font-black text-ink" />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 rounded-control bg-surface-subtle p-3 text-xs">
                      <CandidateDetail label="مبلغ سفارش"><FinanceAmount value={candidate.grossAmount} /></CandidateDetail>
                      <CandidateDetail label="کارمزد"><FinanceAmount value={candidate.platformFee} /></CandidateDetail>
                      <CandidateDetail label="آماده از">{formatPersianDateTime(candidate.eligibleAt)}</CandidateDetail>
                    </dl>
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-surface-subtle text-xs text-ink-muted">
                <tr>
                  <th scope="col" className="w-16 px-5 py-3 text-start font-black"><span className="sr-only">انتخاب</span></th>
                  <th scope="col" className="px-4 py-3 text-start font-black">شماره سفارش</th>
                  <th scope="col" className="px-4 py-3 text-start font-black">مبلغ سفارش</th>
                  <th scope="col" className="px-4 py-3 text-start font-black">کارمزد</th>
                  <th scope="col" className="px-4 py-3 text-start font-black">خالص تسویه</th>
                  <th scope="col" className="px-5 py-3 text-start font-black">آماده از</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {candidates.map((candidate) => (
                  <tr key={candidate.id} className={selected.has(candidate.id) ? "bg-primary-soft/30" : "transition hover:bg-surface-subtle"}>
                    <td className="px-5 py-4">
                      <input type="checkbox" checked={selected.has(candidate.id)} onChange={() => toggle(candidate.id)} aria-label={`انتخاب سفارش ${candidate.orderNumber}`} className="size-5 accent-primary" />
                    </td>
                    <td className="px-4 py-4"><span dir="ltr" className="inline-block font-black text-ink">{candidate.orderNumber}</span></td>
                    <td className="px-4 py-4 text-ink"><FinanceAmount value={candidate.grossAmount} /></td>
                    <td className="px-4 py-4 text-ink-muted"><FinanceAmount value={candidate.platformFee} /></td>
                    <td className="px-4 py-4 font-black text-ink"><FinanceAmount value={candidate.netAmount} /></td>
                    <td className="px-5 py-4 text-xs text-ink-muted">{formatPersianDateTime(candidate.eligibleAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sticky bottom-0 flex flex-col gap-3 border-t border-line bg-surface/95 px-4 py-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div aria-live="polite" className="text-sm font-black text-ink">
              {formatPersianNumber(selectedCandidates.length)} مطالبه — <FinanceAmount value={selectedTotal} />
            </div>
            <button type="button" onClick={() => { setFeedback(null); setOpen(true); }} disabled={selectedCandidates.length === 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
              <IconBuildingBank className="size-4" aria-hidden="true" />
              ثبت تسویه
            </button>
          </div>
        </fieldset>
      )}

      <InternalRequestDialog
        open={open}
        onClose={() => setOpen(false)}
        title="ثبت تسویه تأمین‌کننده"
        description="با تأیید، این مطالبات به‌عنوان تسویه‌شده ثبت می‌شوند."
        busy={isPending}
        size="sm"
        initialFocusRef={confirmRef}
      >
        <div className="overflow-y-auto p-4 sm:p-6">
          <dl className="space-y-3 rounded-card border border-line bg-surface-subtle p-4 text-sm">
            <DialogRow label="تأمین‌کننده">{supplierName}</DialogRow>
            <DialogRow label="تعداد مطالبات">{formatPersianNumber(selectedCandidates.length)} قلم</DialogRow>
            <DialogRow label="مبلغ کل"><FinanceAmount value={selectedTotal} className="font-black" /></DialogRow>
            <DialogRow label="سفارش‌ها">
              <span dir="ltr" className="inline-block break-words text-xs leading-6">{selectedCandidates.map((candidate) => candidate.orderNumber).join("، ")}</span>
            </DialogRow>
          </dl>
          <div className="mt-4">
            <label htmlFor="settlement-note" className="mb-1.5 block text-xs font-bold text-ink-muted">یادداشت اختیاری</label>
            <textarea id="settlement-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={4} disabled={isPending} className="w-full resize-y rounded-control border border-line bg-surface px-3 py-2.5 text-sm leading-7 text-ink outline-none transition focus:border-primary disabled:opacity-60" placeholder="توضیح داخلی مرتبط با ثبت تسویه" />
            <p className="mt-1 text-[11px] text-ink-muted">حداکثر ۵۰۰ کاراکتر</p>
          </div>
          <p className="mt-4 rounded-control border border-warning/25 bg-warning-soft px-3 py-3 text-xs font-bold leading-6 text-warning">
            این عملیات فقط انجام‌شدن تسویه را در سامانه ثبت می‌کند و به معنی انتقال بانکی خودکار نیست.
          </p>
          <div aria-live="assertive" aria-atomic="true">
            {feedback?.tone === "danger" ? <p role="alert" className="mt-3 text-xs font-bold leading-6 text-danger">{feedback.message}</p> : null}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-line px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={() => setOpen(false)} disabled={isPending} className="min-h-11 rounded-control border border-line px-4 text-sm font-bold text-ink-muted transition hover:bg-surface-subtle disabled:opacity-50">انصراف</button>
          <button ref={confirmRef} type="button" onClick={submit} disabled={isPending || selectedCandidates.length === 0} className="min-h-11 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover disabled:opacity-60">{isPending ? "در حال ثبت…" : "تأیید و ثبت تسویه"}</button>
        </div>
      </InternalRequestDialog>
    </section>
  );
}

function CandidateDetail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-ink-muted">{label}</dt><dd className="mt-1 font-black leading-6 text-ink">{children}</dd></div>;
}

function DialogRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-3 border-b border-line/70 pb-3 last:border-0 last:pb-0"><dt className="shrink-0 text-ink-muted">{label}</dt><dd className="min-w-0 text-end font-bold text-ink">{children}</dd></div>;
}
