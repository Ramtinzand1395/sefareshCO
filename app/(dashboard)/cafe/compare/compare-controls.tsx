"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { IconClock, IconCoins, IconNumber } from "@tabler/icons-react";

import {
  buyerCompareQuantitySchema,
  type BuyerCompareSort,
} from "@/src/domain/schemas/cafe-catalog";
import { formatPersianNumber } from "@/src/lib/persian-format";

export function CompareControls({
  currentQuantity,
  quantityInput,
  quantityError,
  currentSortBy,
  productUnit,
}: {
  currentQuantity: number | null;
  quantityInput: string;
  quantityError?: string;
  currentSortBy: BuyerCompareSort;
  productUnit: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [quantityDraft, setQuantityDraft] = useState(quantityInput);
  const [clientError, setClientError] = useState(quantityError);

  const isDirty =
    currentQuantity === null || quantityDraft.trim() !== String(currentQuantity);
  const visibleError = clientError;

  function navigate(params: URLSearchParams) {
    if (isPending) return;
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  function handleQuantitySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedQuantity = buyerCompareQuantitySchema.safeParse(quantityDraft);

    if (!parsedQuantity.success) {
      setClientError(
        parsedQuantity.error.issues[0]?.message ?? "تعداد واردشده معتبر نیست",
      );
      return;
    }

    setClientError(undefined);
    const params = new URLSearchParams(searchParams.toString());
    params.set("quantity", String(parsedQuantity.data));
    if (currentSortBy === "price") params.delete("sortBy");
    navigate(params);
  }

  function applySort(sortBy: BuyerCompareSort) {
    if (currentQuantity === null || isPending) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("quantity", String(currentQuantity));
    if (sortBy === "deliveryDays") {
      params.set("sortBy", "deliveryDays");
    } else {
      params.delete("sortBy");
    }
    navigate(params);
  }

  return (
    <section
      aria-label="تنظیم تعداد و مرتب‌سازی پیشنهادها"
      aria-busy={isPending}
      className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(18rem,1fr)_auto] lg:items-end">
        <form onSubmit={handleQuantitySubmit} noValidate>
          <label htmlFor="compare-quantity" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink-muted">
            <IconNumber className="size-4 text-primary" aria-hidden="true" />
            تعداد موردنیاز
          </label>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <div className="relative flex min-w-0 items-center">
                <input
                  id="compare-quantity"
                  name="quantity"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={quantityDraft}
                  disabled={isPending}
                  aria-invalid={Boolean(visibleError)}
                  aria-describedby="compare-quantity-help compare-quantity-error"
                  onChange={(event) => {
                    setQuantityDraft(event.target.value);
                    if (clientError) setClientError(undefined);
                  }}
                  className="h-11 min-w-0 flex-1 rounded-s-control border border-line bg-surface px-3 text-center text-sm font-black tabular-nums text-ink outline-none transition focus:border-primary disabled:cursor-wait disabled:opacity-60"
                />
                <span className="flex h-11 shrink-0 items-center rounded-e-control border border-s-0 border-line bg-surface-subtle px-3 text-xs font-bold text-ink-muted">
                  {productUnit}
                </span>
              </div>
              <div id="compare-quantity-help" className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[11px] leading-5 text-ink-muted">
                {currentQuantity !== null ? (
                  <span>
                    تعداد اعمال‌شده: <strong className="text-ink">{formatPersianNumber(currentQuantity)} {productUnit}</strong>
                  </span>
                ) : (
                  <span>هنوز تعداد معتبری اعمال نشده است.</span>
                )}
                {isDirty && !visibleError ? (
                  <span className="font-bold text-warning">مقدار در حال ویرایش هنوز اعمال نشده است.</span>
                ) : null}
              </div>
              <p id="compare-quantity-error" className="mt-1 min-h-5 text-xs font-bold text-danger" aria-live="polite">
                {visibleError ?? ""}
              </p>
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="min-h-11 shrink-0 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
            >
              اعمال تعداد
            </button>
          </div>
        </form>

        <div>
          <p className="mb-1.5 text-xs font-bold text-ink-muted">مرتب‌سازی پیشنهادها</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="مرتب‌سازی پیشنهادها">
            <button
              type="button"
              aria-pressed={currentSortBy === "price"}
              disabled={isPending || currentQuantity === null}
              onClick={() => applySort("price")}
              className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                currentSortBy === "price"
                  ? "bg-primary text-white"
                  : "border border-line bg-surface text-ink-muted hover:border-primary hover:text-primary"
              }`}
            >
              <IconCoins className="size-4" aria-hidden="true" />
              کمترین قیمت
            </button>
            <button
              type="button"
              aria-pressed={currentSortBy === "deliveryDays"}
              disabled={isPending || currentQuantity === null}
              onClick={() => applySort("deliveryDays")}
              className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                currentSortBy === "deliveryDays"
                  ? "bg-primary text-white"
                  : "border border-line bg-surface text-ink-muted hover:border-primary hover:text-primary"
              }`}
            >
              <IconClock className="size-4" aria-hidden="true" />
              سریع‌ترین تحویل
            </button>
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live="polite" role="status">
        {isPending ? "در حال به‌روزرسانی مقایسه" : ""}
      </p>
    </section>
  );
}
