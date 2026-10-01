"use client";

import {
  IconCheck,
  IconClipboardCheck,
  IconMinus,
  IconX,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  reviewInternalPurchaseRequestAction,
  type InternalPurchaseRequestActionState,
} from "@/app/actions/internal-purchase-requests";
import { InternalRequestDialog } from "@/app/(dashboard)/cafe/internal-requests/_components/internal-request-dialog";
import { formatPersianNumber } from "@/src/lib/persian-format";
import type { InternalRequestItemDTO } from "@/src/repositories/internal-purchase-request-repository";

type ReviewDraft = Record<string, { approvedQuantity: string; note: string }>;

const initialActionState: InternalPurchaseRequestActionState = {};

function itemTitle(item: InternalRequestItemDTO) {
  return item.itemType === "catalog"
    ? item.productName || "کالای کاتالوگ"
    : item.customTitle || "کالای خارج از کاتالوگ";
}

function itemUnit(item: InternalRequestItemDTO) {
  return item.itemType === "catalog"
    ? item.productUnit || "واحد"
    : item.customUnit || "واحد";
}

export function InternalRequestReview({
  requestId,
  items,
}: {
  requestId: string;
  items: InternalRequestItemDTO[];
}) {
  const [draft, setDraft] = useState<ReviewDraft>(() =>
    Object.fromEntries(
      items.map((item) => [item.id, { approvedQuantity: "", note: "" }]),
    ),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const confirmedSubmitRef = useRef(false);
  const router = useRouter();
  const submitAction = useCallback(
    async (
      previousState: InternalPurchaseRequestActionState,
      payload: FormData,
    ) => {
      const result = await reviewInternalPurchaseRequestAction(
        previousState,
        payload,
      );
      if (result.ok) router.refresh();
      return result;
    },
    [router],
  );
  const [state, formAction, isPending] = useActionState(
    submitAction,
    initialActionState,
  );

  const parsedItems = useMemo(
    () =>
      items.map((item) => {
        const quantityText = draft[item.id]?.approvedQuantity ?? "";
        const quantity = Number(quantityText);
        const valid =
          quantityText.trim() !== "" &&
          Number.isSafeInteger(quantity) &&
          quantity >= 0 &&
          quantity <= item.requestedQuantity;
        return { item, quantity, valid };
      }),
    [draft, items],
  );

  const summary = useMemo(() => {
    let full = 0;
    let partial = 0;
    let rejected = 0;
    let unset = 0;

    for (const entry of parsedItems) {
      if (!entry.valid) unset += 1;
      else if (entry.quantity === 0) rejected += 1;
      else if (entry.quantity === entry.item.requestedQuantity) full += 1;
      else partial += 1;
    }

    return { full, partial, rejected, unset };
  }, [parsedItems]);

  const serializedItems = JSON.stringify(
    items.map((item) => ({
      itemId: item.id,
      approvedQuantity: Number(draft[item.id]?.approvedQuantity),
      note: draft[item.id]?.note.trim() || undefined,
    })),
  );

  const prepareConfirmation = () => {
    const firstInvalid = parsedItems.find((entry) => !entry.valid);
    if (firstInvalid) {
      setValidationError(
        `مقدار تأییدشده «${itemTitle(firstInvalid.item)}» را بین صفر تا ${formatPersianNumber(firstInvalid.item.requestedQuantity)} وارد کنید.`,
      );
      document.getElementById(`approved-${firstInvalid.item.id}`)?.focus();
      return;
    }
    setValidationError(null);
    setConfirmOpen(true);
  };

  return (
    <section className="overflow-hidden rounded-card border border-primary/25 bg-surface shadow-card" aria-labelledby="review-request-title">
      <div className="border-b border-line bg-primary-soft/55 px-4 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-control bg-primary text-white">
            <IconClipboardCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="review-request-title" className="text-base font-black text-ink">
              بررسی درخواست
            </h2>
            <p className="mt-1 text-xs leading-6 text-ink-muted">
              برای هر قلم مقدار نهایی قابل تأیید را مشخص کنید. وضعیت نهایی درخواست توسط سیستم محاسبه می‌شود.
            </p>
          </div>
        </div>
      </div>

      <form
        ref={formRef}
        action={formAction}
        onSubmit={(event) => {
          if (!confirmedSubmitRef.current) {
            event.preventDefault();
            prepareConfirmation();
            return;
          }
          confirmedSubmitRef.current = false;
        }}
        className="p-4 sm:p-6"
      >
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="items" value={serializedItems} />

        {state.error ? (
          <div role="alert" className="mb-4 rounded-control border border-danger/25 bg-danger-soft px-4 py-3 text-xs font-bold leading-6 text-danger">
            {state.error}
          </div>
        ) : null}

        <div className="space-y-3">
          {items.map((item, index) => {
            const unit = itemUnit(item);
            const fieldErrorId = `approved-${item.id}-error`;
            return (
              <article key={item.id} className="rounded-card border border-line bg-surface-subtle/55 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="grid size-7 place-items-center rounded-full bg-surface text-xs font-black text-primary shadow-xs">
                        {formatPersianNumber(index + 1)}
                      </span>
                      <h3 className="break-words text-sm font-black text-ink">{itemTitle(item)}</h3>
                      <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-black text-ink-muted">
                        {item.itemType === "catalog" ? "کاتالوگ" : "خارج از کاتالوگ"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-ink-muted">
                      مقدار درخواست‌شده: {" "}
                      <strong className="text-base font-black text-ink">
                        {formatPersianNumber(item.requestedQuantity)} {unit}
                      </strong>
                    </p>
                    {item.note ? <p className="mt-2 text-xs leading-6 text-ink-muted">یادداشت درخواست: {item.note}</p> : null}
                  </div>

                  <div className="w-full shrink-0 lg:w-80">
                    <label htmlFor={`approved-${item.id}`} className="mb-1.5 block text-xs font-bold text-ink-muted">
                      مقدار تأییدشده ({unit})
                    </label>
                    <div className="flex gap-2">
                      <input
                        id={`approved-${item.id}`}
                        type="number"
                        min="0"
                        max={item.requestedQuantity}
                        step="1"
                        inputMode="numeric"
                        required
                        value={draft[item.id]?.approvedQuantity ?? ""}
                        onChange={(event) => {
                          setDraft((current) => ({
                            ...current,
                            [item.id]: {
                              ...current[item.id],
                              approvedQuantity: event.target.value,
                            },
                          }));
                          setValidationError(null);
                        }}
                        disabled={isPending}
                        aria-describedby={validationError ? fieldErrorId : undefined}
                        className="h-11 min-w-0 flex-1 rounded-control border border-line bg-surface px-3 text-sm font-black text-ink outline-none transition focus:border-primary disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => setDraft((current) => ({ ...current, [item.id]: { ...current[item.id], approvedQuantity: String(item.requestedQuantity) } }))}
                        disabled={isPending}
                        className="min-h-11 rounded-control border border-success/25 bg-success-soft px-3 text-[11px] font-black text-success transition hover:bg-success hover:text-white disabled:opacity-50"
                      >
                        تأیید کامل
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraft((current) => ({ ...current, [item.id]: { ...current[item.id], approvedQuantity: "0" } }))}
                        disabled={isPending}
                        className="min-h-11 rounded-control border border-danger/25 bg-danger-soft px-3 text-[11px] font-black text-danger transition hover:bg-danger hover:text-white disabled:opacity-50"
                      >
                        رد
                      </button>
                    </div>
                    <label htmlFor={`review-note-${item.id}`} className="mb-1.5 mt-3 block text-xs font-bold text-ink-muted">
                      یادداشت بررسی قلم
                    </label>
                    <input
                      id={`review-note-${item.id}`}
                      type="text"
                      maxLength={300}
                      value={draft[item.id]?.note ?? ""}
                      onChange={(event) => setDraft((current) => ({ ...current, [item.id]: { ...current[item.id], note: event.target.value } }))}
                      disabled={isPending}
                      placeholder="اختیاری"
                      className="h-10 w-full rounded-control border border-line bg-surface px-3 text-xs text-ink outline-none transition focus:border-primary disabled:opacity-60"
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
          <div>
            <label htmlFor="review-notes" className="mb-1.5 block text-xs font-bold text-ink-muted">
              توضیحات نهایی بررسی
            </label>
            <textarea
              id="review-notes"
              name="reviewNotes"
              maxLength={1000}
              rows={4}
              value={reviewNotes}
              onChange={(event) => setReviewNotes(event.target.value)}
              disabled={isPending}
              placeholder="دلیل کاهش مقدار یا نکته‌ای برای ثبت‌کننده درخواست"
              className="w-full resize-y rounded-control border border-line bg-surface px-3 py-2.5 text-sm leading-7 text-ink outline-none transition focus:border-primary disabled:opacity-60"
            />
          </div>

          <div className="rounded-card border border-line bg-surface-subtle p-4" aria-live="polite">
            <h3 className="text-xs font-black text-ink">خلاصه تصمیم فعلی</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <SummaryItem icon={<IconCheck className="size-4" />} label="تأیید کامل" count={summary.full} className="text-success" />
              <SummaryItem icon={<IconMinus className="size-4" />} label="تأیید جزئی" count={summary.partial} className="text-violet" />
              <SummaryItem icon={<IconX className="size-4" />} label="رد شده" count={summary.rejected} className="text-danger" />
              <SummaryItem icon={<IconClipboardCheck className="size-4" />} label="تعیین‌نشده" count={summary.unset} className="text-warning" />
            </div>
          </div>
        </div>

        {validationError ? <p id="review-validation-error" role="alert" className="mt-4 text-xs font-bold leading-6 text-danger">{validationError}</p> : null}

        <div className="mt-5 flex justify-end border-t border-line pt-5">
          <button
            type="button"
            onClick={prepareConfirmation}
            disabled={isPending}
            className="min-h-11 w-full rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover disabled:opacity-50 sm:w-auto"
          >
            {isPending ? "در حال ثبت بررسی…" : "ثبت نهایی بررسی"}
          </button>
        </div>
      </form>

      <InternalRequestDialog
        open={confirmOpen}
        title="ثبت نهایی بررسی؟"
        description="پس از ثبت، درخواست از وضعیت انتظار خارج می‌شود و دیگر امکان بررسی مجدد آن وجود ندارد."
        onClose={() => setConfirmOpen(false)}
        busy={isPending}
        size="sm"
        initialFocusRef={confirmButtonRef}
      >
        <div className="p-4 sm:p-6">
          <p className="text-sm leading-7 text-ink-muted">
            تصمیم برای {formatPersianNumber(items.length)} قلم ثبت خواهد شد: {" "}
            {formatPersianNumber(summary.full)} تأیید کامل، {" "}
            {formatPersianNumber(summary.partial)} تأیید جزئی و {" "}
            {formatPersianNumber(summary.rejected)} رد شده.
          </p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setConfirmOpen(false)} disabled={isPending} className="min-h-11 rounded-control border border-line px-4 text-sm font-bold text-ink-muted transition hover:bg-surface-subtle disabled:opacity-50">
              بازگشت و ویرایش
            </button>
            <button
              ref={confirmButtonRef}
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                confirmedSubmitRef.current = true;
                formRef.current?.requestSubmit();
              }}
              disabled={isPending}
              className="min-h-11 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover disabled:opacity-50"
            >
              بله، بررسی ثبت شود
            </button>
          </div>
        </div>
      </InternalRequestDialog>
    </section>
  );
}

function SummaryItem({
  icon,
  label,
  count,
  className,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  className: string;
}) {
  return (
    <div className="rounded-control bg-surface p-2.5">
      <span className={`inline-flex items-center gap-1.5 font-black ${className}`}>
        {icon}
        {formatPersianNumber(count)}
      </span>
      <p className="mt-1 text-[11px] text-ink-muted">{label}</p>
    </div>
  );
}
