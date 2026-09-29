import { IconInbox } from "@tabler/icons-react";
import type { ReactNode } from "react";

export function AdminInfoRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b border-line/70 py-3 last:border-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-5">
      <dt className="text-xs font-bold text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm leading-7 text-ink">
        {children}
      </dd>
    </div>
  );
}

export function AdminEmptyState({
  title,
  description,
  compact = false,
}: {
  title: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-5 text-center ${
        compact ? "py-8" : "py-12"
      }`}
    >
      <span className="grid size-11 place-items-center rounded-2xl bg-primary-soft text-primary">
        <IconInbox className="size-5" aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-black text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-xs leading-6 text-ink-muted">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function AdminSectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <h2 className="text-base font-black text-ink">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs leading-6 text-ink-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
