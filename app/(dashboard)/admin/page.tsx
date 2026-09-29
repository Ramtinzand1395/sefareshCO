import {
  IconBuildingStore,
  IconClock,
  IconTruckDelivery,
  IconUserCheck,
  IconUsers,
} from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/app/(dashboard)/admin/_components/admin-page-header";
import { requireAdminUser } from "@/src/lib/auth-helpers";
import {
  formatPersianDate,
  formatPersianNumber,
} from "@/src/lib/persian-format";
import { getAdminDashboard } from "@/src/services/admin-service";

export const metadata: Metadata = { title: "داشبورد مدیریت" };
export const dynamic = "force-dynamic";

const activityIcon = {
  user: IconUsers,
  cafe: IconBuildingStore,
  supplier: IconTruckDelivery,
};

export default async function AdminPage() {
  const actor = await requireAdminUser();
  const dashboard = await getAdminDashboard(actor.id);
  const { metrics } = dashboard;
  const cards = [
    {
      label: "کل کاربران",
      value: metrics.users.total,
      helper: `${formatPersianNumber(metrics.users.active)} کاربر فعال`,
      icon: IconUsers,
      className: "bg-primary-soft text-primary",
    },
    {
      label: "کافه‌ها و رستوران‌ها",
      value: metrics.cafes.total,
      helper: `${formatPersianNumber(metrics.cafes.active)} مجموعه فعال`,
      icon: IconBuildingStore,
      className: "bg-success-soft text-success",
    },
    {
      label: "تأمین‌کنندگان",
      value: metrics.suppliers.total,
      helper: `${formatPersianNumber(metrics.suppliers.verified)} تأییدشده`,
      icon: IconTruckDelivery,
      className: "bg-violet-soft text-violet",
    },
    {
      label: "عضویت ناقص",
      value: metrics.incompleteOnboarding,
      helper: `${formatPersianNumber(metrics.users.pending)} حساب در انتظار`,
      icon: IconUserCheck,
      className: "bg-warning-soft text-warning",
    },
  ];

  return (
    <section className="mx-auto w-full max-w-7xl">
      <AdminPageHeader
        title="داشبورد مدیریت"
        description="نمای زنده‌ای از کاربران و کسب‌وکارهایی که اکنون در سامانه ثبت شده‌اند."
        meta={`آخرین به‌روزرسانی: ${formatPersianDate(dashboard.generatedAt)}`}
      />

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const CardIcon = card.icon;
          return (
            <article
              key={card.label}
              className="rounded-card border border-line bg-surface p-5 shadow-card"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-ink-muted">{card.label}</p>
                  <p className="mt-2 text-3xl font-black text-ink">
                    {formatPersianNumber(card.value)}
                  </p>
                </div>
                <span className={`grid size-11 place-items-center rounded-xl ${card.className}`}>
                  <CardIcon className="size-6" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-4 text-xs font-bold text-ink-muted">{card.helper}</p>
            </article>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.7fr)]">
        <section className="rounded-card border border-line bg-surface shadow-card">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-black text-ink">آخرین فعالیت‌ها</h2>
              <p className="mt-1 text-xs text-ink-muted">ثبت کاربران و کسب‌وکارها</p>
            </div>
            <IconClock className="size-5 text-ink-muted" aria-hidden="true" />
          </div>

          {dashboard.recentActivity.length ? (
            <ul className="divide-y divide-line">
              {dashboard.recentActivity.map((activity) => {
                const ActivityIcon = activityIcon[activity.type];
                const content = (
                  <>
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-subtle text-primary">
                      <ActivityIcon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-ink">
                        {activity.title}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-ink-muted">
                        {activity.description}
                      </span>
                    </span>
                    <time className="shrink-0 text-[11px] font-bold text-ink-muted">
                      {formatPersianDate(activity.happenedAt)}
                    </time>
                  </>
                );

                return (
                  <li key={activity.id}>
                    {activity.href ? (
                      <Link
                        href={activity.href}
                        className="flex items-center gap-3 px-5 py-4 transition hover:bg-surface-subtle sm:px-6"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-5 py-4 sm:px-6">
                        {content}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-6 py-14 text-center">
              <p className="text-sm font-black text-ink">هنوز فعالیتی ثبت نشده است</p>
              <p className="mt-2 text-xs leading-6 text-ink-muted">
                با ثبت نخستین کاربر یا کسب‌وکار، فعالیت آن اینجا دیده می‌شود.
              </p>
            </div>
          )}
        </section>

        <aside className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
          <h2 className="font-black text-ink">خلاصه وضعیت کاربران</h2>
          <dl className="mt-5 space-y-4">
            <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
              <dt className="text-sm text-ink-muted">فعال</dt>
              <dd className="font-black text-success">
                {formatPersianNumber(metrics.users.active)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
              <dt className="text-sm text-ink-muted">در انتظار</dt>
              <dd className="font-black text-warning">
                {formatPersianNumber(metrics.users.pending)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-ink-muted">تکمیل‌نکرده عضویت</dt>
              <dd className="font-black text-ink">
                {formatPersianNumber(metrics.incompleteOnboarding)}
              </dd>
            </div>
          </dl>
          <Link
            href="/admin/users"
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-black text-white transition hover:bg-primary-hover"
          >
            مشاهده کاربران
          </Link>
        </aside>
      </div>
    </section>
  );
}
