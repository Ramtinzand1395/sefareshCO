import Link from "next/link";

export default function SupplierRequestNotFound() {
  return (
    <section className="mx-auto max-w-2xl rounded-card border border-line bg-surface p-6 text-center shadow-card">
      <h1 className="text-xl font-black text-ink">درخواست استعلام پیدا نشد</h1>
      <p className="mt-3 text-sm leading-7 text-ink-muted">
        این درخواست وجود ندارد یا به فضای تأمین‌کننده شما تعلق ندارد.
      </p>
      <Link href="/supplier/requests" className="mt-5 inline-flex min-h-11 items-center rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover">
        بازگشت به درخواست‌ها
      </Link>
    </section>
  );
}
