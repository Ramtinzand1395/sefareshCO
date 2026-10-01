"use client";

export default function SupplierRequestsError({ reset }: { reset: () => void }) {
  return (
    <section className="mx-auto max-w-2xl rounded-card border border-danger/20 bg-surface p-6 text-center shadow-card">
      <h1 className="text-xl font-black text-ink">بارگذاری درخواست‌ها انجام نشد</h1>
      <p className="mt-3 text-sm leading-7 text-ink-muted">
        در دریافت اطلاعات مشکلی پیش آمد. لطفاً دوباره تلاش کنید.
      </p>
      <button type="button" onClick={reset} className="mt-5 min-h-11 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover">
        تلاش دوباره
      </button>
    </section>
  );
}
