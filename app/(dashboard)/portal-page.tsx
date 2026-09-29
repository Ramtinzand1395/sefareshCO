import { IconArrowLeft, IconCircleCheck } from "@tabler/icons-react";
import Link from "next/link";

import {
  dashboardPortals,
  getDashboardLinks,
  type DashboardPortal,
} from "@/app/(dashboard)/dashboard-config";

export function PortalPage({
  portal,
  title,
  description,
}: {
  portal: DashboardPortal;
  title: string;
  description: string;
}) {
  const config = dashboardPortals[portal];
  const quickLinks = getDashboardLinks(config.navigation)
    .filter((item) => item.href !== config.basePath)
    .slice(0, 4);

  return (
    <section className="mx-auto w-full max-w-7xl">
      <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black text-primary">{config.label}</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-muted sm:text-base">
              {description}
            </p>
          </div>
          <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-success-soft px-3 py-1.5 text-xs font-black text-success">
            <IconCircleCheck className="size-4" aria-hidden="true" />
            فضای کاری فعال
          </span>
        </div>

        <div className="mt-8 border-t border-line pt-7">
          <h2 className="text-base font-black text-ink">دسترسی سریع</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-xl border border-line bg-surface px-4 py-4 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-card"
              >
                <span className="flex items-center justify-between gap-3 text-sm font-black text-ink group-hover:text-primary">
                  {item.label}
                  <IconArrowLeft className="size-4" aria-hidden="true" />
                </span>
                <span className="mt-2 block line-clamp-2 text-xs leading-6 text-ink-muted">
                  {item.description}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
// test
// test