import { IconArrowRight } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminEmptyState, AdminInfoRow, AdminSectionCard } from "@/app/(dashboard)/admin/_components/admin-ui";
import { MembershipStatusBadge, UserStatusBadge } from "@/app/(dashboard)/admin/_components/status-badge";
import { UserStatusForm } from "@/app/(dashboard)/admin/users/user-status-form";
import { formatPersianDate } from "@/src/lib/persian-format";
import {
  getAdminUserDetail,
  InvalidUserIdError,
  UserNotFoundError,
} from "@/src/services/admin-user-service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const user = await getAdminUserDetail(id);
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    return { title: `${name} — کاربران — پنل مدیریت` };
  } catch (error) {
    if (error instanceof UserNotFoundError || error instanceof InvalidUserIdError) {
      return { title: "کاربر یافت نشد" };
    }
    throw error;
  }
}

const memberRoleLabels: Record<string, string> = {
  owner: "مالک",
  manager: "مدیر",
  purchase_manager: "مدیر خرید",
  chef: "سرآشپز",
  accountant: "حسابدار",
  employee: "کارمند",
  sales: "فروش",
  warehouse: "انبار",
};

type Membership = {
  id: string;
  name: string;
  role: string;
  status: string;
  href: string;
};

function MembershipSection({ title, items }: { title: string; items: Membership[] }) {
  return (
    <AdminSectionCard title={`${title} (${items.length.toLocaleString("fa-IR")})`}>
      {items.length === 0 ? (
        <AdminEmptyState compact title="عضویتی ثبت نشده است" />
      ) : (
        <div className="divide-y divide-line">
          {items.map((membership) => (
            <Link
              key={membership.id}
              href={membership.href}
              className="flex flex-col gap-3 px-5 py-4 transition hover:bg-surface-subtle sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-ink">{membership.name || "بدون نام"}</p>
                <p className="mt-1 text-xs text-ink-muted">{memberRoleLabels[membership.role] ?? membership.role}</p>
              </div>
              <MembershipStatusBadge status={membership.status} />
            </Link>
          ))}
        </div>
      )}
    </AdminSectionCard>
  );
}

export default async function AdminUserDetailPage({ params }: Props) {
  const { id } = await params;
  let user;
  try {
    user = await getAdminUserDetail(id);
  } catch (error) {
    if (error instanceof UserNotFoundError || error instanceof InvalidUserIdError) notFound();
    throw error;
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "کاربر بدون نام";

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5">
      <Link href="/admin/users" className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-ink-muted transition hover:text-primary">
        <IconArrowRight className="size-4" aria-hidden="true" />
        بازگشت به کاربران
      </Link>

      <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black text-primary">جزئیات کاربر</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">{fullName}</h1>
            <p className="mt-2 break-all text-sm text-ink-muted" dir="ltr">{user.email}</p>
          </div>
          <UserStatusBadge status={user.status} />
        </div>

        <dl className="mt-7 border-t border-line pt-3">
          <AdminInfoRow label="شناسه کاربر"><span className="font-mono text-xs" dir="ltr">{user.id}</span></AdminInfoRow>
          <AdminInfoRow label="نام و نام خانوادگی">{fullName}</AdminInfoRow>
          <AdminInfoRow label="ایمیل">
            <span className="inline-flex flex-wrap items-center gap-2"><span dir="ltr">{user.email}</span><span className={`text-xs font-bold ${user.emailVerified ? "text-success" : "text-ink-muted"}`}>{user.emailVerified ? "تأییدشده" : "تأییدنشده"}</span></span>
          </AdminInfoRow>
          <AdminInfoRow label="موبایل">
            {user.mobile ? <span className="inline-flex flex-wrap items-center gap-2"><span dir="ltr">{user.mobile}</span><span className={`text-xs font-bold ${user.mobileVerified ? "text-success" : "text-ink-muted"}`}>{user.mobileVerified ? "تأییدشده" : "تأییدنشده"}</span></span> : "—"}
          </AdminInfoRow>
          <AdminInfoRow label="نوع حساب">{user.isAdmin ? "مدیر سیستم" : "کاربر"}</AdminInfoRow>
          <AdminInfoRow label="آنبوردینگ">{user.onboardingCompleted ? "تکمیل‌شده" : "تکمیل‌نشده"}</AdminInfoRow>
          <AdminInfoRow label="تاریخ عضویت">{formatPersianDate(user.createdAt)}</AdminInfoRow>
          <AdminInfoRow label="آخرین ورود">{formatPersianDate(user.lastLoginAt)}</AdminInfoRow>
        </dl>
      </div>

      <UserStatusForm userId={user.id} currentStatus={user.status} />

      <div className="grid gap-5 lg:grid-cols-2">
        <MembershipSection
          title="عضویت در کافه‌ها"
          items={user.cafeMemberships.map((item) => ({ id: item.cafeId, name: item.cafeName, role: item.role, status: item.status, href: `/admin/cafes/${item.cafeId}` }))}
        />
        <MembershipSection
          title="عضویت در تأمین‌کنندگان"
          items={user.supplierMemberships.map((item) => ({ id: item.supplierId, name: item.supplierName, role: item.role, status: item.status, href: `/admin/suppliers/${item.supplierId}` }))}
        />
      </div>
    </section>
  );
}
