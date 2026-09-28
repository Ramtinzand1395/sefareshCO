import { IconArrowRight, IconClock } from "@tabler/icons-react";
import Link from "next/link";

import type { ResolvedDashboardRoute } from "@/app/(dashboard)/dashboard-config";

export function DashboardPlaceholder({
  route,
}: {
  route: ResolvedDashboardRoute;
}) {
  return (
    <section className="mx-auto w-full max-w-6xl">
      <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black text-primary">فضای کاری سفارش</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">
              {route.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-muted sm:text-base">
              {route.description}
            </p>
          </div>
          <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-warning-soft px-3 py-1.5 text-xs font-black text-warning">
            <IconClock className="size-4" aria-hidden="true" />
            در حال توسعه
          </span>
        </div>

        {route.identifier && (
          <div className="mt-7 rounded-xl border border-line bg-surface-subtle px-4 py-3">
            <span className="text-xs font-bold text-ink-muted">شناسه رکورد</span>
            <p className="mt-1 break-all text-sm font-bold text-ink" dir="ltr">
              {route.identifier}
            </p>
          </div>
        )}

        <div className="mt-8 border-t border-line pt-6">
          <p className="text-sm leading-7 text-ink-muted">
            ساختار Route، دسترسی نقش و جایگاه این صفحه در منو آماده است. قابلیت عملیاتی آن در مرحله بعد به سرویس Domain مربوط متصل می‌شود.
          </p>
          {route.parentHref && (
            <Link
              href={route.parentHref}
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-black text-ink transition hover:border-primary hover:text-primary"
            >
              <IconArrowRight className="size-4" aria-hidden="true" />
              بازگشت به فهرست
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
