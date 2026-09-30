export default function CatalogLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="در حال بارگذاری کاتالوگ">
      <div className="animate-pulse space-y-3" aria-hidden="true">
        <div className="h-9 w-48 rounded-control bg-line/70" />
        <div className="h-5 max-w-xl rounded-control bg-line/50" />
      </div>
      <div className="animate-pulse rounded-card border border-line bg-surface p-5" aria-hidden="true">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-11 rounded-control bg-line/60 lg:col-span-2" />
          <div className="h-11 rounded-control bg-line/60" />
        </div>
      </div>
      <div className="cafe-catalog-grid grid gap-4" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="animate-pulse overflow-hidden rounded-card border border-line bg-surface">
            <div className="h-40 bg-line/45" />
            <div className="space-y-3 p-4">
              <div className="h-4 w-20 rounded bg-line/60" />
              <div className="h-6 w-4/5 rounded bg-line/70" />
              <div className="h-16 rounded-control bg-line/45" />
              <div className="h-11 rounded-control bg-line/70" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">در حال دریافت کالاها…</span>
    </div>
  );
}
