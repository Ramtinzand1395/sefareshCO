export default function PurchaseRequestComparisonLoading() {
  return (
    <div className="cafe-content-container space-y-6" role="status" aria-label="در حال بارگذاری مقایسه پیشنهادها">
      <div className="animate-pulse space-y-6" aria-hidden="true">
        <div className="h-10 w-44 rounded-control bg-line/60" />
        <div className="h-64 rounded-card border border-line bg-surface" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="space-y-4 rounded-card border border-line bg-surface p-5">
                <div className="h-16 rounded-control bg-surface-subtle" />
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="h-56 rounded-card bg-surface-subtle" />
                  <div className="h-56 rounded-card bg-surface-subtle" />
                </div>
              </div>
            ))}
          </div>
          <div className="h-96 rounded-card border border-line bg-surface" />
        </div>
      </div>
      <span className="sr-only">در حال دریافت پیشنهادهای تأمین‌کنندگان…</span>
    </div>
  );
}
