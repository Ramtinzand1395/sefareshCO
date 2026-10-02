export default function AdminFinanceLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse space-y-6" aria-label="در حال بارگذاری مدیریت مالی" aria-busy="true">
      <div className="rounded-card border border-line bg-surface p-6 shadow-card"><div className="h-3 w-24 rounded bg-line" /><div className="mt-3 h-8 w-40 rounded bg-line" /><div className="mt-3 h-4 w-full max-w-xl rounded bg-line" /></div>
      <div className="flex gap-2 rounded-card border border-line bg-surface p-2 shadow-card">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-10 w-24 rounded-control bg-line" />)}</div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-36 rounded-card border border-line bg-surface p-5 shadow-card"><div className="h-3 w-24 rounded bg-line" /><div className="mt-4 h-7 w-32 rounded bg-line" /></div>)}</div>
      <span className="sr-only">در حال بارگذاری…</span>
    </div>
  );
}
