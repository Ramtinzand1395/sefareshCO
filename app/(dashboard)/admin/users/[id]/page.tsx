import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { UserStatusForm } from "@/app/(dashboard)/admin/users/user-status-form";
import { getAdminUserDetail } from "@/src/services/admin-user-service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const user = await getAdminUserDetail(id);
    const name =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    return { title: `${name} — کاربران — پنل مدیریت` };
  } catch {
    return { title: "کاربر یافت نشد" };
  }
}

const statusLabels: Record<string, string> = {
  active: "فعال",
  pending: "در انتظار",
  suspended: "تعلیق‌شده",
  disabled: "غیرفعال",
};

const statusColors: Record<string, string> = {
  active: "bg-success-soft text-success",
  pending: "bg-warning-soft text-warning",
  suspended: "bg-danger-soft text-danger",
  disabled: "bg-surface-subtle text-ink-muted",
};

const memberStatusLabels: Record<string, string> = {
  invited: "دعوت‌شده",
  active: "فعال",
  suspended: "تعلیق‌شده",
  removed: "حذف‌شده",
};

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

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-xs font-bold text-ink-muted">{label}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = statusColors[status] ?? "bg-surface-subtle text-ink-muted";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-black ${colors}`}>
      {statusLabels[status] ?? status}
    </span>
  );
}

export default async function AdminUserDetailPage({ params }: Props) {
  const { id } = await params;

  let user;
  try {
    user = await getAdminUserDetail(id);
  } catch {
    notFound();
  }

  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || "—";

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6">
      <nav className="flex items-center gap-2 text-xs text-ink-muted">
        <Link href="/admin/users" className="transition hover:text-primary">
          کاربران
        </Link>
        <span>/</span>
        <span className="text-ink">{fullName}</span>
      </nav>

      <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black text-primary">پنل مدیریت / کاربران</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-ink">
              {fullName}
            </h1>
            <p className="mt-1 text-sm text-ink-muted" dir="ltr">
              {user.email}
            </p>
          </div>
          <StatusBadge status={user.status} />
        </div>

        <dl className="mt-8 space-y-3 border-t border-line pt-6">
          <InfoRow label="شناسه کاربر">
            <span className="break-all font-mono text-xs">{user.id}</span>
          </InfoRow>
          <InfoRow label="نام">{user.firstName ?? "—"}</InfoRow>
          <InfoRow label="نام خانوادگی">{user.lastName ?? "—"}</InfoRow>
          <InfoRow label="ایمیل">
            <span dir="ltr">{user.email}</span>
            {user.emailVerified && (
              <span className="mr-2 text-xs font-bold text-success">✓ تأییدشده</span>
            )}
          </InfoRow>
          <InfoRow label="موبایل">
            {user.mobile ? (
              <>
                <span dir="ltr">{user.mobile}</span>
                {user.mobileVerified && (
                  <span className="mr-2 text-xs font-bold text-success">✓ تأییدشده</span>
                )}
              </>
            ) : (
              "—"
            )}
          </InfoRow>
          <InfoRow label="وضعیت">
            <StatusBadge status={user.status} />
          </InfoRow>
          <InfoRow label="ادمین">
            {user.isAdmin ? (
              <span className="text-xs font-black text-primary">بله</span>
            ) : (
              <span className="text-xs text-ink-muted">خیر</span>
            )}
          </InfoRow>
          <InfoRow label="اتمام آنبوردینگ">
            {user.onboardingCompleted ? (
              <span className="text-xs font-bold text-success">کامل‌شده</span>
            ) : (
              <span className="text-xs text-warning">ناتمام</span>
            )}
          </InfoRow>
          <InfoRow label="تاریخ عضویت">{formatDate(user.createdAt)}</InfoRow>
          <InfoRow label="آخرین ورود">{formatDate(user.lastLoginAt)}</InfoRow>
        </dl>
      </div>

      <UserStatusForm userId={user.id} currentStatus={user.status} />

      {user.cafeMemberships.length > 0 && (
        <div className="rounded-xl border border-line bg-surface shadow-card">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-black text-ink">
              عضویت در کافه‌ها ({user.cafeMemberships.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-ink-muted">
                  <th className="px-4 py-2 text-start font-bold">نام کافه</th>
                  <th className="px-4 py-2 text-start font-bold">نقش</th>
                  <th className="px-4 py-2 text-start font-bold">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {user.cafeMemberships.map((membership) => (
                  <tr
                    key={membership.cafeId}
                    className="border-b border-line last:border-0"
                  >
                    <td className="px-4 py-2.5 font-bold text-ink">
                      {membership.cafeName || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">
                      {memberRoleLabels[membership.role] ?? membership.role}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">
                      {memberStatusLabels[membership.status] ?? membership.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {user.supplierMemberships.length > 0 && (
        <div className="rounded-xl border border-line bg-surface shadow-card">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-black text-ink">
              عضویت در تأمین‌کنندگان ({user.supplierMemberships.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-ink-muted">
                  <th className="px-4 py-2 text-start font-bold">نام تأمین‌کننده</th>
                  <th className="px-4 py-2 text-start font-bold">نقش</th>
                  <th className="px-4 py-2 text-start font-bold">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {user.supplierMemberships.map((membership) => (
                  <tr
                    key={membership.supplierId}
                    className="border-b border-line last:border-0"
                  >
                    <td className="px-4 py-2.5 font-bold text-ink">
                      {membership.supplierName || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">
                      {memberRoleLabels[membership.role] ?? membership.role}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">
                      {memberStatusLabels[membership.status] ?? membership.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="pb-4">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-2 text-sm font-bold text-ink-muted transition hover:text-primary"
        >
          ← بازگشت به لیست کاربران
        </Link>
      </div>
    </section>
  );
}
