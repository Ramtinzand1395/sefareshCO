"use client";

import { IconAlertCircle, IconRefresh } from "@tabler/icons-react";

export function OrderRouteError({ reset }: { reset: () => void }) {
  return (
    <section className="flex min-h-72 flex-col items-center justify-center rounded-card border border-danger/25 bg-surface p-8 text-center shadow-card">
      <span className="grid size-14 place-items-center rounded-full bg-danger-soft text-danger">
        <IconAlertCircle className="size-7" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-black text-ink">نمایش سفارش‌ها با خطا روبه‌رو شد</h2>
      <p className="mt-2 max-w-lg text-sm leading-7 text-ink-muted">
        اطلاعات این بخش در دسترس نیست. بدون تغییر داده‌ها دوباره تلاش کنید.
      </p>
      <button type="button" onClick={reset} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover">
        <IconRefresh className="size-4" aria-hidden="true" />
        تلاش دوباره
      </button>
    </section>
  );
}
