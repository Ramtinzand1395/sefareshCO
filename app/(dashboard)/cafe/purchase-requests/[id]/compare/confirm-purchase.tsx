"use client";

import {
  IconAlertTriangle,
  IconCheck,
  IconRefresh,
  IconShoppingCartCheck,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { InternalRequestDialog } from "@/app/(dashboard)/cafe/internal-requests/_components/internal-request-dialog";
import { createOrdersFromSelectionAction } from "@/app/actions/orders";
import type { PurchaseRequestSelectionDTO } from "@/src/domain/purchase-request-selection";
import { formatPersianNumber, formatToman } from "@/src/lib/persian-format";

type ErrorKind = "stale" | "stock" | "other";

function classifyError(message?: string): { kind: ErrorKind; message: string } {
  if (message && /پیشنهاد.*تغییر|مجدداً بررسی|صفحه مقایسه/.test(message)) {
    return {
      kind: "stale",
      message: "یکی از تأمین‌کنندگان پس از انتخاب شما، پیشنهاد خود را تغییر داده است. قبل از ثبت سفارش، پیشنهادها را دوباره بررسی کنید.",
    };
  }
  if (message && /موجودی|غیرفعال است/.test(message)) {
    return {
      kind: "stock",
      message: "موجودی یکی از اقلام برای ثبت سفارش کافی نیست. پیشنهادها را دوباره بررسی کنید.",
    };
  }
  if (message && !/mongo|mongoose|validation failed|cast to|stack|zod|\bat\s+\w+/i.test(message)) {
    return { kind: "other", message: message.slice(0, 300) };
  }
  return { kind: "other", message: "ثبت سفارش‌ها انجام نشد. لطفاً دوباره تلاش کنید." };
}

function deliveryLabel(days: number) {
  return days === 0 ? "امروز" : `${formatPersianNumber(days)} روز`;
}

export function ConfirmPurchase({
  purchaseRequestId,
  selection,
}: {
  purchaseRequestId: string;
  selection: PurchaseRequestSelectionDTO;
}) {
  const router = useRouter();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<{ kind: ErrorKind; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const partial = selection.totals.partiallySelectedItemCount > 0 || selection.totals.unselectedItemCount > 0;

  function confirmPurchase() {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await createOrdersFromSelectionAction({ ok: false }, { purchaseRequestId });
        if (!result.ok || !result.data) {
          setError(classifyError(result.error));
          return;
        }
        router.push(`/cafe/orders?created=${result.data.orderCount}`);
        router.refresh();
      } catch {
        setError({ kind: "other", message: "ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید." });
      }
    });
  }

  return (
    <>
      <section className="flex flex-col gap-4 rounded-card border border-success/25 bg-success-soft p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-success">
            <IconShoppingCartCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-black text-ink">انتخاب ذخیره‌شده آماده ثبت سفارش است</h2>
            <p className="mt-1 text-xs leading-6 text-ink-muted">پیش از ایجاد سفارش‌ها، مرور نهایی اقلام و مبالغ نمایش داده می‌شود.</p>
          </div>
        </div>
        <button type="button" onClick={() => { setError(null); setOpen(true); }} className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-control bg-success px-5 text-sm font-black text-white transition hover:brightness-95 sm:w-auto">
          <IconCheck className="size-4" aria-hidden="true" />
          تأیید خرید
        </button>
      </section>

      <InternalRequestDialog
        open={open}
        title="تأیید خرید"
        description="با تأیید، انتخاب‌های فعلی به سفارش‌های واقعی برای تأمین‌کنندگان تبدیل می‌شوند و دیگر قابل ویرایش نخواهند بود."
        onClose={() => !isPending && setOpen(false)}
        busy={isPending}
        initialFocusRef={confirmRef}
      >
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
          {error ? (
            <div role="alert" className="mb-4 rounded-control border border-danger/25 bg-danger-soft p-4 text-danger">
              <p className="text-xs font-bold leading-6">{error.message}</p>
              {error.kind === "stale" || error.kind === "stock" ? (
                <button type="button" onClick={() => { setOpen(false); router.refresh(); }} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-control border border-danger/25 bg-surface px-3 text-xs font-black text-danger">
                  <IconRefresh className="size-4" aria-hidden="true" />
                  بازبینی پیشنهادها
                </button>
              ) : null}
            </div>
          ) : null}

          {partial ? (
            <div className="mb-4 flex items-start gap-2 rounded-control border border-warning/25 bg-warning-soft p-3 text-warning">
              <IconAlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p className="text-xs font-bold leading-6">بخشی از نیاز این استعلام هنوز انتخاب نشده است. سفارش فقط برای اقلام انتخاب‌شده ثبت می‌شود.</p>
            </div>
          ) : null}

          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Metric label="تأمین‌کننده" value={selection.supplierGroups.length} suffix="" />
            <Metric label="اقلام انتخاب‌شده" value={selection.totals.selectedItemCount} suffix=" قلم" />
            <MoneyMetric label="جمع کالاها" value={selection.totals.estimatedItemsTotal} />
            <MoneyMetric label="هزینه ارسال" value={selection.totals.shippingTotal} />
            <MoneyMetric label="جمع برآوردی" value={selection.totals.estimatedTotal} strong />
          </dl>

          <div className="mt-5 space-y-4">
            {selection.supplierGroups.map((group) => {
              const groupItems = selection.items.flatMap((item) =>
                item.selections
                  .filter((selected) => selected.supplierId === group.supplierId)
                  .map((selected) => ({ item, selected })),
              );
              return (
                <section key={group.supplierId} className="overflow-hidden rounded-control border border-line">
                  <header className="flex flex-col gap-2 bg-surface-subtle p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-black text-ink">{group.supplierName}</h3>
                      <p className="mt-1 text-xs text-ink-muted">تحویل: {deliveryLabel(group.deliveryDays)}</p>
                    </div>
                    <p className="text-sm font-black text-primary">{formatToman(group.supplierTotal)}</p>
                  </header>
                  <div className="divide-y divide-line">
                    {groupItems.map(({ item, selected }) => (
                      <div key={`${item.purchaseRequestItemId}:${selected.supplierResponseId}`} className="grid gap-2 p-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <div className="min-w-0">
                          <p className="font-black text-ink">{item.title}</p>
                          <p className="mt-1 text-ink-muted">{formatPersianNumber(selected.selectedQuantity)} {item.unit} × {formatToman(selected.unitPrice)}</p>
                        </div>
                        <p className="font-black text-ink sm:text-end">{formatToman(selected.itemSubtotal)}</p>
                      </div>
                    ))}
                  </div>
                  <dl className="grid grid-cols-2 gap-2 border-t border-line bg-surface-subtle p-3 text-xs sm:grid-cols-3">
                    <Summary label="جمع کالاها" value={formatToman(group.itemsSubtotal)} />
                    <Summary label="هزینه ارسال" value={formatToman(group.shippingCost)} />
                    <Summary label="مبلغ این تأمین‌کننده" value={formatToman(group.supplierTotal)} />
                  </dl>
                </section>
              );
            })}
          </div>
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line p-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={() => setOpen(false)} disabled={isPending} className="min-h-11 rounded-control border border-line px-4 text-sm font-bold text-ink-muted disabled:opacity-50">بازگشت</button>
          <button ref={confirmRef} type="button" onClick={confirmPurchase} disabled={isPending} className="min-h-11 rounded-control bg-success px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
            {isPending ? "در حال ثبت سفارش‌ها…" : "تأیید و ثبت سفارش‌ها"}
          </button>
        </div>
      </InternalRequestDialog>
    </>
  );
}

function Metric({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return <div className="rounded-control bg-surface-subtle p-3"><dt className="text-[10px] font-bold text-ink-muted">{label}</dt><dd className="mt-1 text-sm font-black text-ink">{formatPersianNumber(value)}{suffix}</dd></div>;
}

function MoneyMetric({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return <div className={`rounded-control p-3 ${strong ? "bg-primary-soft" : "bg-surface-subtle"}`}><dt className="text-[10px] font-bold text-ink-muted">{label}</dt><dd className={`mt-1 text-xs font-black ${strong ? "text-primary" : "text-ink"}`}>{formatToman(value)}</dd></div>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[10px] text-ink-muted">{label}</dt><dd className="mt-1 font-black text-ink">{value}</dd></div>;
}
