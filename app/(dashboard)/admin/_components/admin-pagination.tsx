import Link from "next/link";

import type { AdminPaginationMeta } from "@/src/lib/admin-query";
import { formatPersianNumber } from "@/src/lib/persian-format";

export function AdminPagination({
  pagination,
  entityLabel,
  previousHref,
  nextHref,
}: {
  pagination: AdminPaginationMeta;
  entityLabel: string;
  previousHref?: string;
  nextHref?: string;
}) {
  if (pagination.totalPages <= 1) return null;

  return (
    <nav
      aria-label="صفحه‌بندی"
      className="flex flex-col gap-3 border-t border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-xs text-ink-muted">
        صفحه {formatPersianNumber(pagination.page)} از{" "}
        {formatPersianNumber(pagination.totalPages)} — مجموع{" "}
        {formatPersianNumber(pagination.total)} {entityLabel}
      </p>
      <div className="flex gap-2 self-end sm:self-auto">
        {pagination.hasPreviousPage && previousHref ? (
          <Link
            href={previousHref}
            className="inline-flex min-h-10 items-center rounded-lg border border-line px-4 text-xs font-bold text-ink-muted transition hover:border-primary hover:text-primary"
          >
            قبلی
          </Link>
        ) : null}
        {pagination.hasNextPage && nextHref ? (
          <Link
            href={nextHref}
            className="inline-flex min-h-10 items-center rounded-lg border border-line px-4 text-xs font-bold text-ink-muted transition hover:border-primary hover:text-primary"
          >
            بعدی
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
