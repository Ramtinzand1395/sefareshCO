export default function PurchaseRequestsLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="در حال بارگذاری استعلام‌های قیمت">
      <div className="animate-pulse space-y-3" aria-hidden="true"><div className="h-4 w-36 rounded bg-line/60" /><div className="h-9 w-56 rounded-control bg-line/70" /><div className="h-5 max-w-2xl rounded bg-line/50" /></div>
      <div className="animate-pulse rounded-card border border-line bg-surface p-2 shadow-card" aria-hidden="true"><div className="flex gap-2 overflow-hidden">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-10 w-24 shrink-0 rounded-control bg-line/55" />)}</div></div>
      <div className="animate-pulse overflow-hidden rounded-card border border-line bg-surface shadow-card" aria-hidden="true"><div className="h-20 border-b border-line p-4"><div className="h-5 w-32 rounded bg-line/70" /><div className="mt-2 h-3 w-44 rounded bg-line/45" /></div><div className="grid gap-3 p-3 lg:hidden">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-52 rounded-card border border-line bg-line/35" />)}</div><div className="hidden divide-y divide-line lg:block">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-20 bg-line/25" />)}</div></div>
      <span className="sr-only">در حال دریافت استعلام‌ها…</span>
    </div>
  );
}
