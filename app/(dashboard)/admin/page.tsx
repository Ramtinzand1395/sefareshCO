import {
  IconArrowLeft,
  IconBuildingStore,
  IconCircleCheck,
  IconClockHour4,
  IconShieldExclamation,
  IconTruckDelivery,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AdminPageHeader } from "@/app/(dashboard)/admin/_components/admin-page-header";
import { AdminEmptyState } from "@/app/(dashboard)/admin/_components/admin-ui";
import {
  BusinessStatusBadge,
  UserStatusBadge,
  VerificationBadge,
} from "@/app/(dashboard)/admin/_components/status-badge";
import {
  formatPersianDateTime,
  formatPersianNumber,
} from "@/src/lib/persian-format";
import { getAdminDashboardOverview } from "@/src/services/admin-dashboard-service";

export const metadata: Metadata = { title: "داشبورد مدیریت" };

function TotalCard({
  title,
  value,
  href,
  icon: CardIcon,
  description,
}: {
  title: string;
  value: number;
  href: string;
  icon: Icon;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-card border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-float"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-ink-muted">{title}</p>
          <p className="mt-3 text-3xl font-black tabular-nums text-ink">
            {formatPersianNumber(value)}
          </p>
        </div>
        <span className="grid size-11 place-items-center rounded-2xl bg-primary-soft text-primary transition group-hover:bg-primary group-hover:text-white">
          <CardIcon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <span className="mt-4 flex items-center justify-between gap-3 text-xs font-bold text-ink-muted">
        {description}
        <IconArrowLeft
          className="size-4 shrink-0 text-primary transition group-hover:-translate-x-1"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

function SignalCard({
  title,
  value,
  tone,
  icon: SignalIcon,
  children,
}: {
  title: string;
  value: number;
  tone: "warning" | "danger" | "success";
  icon: Icon;
  children: ReactNode;
}) {
  const toneClasses = {
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    success: "bg-success-soft text-success",
  }[tone];

  return (
    <article className="rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span className={`grid size-10 place-items-center rounded-xl ${toneClasses}`}>
          <SignalIcon className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-bold text-ink-muted">{title}</p>
          <p className="mt-0.5 text-xl font-black tabular-nums text-ink">
            {formatPersianNumber(value)}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-3 text-xs font-bold text-ink-muted">
        {children}
      </div>
    </article>
  );
}

function RecentSection({
  title,
  listHref,
  emptyTitle,
  children,
}: {
  title: string;
  listHref: string;
  emptyTitle: string;
  children: ReactNode[];
}) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
        <h2 className="text-base font-black text-ink">{title}</h2>
        <Link
          href={listHref}
          className="inline-flex min-h-10 items-center gap-1.5 text-xs font-black text-primary transition hover:text-primary-hover"
        >
          مشاهده همه
          <IconArrowLeft className="size-4" aria-hidden="true" />
        </Link>
      </div>
      {children.length === 0 ? (
        <AdminEmptyState compact title={emptyTitle} />
      ) : (
        <div className="divide-y divide-line">{children}</div>
      )}
    </section>
  );
}

const signalLinkClassName = "transition hover:text-primary";

