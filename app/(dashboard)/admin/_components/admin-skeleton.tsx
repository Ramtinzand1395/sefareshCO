export function AdminSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <section
      className="mx-auto w-full max-w-7xl animate-pulse"
      aria-label="در حال بارگذاری"
      aria-busy="true"
    >
      <div className="h-4 w-28 rounded bg-line" />
      <div className="mt-3 h-9 w-60 max-w-full rounded-lg bg-line" />
      <div className="mt-3 h-4 w-full max-w-xl rounded bg-line" />
      <div className="mt-8 rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="h-11 rounded-xl bg-surface-subtle" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="h-16 rounded-xl bg-surface-subtle" />
          ))}
        </div>
      </div>
    </section>
  );
}
