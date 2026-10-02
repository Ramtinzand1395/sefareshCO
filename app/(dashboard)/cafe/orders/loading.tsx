export default function CafeOrdersLoading() {
  return <OrdersLoadingSkeleton containerClass="cafe-content-container" />;
}

function OrdersLoadingSkeleton({ containerClass }: { containerClass: string }) {
  return (
    <div className={`${containerClass} animate-pulse space-y-6`} aria-label="در حال بارگذاری سفارش‌ها" aria-busy="true">
      <div className="space-y-3"><div className="h-3 w-36 rounded bg-line" /><div className="h-8 w-48 rounded bg-line" /><div className="h-4 w-full max-w-xl rounded bg-line" /></div>
      <div className="flex gap-2 overflow-hidden">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-10 w-24 shrink-0 rounded-control bg-line" />)}</div>
      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="h-12 bg-surface-subtle" />
        {Array.from({ length: 6 }).map((_, index) => <div key={index} className="grid grid-cols-4 gap-4 border-t border-line p-4"><div className="h-4 rounded bg-line" /><div className="h-4 rounded bg-line" /><div className="h-4 rounded bg-line" /><div className="h-4 rounded bg-line" /></div>)}
      </div>
    </div>
  );
}
