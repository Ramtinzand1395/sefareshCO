"use client";

import { IconAlertTriangle } from "@tabler/icons-react";

export default function ShoppingListError({ retry }: { retry: () => void }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-card border border-danger/25 bg-surface p-8 text-center shadow-card">
      <div className="grid size-14 place-items-center rounded-full bg-danger-soft text-danger">
        <IconAlertTriangle className="size-7" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-lg font-black text-ink">بارگذاری لیست خرید انجام نشد</h1>
      <p className="mt-2 max-w-md text-sm leading-7 text-ink-muted">
        ارتباط با اطلاعات لیست خرید برقرار نشد. لطفاً دوباره تلاش کنید.
      </p>
      <button
        type="button"
        onClick={retry}
        className="mt-5 min-h-11 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover"
      >
        تلاش دوباره
      </button>
    </div>
  );
}
