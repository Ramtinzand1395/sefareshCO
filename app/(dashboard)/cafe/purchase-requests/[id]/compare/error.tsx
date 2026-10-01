"use client";

import { IconAlertCircle, IconArrowRight } from "@tabler/icons-react";
import Link from "next/link";

export default function PurchaseRequestComparisonError({ retry }: { retry: () => void }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-card border border-danger/30 bg-surface p-8 text-center shadow-card">
      <span className="grid size-14 place-items-center rounded-full bg-danger-soft text-danger">
        <IconAlertCircle className="size-7" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-lg font-black text-ink">بارگذاری مقایسه پیشنهادها انجام نشد</h1>
      <p className="mt-2 max-w-md text-sm leading-7 text-ink-muted">خطای غیرمنتظره‌ای رخ داد. می‌توانید دوباره تلاش کنید یا به فهرست استعلام‌ها برگردید.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={retry} className="min-h-11 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover">تلاش دوباره</button>
        <Link href="/cafe/purchase-requests" className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-line px-4 text-sm font-bold text-ink-muted transition hover:border-primary hover:text-primary">
          <IconArrowRight className="size-4" aria-hidden="true" />
          فهرست استعلام‌ها
        </Link>
      </div>
    </div>
  );
}
