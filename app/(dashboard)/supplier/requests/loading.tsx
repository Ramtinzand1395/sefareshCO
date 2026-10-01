export default function SupplierRequestsLoading() {
  return (
    <div className="cafe-content-container space-y-6" aria-label="در حال بارگذاری درخواست‌های استعلام" aria-busy="true">
      <div className="space-y-3">
        <div className="h-3 w-28 animate-pulse rounded bg-line" />
        <div className="h-9 w-64 max-w-full animate-pulse rounded bg-line" />
        <div className="h-4 w-[32rem] max-w-full animate-pulse rounded bg-line" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-card border border-line bg-surface" />
        ))}
      </div>
      <div className="h-16 animate-pulse rounded-card border border-line bg-surface" />
      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="h-16 animate-pulse border-b border-line bg-surface-subtle" />
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse border-b border-line/70 last:border-0" />
        ))}
      </div>
    </div>
  );
}
