export default function ComparisonLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="در حال بارگذاری مقایسه">
      <div className="animate-pulse space-y-3" aria-hidden="true">
        <div className="h-5 w-40 rounded bg-line/60" />
        <div className="h-32 rounded-card border border-line bg-surface" />
        <div className="h-28 rounded-card border border-line bg-surface" />
        <div className="h-16 rounded-card bg-primary-soft" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-64 rounded-card border border-line bg-surface" />
          ))}
        </div>
      </div>
      <span className="sr-only">در حال دریافت پیشنهادهای تأمین‌کنندگان…</span>
    </div>
  );
}
