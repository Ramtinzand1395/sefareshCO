export default function SupplierOrderDetailLoading() {
  return (
    <div className="supplier-content-container animate-pulse space-y-6" aria-label="در حال بارگذاری جزئیات سفارش" aria-busy="true">
      <div className="h-10 w-44 rounded bg-line" />
      <div className="rounded-card border border-line bg-surface p-6"><div className="h-6 w-28 rounded bg-line" /><div className="mt-4 h-9 w-72 max-w-full rounded bg-line" /><div className="mt-6 grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-16 rounded-control bg-surface-subtle" />)}</div></div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]"><div className="space-y-6"><div className="h-80 rounded-card border border-line bg-surface" /><div className="h-64 rounded-card border border-line bg-surface" /></div><div className="space-y-4"><div className="h-24 rounded-card border border-line bg-surface" /><div className="h-56 rounded-card border border-line bg-surface" /><div className="h-40 rounded-card border border-line bg-surface" /></div></div>
    </div>
  );
}
