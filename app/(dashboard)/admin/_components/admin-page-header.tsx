import type { ReactNode } from "react";

export function AdminPageHeader({
  title,
  description,
  meta,
  actions,
}: {
  title: string;
  description: string;
  meta?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-black tracking-wide text-primary">
          پنل مدیریت سفارش
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-muted sm:text-base">
          {description}
        </p>
        {meta ? (
          <p className="mt-2 text-xs font-bold text-ink-muted">{meta}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
