"use client";

import { IconAlertCircle } from "@tabler/icons-react";

export default function InternalRequestsError({ retry }: { retry: () => void }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-card border border-danger/30 bg-surface p-8 text-center shadow-card">
      <span className="grid size-14 place-items-center rounded-full bg-danger-soft text-danger">
        <IconAlertCircle className="size-7" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-lg font-black text-ink">دریافت درخواست‌های داخلی انجام نشد</h1>
      <p className="mt-2 max-w-md text-sm leading-7 text-ink-muted">
        در دریافت اطلاعات مشکلی پیش آمد. نشانی و فیلتر فعلی حفظ شده‌اند و می‌توانید دوباره تلاش کنید.
      </p>
      <button type="button" onClick={retry} className="mt-5 min-h-11 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover">
        تلاش دوباره
      </button>
    </div>
  );
}
