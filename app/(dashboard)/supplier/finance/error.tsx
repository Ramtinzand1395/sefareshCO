"use client";

import { IconAlertTriangle } from "@tabler/icons-react";

export default function SupplierFinanceError({ reset }: { reset: () => void }) {
  return (
    <section className="mx-auto flex min-h-[55vh] w-full max-w-3xl items-center justify-center">
      <div className="w-full rounded-card border border-danger/20 bg-surface p-6 text-center shadow-card sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-danger-soft text-danger">
          <IconAlertTriangle className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-black text-ink">دریافت اطلاعات مالی انجام نشد</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-ink-muted">
          ارتباط با اطلاعات مالی برقرار نشد. لطفاً دوباره تلاش کنید.
        </p>
        <button type="button" onClick={reset} className="mt-6 min-h-11 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover">
          تلاش دوباره
        </button>
      </div>
    </section>
  );
}
