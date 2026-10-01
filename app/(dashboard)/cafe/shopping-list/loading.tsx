export default function ShoppingListLoading() {
  return (
    <div className="cafe-content-container animate-pulse space-y-6" aria-busy="true" aria-label="در حال بارگذاری لیست خرید">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" aria-hidden="true">
        <div className="space-y-3">
          <div className="h-3 w-28 rounded-full bg-line/65" />
          <div className="h-8 w-40 rounded-lg bg-line/70" />
          <div className="h-4 w-72 max-w-full rounded-full bg-line/50" />
        </div>
        <div className="h-11 w-full rounded-control bg-primary-soft sm:w-32" />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 rounded-card border border-line bg-surface" />
        ))}
      </div>
      <div className="space-y-3" aria-hidden="true">
        <div className="h-5 w-36 rounded-full bg-line/60" />
        <div className="hidden h-80 rounded-card border border-line bg-surface sm:block" />
        <div className="grid gap-3 sm:hidden">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-56 rounded-card border border-line bg-surface" />
          ))}
        </div>
      </div>
    </div>
  );
}
