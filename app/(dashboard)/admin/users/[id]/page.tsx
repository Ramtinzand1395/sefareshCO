import {
  IconArrowRight,
  IconBuildingStore,
  IconCircleCheck,
  IconCircleX,
  IconMail,
  IconPhone,
  IconShieldCheck,
  IconTruckDelivery,
  IconUser,
} from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/app/(dashboard)/admin/_components/admin-page-header";
import {
  businessStatusLabel,
  MembershipStatusBadge,
  UserStatusBadge,
} from "@/app/(dashboard)/admin/_components/status-badge";
import type { AdminMembershipDto } from "@/src/domain/admin";
import { requireAdminUser } from "@/src/lib/auth-helpers";
import { formatPersianDate } from "@/src/lib/persian-format";
import { getAdminUserDetail } from "@/src/services/admin-service";

export const metadata: Metadata = { title: "جزئیات کاربر" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const roleLabels: Record<string, string> = {
  owner: "مالک",
  manager: "مدیر",
  purchase_manager: "مدیر خرید",
  chef: "آشپز",
  accountant: "حسابدار",
  employee: "کارمند",
  sales: "فروش",
  warehouse: "انبار",
};

function VerificationRow({ label, verified }: { label: string; verified: boolean }) {
  const Icon = verified ? IconCircleCheck : IconCircleX;
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className={`inline-flex items-center gap-1.5 text-xs font-black ${verified ? "text-success" : "text-warning"}`}>
        <Icon className="size-4" aria-hidden="true" />
        {verified ? "تأیید شده" : "تأیید نشده"}
      </span>
    </div>
  );
}

function MembershipList({
  title,
  emptyText,
  memberships,
  type,
}: {
  title: string;
  emptyText: string;
  memberships: AdminMembershipDto[];
  type: "cafe" | "supplier";
}) {
  const Icon = type === "cafe" ? IconBuildingStore : IconTruckDelivery;
  return (
    <section className="rounded-card border border-line bg-surface shadow-card">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4 sm:px-6">
        <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-black text-ink">{title}</h2>
          <p className="mt-1 text-xs text-ink-muted">{memberships.length} ارتباط ثبت‌شده</p>
        </div>
      </div>
      {memberships.length ? (
        <ul className="divide-y divide-line">
          {memberships.map((membership) => (
            <li key={membership.id} className="p-5 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-black text-ink">{membership.businessName}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {roleLabels[membership.role] ?? membership.role} · {businessStatusLabel(membership.businessStatus)}
                  </p>
                </div>
                <MembershipStatusBadge status={membership.status} />
              </div>
              <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-ink-muted">زمان پیوستن</dt>
                  <dd className="mt-1 font-bold text-ink">{formatPersianDate(membership.joinedAt)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">شناسه کسب‌وکار</dt>
                  <dd className="mt-1 break-all font-bold text-ink" dir="ltr">{membership.businessId}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-6 py-10 text-center text-sm leading-7 text-ink-muted">{emptyText}</p>
      )}
    </section>
  );
}

export default async function AdminUserDetailPage({ params }: Props) {
  const [{ id }, actor] = await Promise.all([params, requireAdminUser()]);
  const user = await getAdminUserDetail(actor.id, id);
  if (!user) notFound();

  return (
    <section className="mx-auto w-full max-w-7xl">
      <Link
        href="/admin/users"
        className="mb-5 inline-flex items-center gap-2 text-sm font-black text-ink-muted transition hover:text-primary"
      >
        <IconArrowRight className="size-4" aria-hidden="true" />
        بازگشت به کاربران
      </Link>

      <AdminPageHeader
        title={user.displayName}
        description="اطلاعات حساب و ارتباط‌های ثبت‌شده این کاربر با کسب‌وکارهای سامانه."
        actions={<UserStatusBadge status={user.status} />}
      />

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.7fr)]">
        <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
          <div className="flex items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-xl font-black text-primary">
              {user.displayName.charAt(0) || "ک"}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-black text-ink">{user.displayName}</h2>
                {user.isAdmin ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-soft px-2.5 py-1 text-[11px] font-black text-violet">
                    <IconShieldCheck className="size-3.5" aria-hidden="true" />
                    مدیر سیستم
                  </span>
                ) : null}
              </div>
              <p className="mt-1 break-all text-xs text-ink-muted" dir="ltr">{user.id}</p>
            </div>
          </div>

          <dl className="mt-6 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
            <div className="rounded-xl bg-surface-subtle p-4">
              <dt className="flex items-center gap-2 text-xs font-bold text-ink-muted">
                <IconUser className="size-4" aria-hidden="true" /> نام و نام خانوادگی
              </dt>
              <dd className="mt-2 text-sm font-black text-ink">{user.displayName}</dd>
            </div>
            <div className="rounded-xl bg-surface-subtle p-4">
              <dt className="flex items-center gap-2 text-xs font-bold text-ink-muted">
                <IconMail className="size-4" aria-hidden="true" /> ایمیل
              </dt>
              <dd className="mt-2 break-all text-sm font-black text-ink" dir="ltr">{user.email || "ثبت نشده"}</dd>
            </div>
            <div className="rounded-xl bg-surface-subtle p-4">
              <dt className="flex items-center gap-2 text-xs font-bold text-ink-muted">
                <IconPhone className="size-4" aria-hidden="true" /> موبایل
              </dt>
              <dd className="mt-2 text-sm font-black text-ink" dir="ltr">{user.mobile || "ثبت نشده"}</dd>
            </div>
            <div className="rounded-xl bg-surface-subtle p-4">
              <dt className="text-xs font-bold text-ink-muted">تکمیل عضویت</dt>
              <dd className={`mt-2 text-sm font-black ${user.onboardingCompleted ? "text-success" : "text-warning"}`}>
                {user.onboardingCompleted ? "تکمیل شده" : "تکمیل نشده"}
              </dd>
            </div>
          </dl>
        </section>

        <aside className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
          <h2 className="font-black text-ink">وضعیت حساب</h2>
          <div className="mt-3 divide-y divide-line">
            <VerificationRow label="ایمیل" verified={user.emailVerified} />
            <VerificationRow label="شماره موبایل" verified={user.mobileVerified} />
          </div>
          <dl className="mt-4 space-y-4 border-t border-line pt-5 text-sm">
            <div>
              <dt className="text-xs text-ink-muted">تاریخ ایجاد حساب</dt>
              <dd className="mt-1 font-bold text-ink">{formatPersianDate(user.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">آخرین ورود</dt>
              <dd className="mt-1 font-bold text-ink">{formatPersianDate(user.lastLoginAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">آخرین ویرایش</dt>
              <dd className="mt-1 font-bold text-ink">{formatPersianDate(user.updatedAt)}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <MembershipList
          title="ارتباط با کافه و رستوران"
          emptyText="این کاربر هیچ عضویت ثبت‌شده‌ای در کافه یا رستوران ندارد."
          memberships={user.cafeMemberships}
          type="cafe"
        />
        <MembershipList
          title="ارتباط با تأمین‌کننده"
          emptyText="این کاربر هیچ عضویت ثبت‌شده‌ای نزد تأمین‌کنندگان ندارد."
          memberships={user.supplierMemberships}
          type="supplier"
        />
      </div>
    </section>
  );
}
