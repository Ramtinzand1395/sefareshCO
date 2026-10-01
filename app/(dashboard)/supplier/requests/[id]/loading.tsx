export default function SupplierRequestDetailLoading() {
  return (
    <div className="cafe-content-container space-y-6" aria-label="در حال بارگذاری جزئیات درخواست" aria-busy="true">
      <div className="h-10 w-48 animate-pulse rounded bg-line" />
      <div className="h-64 animate-pulse rounded-card border border-line bg-surface" />
      <div className="space-y-3">
        <div className="h-6 w-40 animate-pulse rounded bg-line" />
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-52 animate-pulse rounded-card border border-line bg-surface" />
          ))}
        </div>
      </div>
      <div className="h-72 animate-pulse rounded-card border border-line bg-surface" />
    </div>
  );
}
