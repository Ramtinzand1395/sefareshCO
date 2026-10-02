import Link from "next/link";

export default function SupplierOrderNotFound() {
  return (
    <div className="supplier-content-container">
      <section className="flex min-h-72 flex-col items-center justify-center rounded-card border border-dashed border-line bg-surface p-8 text-center shadow-card">
        <h1 className="text-lg font-black text-ink">سفارش پیدا نشد</h1>
        <p className="mt-2 text-sm leading-7 text-ink-muted">این سفارش وجود ندارد یا برای این تأمین‌کننده قابل مشاهده نیست.</p>
        <Link href="/supplier/orders" className="mt-5 inline-flex min-h-11 items-center rounded-control bg-primary px-5 text-sm font-black text-white">بازگشت به سفارش‌ها</Link>
      </section>
    </div>
  );
}