export default async function AdminPage() {
  const overview = await getAdminDashboardOverview();
  const pendingTotal =
    overview.users.pending + overview.cafes.pending + overview.suppliers.pending;
  const suspendedTotal =
    overview.users.suspended +
    overview.cafes.suspended +
    overview.suppliers.suspended;
  const activeTotal =
    overview.users.active + overview.cafes.active + overview.suppliers.active;

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6">
      <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
        <AdminPageHeader
          title="داشبورد مدیریت"
          description="نمای به‌روز کاربران و کسب‌وکارهای Marketplace؛ موارد نیازمند بررسی را از همین صفحه پیگیری کنید."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <TotalCard
          title="مجموع کاربران"
          value={overview.users.total}
          href="/admin/users"
          icon={IconUsers}
          description="مدیریت حساب‌ها و وضعیت دسترسی"
        />
        <TotalCard
          title="مجموع کافه‌ها"
          value={overview.cafes.total}
          href="/admin/cafes"
          icon={IconBuildingStore}
          description="بررسی کافه‌ها و رستوران‌ها"
        />
        <TotalCard
          title="مجموع تأمین‌کنندگان"
          value={overview.suppliers.total}
          href="/admin/suppliers"
          icon={IconTruckDelivery}
          description="مدیریت فعالیت و تأیید تأمین‌کنندگان"
        />
      </div>

      <div>
        <div className="mb-3">
          <h2 className="text-base font-black text-ink">وضعیت‌های مهم</h2>
          <p className="mt-1 text-xs leading-6 text-ink-muted">
            خلاصهٔ مواردی که برای پایش یا اقدام مدیریتی اهمیت بیشتری دارند.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SignalCard
            title="در انتظار بررسی"
            value={pendingTotal}
            tone="warning"
            icon={IconClockHour4}
          >
            <Link href="/admin/users?status=pending" className={signalLinkClassName}>
              کاربر: {formatPersianNumber(overview.users.pending)}
            </Link>
            <Link href="/admin/cafes?status=pending" className={signalLinkClassName}>
              کافه: {formatPersianNumber(overview.cafes.pending)}
            </Link>
            <Link href="/admin/suppliers?status=pending" className={signalLinkClassName}>
              تأمین‌کننده: {formatPersianNumber(overview.suppliers.pending)}
            </Link>
          </SignalCard>

          <SignalCard
            title="تعلیق‌شده"
            value={suspendedTotal}
            tone="danger"
            icon={IconShieldExclamation}
          >
            <Link href="/admin/users?status=suspended" className={signalLinkClassName}>
              کاربر: {formatPersianNumber(overview.users.suspended)}
            </Link>
            <Link href="/admin/cafes?status=suspended" className={signalLinkClassName}>
              کافه: {formatPersianNumber(overview.cafes.suspended)}
            </Link>
            <Link href="/admin/suppliers?status=suspended" className={signalLinkClassName}>
              تأمین‌کننده: {formatPersianNumber(overview.suppliers.suspended)}
            </Link>
          </SignalCard>

          <SignalCard
            title="تأمین‌کنندهٔ تأییدنشده"
            value={overview.suppliers.unverified}
            tone="warning"
            icon={IconShieldExclamation}
          >
            <Link href="/admin/suppliers?verified=false" className={signalLinkClassName}>
              مشاهده و بررسی تأمین‌کنندگان
            </Link>
          </SignalCard>

          <SignalCard
            title="فعال"
            value={activeTotal}
            tone="success"
            icon={IconCircleCheck}
          >
            <span>کاربر: {formatPersianNumber(overview.users.active)}</span>
            <span>کافه: {formatPersianNumber(overview.cafes.active)}</span>
            <span>تأمین‌کننده: {formatPersianNumber(overview.suppliers.active)}</span>
          </SignalCard>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <RecentSection
          title="کاربران اخیر"
          listHref="/admin/users"
          emptyTitle="هنوز کاربری ثبت نشده است"
        >
          {overview.latestUsers.map((user) => {
            const name =
              [user.firstName, user.lastName].filter(Boolean).join(" ") ||
              "کاربر بدون نام";
            return (
              <Link
                key={user.id}
                href={`/admin/users/${user.id}`}
                className="group block px-5 py-4 transition hover:bg-surface-subtle"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-ink group-hover:text-primary">
                      {name}
                    </p>
                    <p className="mt-1 truncate text-xs text-ink-muted" dir="ltr">
                      {user.email || "—"}
                    </p>
                  </div>
                  <UserStatusBadge status={user.status} />
                </div>
                <p className="mt-2 text-[11px] text-ink-muted">
                  {formatPersianDateTime(user.createdAt)}
                </p>
              </Link>
            );
          })}
        </RecentSection>

        <RecentSection
          title="کافه‌های اخیر"
          listHref="/admin/cafes"
          emptyTitle="هنوز کافه‌ای ثبت نشده است"
        >
          {overview.latestCafes.map((cafe) => (
            <Link
              key={cafe.id}
              href={`/admin/cafes/${cafe.id}`}
              className="group block px-5 py-4 transition hover:bg-surface-subtle"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-ink group-hover:text-primary">
                    {cafe.name || "کافه بدون نام"}
                  </p>
                  <p className="mt-1 truncate text-xs text-ink-muted">
                    {cafe.city || "شهر ثبت نشده"}
                  </p>
                </div>
                <BusinessStatusBadge status={cafe.status} />
              </div>
              <p className="mt-2 text-[11px] text-ink-muted">
                {formatPersianDateTime(cafe.createdAt)}
              </p>
            </Link>
          ))}
        </RecentSection>

        <RecentSection
          title="تأمین‌کنندگان اخیر"
          listHref="/admin/suppliers"
          emptyTitle="هنوز تأمین‌کننده‌ای ثبت نشده است"
        >
          {overview.latestSuppliers.map((supplier) => (
            <Link
              key={supplier.id}
              href={`/admin/suppliers/${supplier.id}`}
              className="group block px-5 py-4 transition hover:bg-surface-subtle"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-ink group-hover:text-primary">
                    {supplier.businessName || "تأمین‌کننده بدون نام"}
                  </p>
                  <p className="mt-1 truncate text-xs text-ink-muted">
                    {supplier.city || "شهر ثبت نشده"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <BusinessStatusBadge status={supplier.status} />
                  <VerificationBadge isVerified={supplier.isVerified} />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-ink-muted">
                {formatPersianDateTime(supplier.createdAt)}
              </p>
            </Link>
          ))}
        </RecentSection>
      </div>
    </section>
  );
}
