"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { IconClock, IconCoins, IconNumber } from "@tabler/icons-react";

export function CompareControls({
  currentQuantity,
  currentSortBy,
  productUnit,
}: {
  currentQuantity: number;
  currentSortBy: "price" | "deliveryDays";
  productUnit: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [quantity, setQuantity] = useState<number | string>(currentQuantity);

  function applyChanges(newQty: number | string, newSort: string) {
    const params = new URLSearchParams(searchParams.toString());

    const numQty = typeof newQty === "string" ? parseInt(newQty, 10) : newQty;
    if (Number.isSafeInteger(numQty) && numQty > 0) {
      params.set("quantity", numQty.toString());
    } else {
      params.delete("quantity");
    }

    if (newSort === "deliveryDays") {
      params.set("sortBy", "deliveryDays");
    } else {
      params.delete("sortBy"); // "price" is default
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleQuantitySubmit(e: React.FormEvent) {
    e.preventDefault();
    applyChanges(quantity, currentSortBy);
  }

  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Quantity Form */}
        <form
          onSubmit={handleQuantitySubmit}
          className="flex flex-wrap items-center gap-2"
        >
          <label
            htmlFor="compare-quantity"
            className="flex items-center gap-1 text-xs font-bold text-ink-muted"
          >
            <IconNumber className="size-4 text-primary" />
            <span>تعداد مورد نیاز:</span>
          </label>
          <div className="relative flex items-center">
            <input
              id="compare-quantity"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-9 w-28 rounded-control border border-line bg-surface px-3 text-center text-xs font-bold text-ink focus:border-primary focus:outline-none"
            />
            <span className="mr-2 text-xs font-medium text-ink-muted">
              {productUnit}
            </span>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-control bg-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary-hover disabled:opacity-50"
          >
            {isPending ? "محاسبه..." : "محاسبه مجدد"}
          </button>
        </form>

        {/* Sort Toggle */}
        <div className="flex items-center gap-1.5 border-t border-line/60 pt-3 sm:border-t-0 sm:pt-0">
          <span className="text-xs font-bold text-ink-muted">مرتب‌سازی:</span>
          <button
            type="button"
            onClick={() => applyChanges(quantity, "price")}
            className={`inline-flex items-center gap-1 rounded-control px-2.5 py-1.5 text-xs font-bold transition ${
              currentSortBy === "price"
                ? "bg-primary text-white"
                : "border border-line bg-surface text-ink-muted hover:border-primary hover:text-primary"
            }`}
          >
            <IconCoins className="size-3.5" />
            <span>کمترین قیمت</span>
          </button>
          <button
            type="button"
            onClick={() => applyChanges(quantity, "deliveryDays")}
            className={`inline-flex items-center gap-1 rounded-control px-2.5 py-1.5 text-xs font-bold transition ${
              currentSortBy === "deliveryDays"
                ? "bg-primary text-white"
                : "border border-line bg-surface text-ink-muted hover:border-primary hover:text-primary"
            }`}
          >
            <IconClock className="size-3.5" />
            <span>سریع‌ترین تحویل</span>
          </button>
        </div>
      </div>
    </div>
  );
}
