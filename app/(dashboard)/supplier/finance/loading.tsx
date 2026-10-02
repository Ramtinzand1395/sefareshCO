export default function SupplierFinanceLoading() {
  return (
    <div
      className="mx-auto w-full max-w-7xl animate-pulse space-y-6"
      aria-label="در حال بارگذاری امور مالی"
      aria-busy="true"
    >
      <div className="rounded-card border border-line bg-surface p-6 shadow-card">
        <div className="h-3 w-28 rounded bg-line" />
        <div className="mt-3 h-8 w-44 rounded bg-line" />
        <div className="mt-3 h-4 w-full max-w-xl rounded bg-line" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-36 rounded-card border border-line bg-surface p-5 shadow-card">
            <div className="h-3 w-28 rounded bg-line" />
            <div className="mt-4 h-7 w-40 rounded bg-line" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="h-14 border-b border-line bg-surface-subtle" />
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="grid grid-cols-4 gap-4 border-b border-line p-5 last:border-0">
            {Array.from({ length: 4 }, (__, cell) => <div key={cell} className="h-4 rounded bg-line" />)}
          </div>
        ))}
      </div>
      <span className="sr-only">در حال بارگذاری…</span>
    </div>
  );
}
