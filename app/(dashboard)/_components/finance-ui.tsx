import { IconAlertTriangle, IconInbox } from "@tabler/icons-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type {
  PaymentStatus,
  SupplierPayableStatus,
} from "@/src/domain/finance";
import {
  formatPersianNumber,
  formatToman,
} from "@/src/lib/persian-format";

const paymentStatusConfig: Record<
  PaymentStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "در انتظار",
    className: "border-warning/25 bg-warning-soft text-warning",
  },
  paid: {
    label: "موفق",
    className: "border-success/25 bg-success-soft text-success",
  },
  failed: {
    label: "ناموفق",
    className: "border-danger/25 bg-danger-soft text-danger",
  },
  cancelled: {
    label: "لغوشده",
    className: "border-line bg-surface-subtle text-ink-muted",
  },
};

const payableStatusConfig: Record<
  SupplierPayableStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "در انتظار تکمیل سفارش",
    className: "border-line bg-surface-subtle text-ink-muted",
  },
  eligible: {
    label: "آماده تسویه",
    className: "border-warning/25 bg-warning-soft text-warning",
  },
  settled: {
    label: "تسویه‌شده",
    className: "border-success/25 bg-success-soft text-success",
  },
  cancelled: {
    label: "لغوشده",
    className: "border-line bg-surface-subtle text-ink-muted",
  },
};

const badgeClassName =
  "inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black";

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const config = paymentStatusConfig[status];
  return (
    <span className={`${badgeClassName} ${config.className}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {config.label}
    </span>
  );
}

export function PayableStatusBadge({
  status,
}: {
  status: SupplierPayableStatus;
}) {
  const config = payableStatusConfig[status];
  return (
    <span className={`${badgeClassName} ${config.className}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {config.label}
    </span>
  );
}

export function FinanceAmount({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  return (
    <span
      className={`break-words tabular-nums [overflow-wrap:anywhere] ${className}`}
    >
      {formatToman(value)}
    </span>
  );
}

export function FinanceSummaryCard({
  title,
  amount,
  meta,
  tone = "neutral",
  icon,
}: {
  title: string;
  amount: number;
  meta?: string;
  tone?: "neutral" | "warning" | "success" | "primary";
  icon?: ReactNode;
}) {
  const toneClass = {
    neutral: "bg-surface-subtle text-ink-muted",
    warning: "bg-warning-soft text-warning",
    success: "bg-success-soft text-success",
    primary: "bg-primary-soft text-primary",
  }[tone];

  return (
    <article className="min-w-0 rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xs font-black leading-6 text-ink-muted">{title}</h2>
          <FinanceAmount
            value={amount}
            className="mt-2 block text-xl font-black leading-9 text-ink sm:text-2xl"
          />
          {meta ? (
            <p className="mt-2 text-xs font-bold leading-6 text-ink-muted">
              {meta}
            </p>
          ) : null}
        </div>
        {icon ? (
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-xl ${toneClass}`}
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
      </div>
    </article>
  );
}

export function FinanceEmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
        <IconInbox className="size-6" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-sm font-black text-ink">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-md text-xs leading-6 text-ink-muted">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function safeFinanceError(
  message?: string,
  fallback = "دریافت اطلاعات مالی انجام نشد. لطفاً دوباره تلاش کنید.",
) {
  if (
    !message ||
    /mongo|mongoose|duplicate key|validation failed|cast to|stack|zod|provider|\bat\s+\w+/i.test(
      message,
    )
  ) {
    return fallback;
  }
  return message.slice(0, 240);
}

export function FinanceErrorState({
  message,
  compact = false,
}: {
  message?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-card border border-danger/25 bg-surface text-center shadow-card ${
        compact ? "p-5" : "p-8"
      }`}
    >
      <IconAlertTriangle
        className="mx-auto size-9 text-danger"
        aria-hidden="true"
      />
      <h2 className="mt-3 text-base font-black text-ink">
        اطلاعات مالی در دسترس نیست
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-ink-muted">
        {safeFinanceError(message)}
      </p>
    </div>
  );
}

export function FinancePagination({
  page,
  pageSize,
  total,
  previousHref,
  nextHref,
  entityLabel,
}: {
  page: number;
  pageSize: number;
  total: number;
  previousHref: string;
  nextHref: string;
  entityLabel: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="صفحه‌بندی"
      className="flex flex-col gap-3 border-t border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-xs text-ink-muted">
        صفحه {formatPersianNumber(page)} از {formatPersianNumber(totalPages)} —
        مجموع {formatPersianNumber(total)} {entityLabel}
      </p>
      <div className="flex gap-2 self-end sm:self-auto">
        {page > 1 ? (
          <Link
            href={previousHref}
            className="inline-flex min-h-10 items-center rounded-control border border-line px-4 text-xs font-bold text-ink-muted transition hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            قبلی
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link
            href={nextHref}
            className="inline-flex min-h-10 items-center rounded-control border border-line px-4 text-xs font-bold text-ink-muted transition hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            بعدی
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
