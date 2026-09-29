import Link from "next/link";

import type { AdminPaginationMeta } from "@/src/lib/admin-query";

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
    <div className="flex items-center justify-between border-t border-line px-4 py-3">
      <p className="text-xs text-ink-muted">
        صفحه {pagination.page.toLocaleString("fa-IR")} از{" "}
        {pagination.totalPages.toLocaleString("fa-IR")} — مجموع{" "}
        {pagination.total.toLocaleString("fa-IR")} {entityLabel}
      </p>
      <div className="flex gap-2">
        {pagination.hasPreviousPage && previousHref ? (
          <Link
            href={previousHref}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-muted transition hover:border-primary hover:text-primary"
          >
            قبلی
          </Link>
        ) : null}
        {pagination.hasNextPage && nextHref ? (
          <Link
            href={nextHref}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-muted transition hover:border-primary hover:text-primary"
          >
            بعدی
          </Link>
        ) : null}
      </div>
    </div>
  );
}
