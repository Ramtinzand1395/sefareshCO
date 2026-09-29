import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getAdminSupplierDetail,
  InvalidSupplierIdError,
  SupplierNotFoundError,
} from "@/src/services/admin-supplier-service";
import {
  SupplierStatusForm,
  SupplierVerificationForm,
} from "@/app/(dashboard)/admin/suppliers/supplier-forms";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const supplier = await getAdminSupplierDetail(id);
    return {
      title: `${supplier.businessName} — تأمین‌کنندگان — پنل مدیریت`,
    };
  } catch (error) {
    if (
      error instanceof SupplierNotFoundError ||
      error instanceof InvalidSupplierIdError
    ) {
      return { title: "تأمین‌کننده یافت نشد" };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusLabels: Record<string, string> = {
  pending: "در انتظار",
  active: "فعال",
  suspended: "تعلیق‌شده",
  rejected: "رد‌شده",
};

const statusColors: Record<string, string> = {
  active: "bg-success-soft text-success",
  pending: "bg-warning-soft text-warning",
  suspended: "bg-danger-soft text-danger",
  rejected: "bg-surface-subtle text-ink-muted",
};

const memberRoleLabels: Record<string, string> = {
  owner: "مالک",
  manager: "مدیر",
  sales: "فروش",
  warehouse: "انبار",
  accountant: "حسابدار",
  employee: "کارمند",
};

const memberStatusLabels: Record<string, string> = {
  invited: "دعوت‌شده",
  active: "فعال",
  suspended: "تعلیق‌شده",
  removed: "حذف‌شده",
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

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
      <dt className="w-44 shrink-0 text-xs font-bold text-ink-muted">{label}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = statusColors[status] ?? "bg-surface-subtle text-ink-muted";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-black ${colors}`}
    >
      {statusLabels[status] ?? status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminSupplierDetailPage({ params }: Props) {
  const { id } = await params;

  let supplier;
  try {
    supplier = await getAdminSupplierDetail(id);
  } catch (error) {
    if (
      error instanceof SupplierNotFoundError ||
      error instanceof InvalidSupplierIdError
    ) {
      notFound();
    }
    throw error;
  }

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-ink-muted">
        <Link href="/admin/suppliers" className="transition hover:text-primary">
          تأمین‌کنندگان
        </Link>
        <span>/</span>
        <span className="text-ink">{supplier.businessName}</span>
      </nav>

      {/* Header card */}
      <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black text-primary">
              پنل مدیریت / تأمین‌کنندگان
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-ink">
              {supplier.businessName}
            </h1>
            {supplier.legalName && (
              <p className="mt-1 text-sm text-ink-muted">{supplier.legalName}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={supplier.status} />
            {supplier.isVerified ? (
              <span className="inline-flex items-center rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-black text-success">
                ✓ تأییدشده
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-black text-warning">
                تأییدنشده
              </span>
            )}
          </div>
        </div>

        {/* Business info */}
        <dl className="mt-8 space-y-3 border-t border-line pt-6">
          <InfoRow label="شناسه">
            <span className="break-all font-mono text-xs">{supplier.id}</span>
          </InfoRow>
          <InfoRow label="نام تجاری">{supplier.businessName}</InfoRow>
          {supplier.legalName && (
            <InfoRow label="نام حقوقی">{supplier.legalName}</InfoRow>
          )}
          {supplier.nationalId && (
            <InfoRow label="شناسه ملی / ثبت">
              <span dir="ltr">{supplier.nationalId}</span>
            </InfoRow>
          )}
          {supplier.economicCode && (
            <InfoRow label="کد اقتصادی">
              <span dir="ltr">{supplier.economicCode}</span>
            </InfoRow>
          )}
          <InfoRow label="موبایل">
            {supplier.mobile ? (
              <span dir="ltr">{supplier.mobile}</span>
            ) : (
              "—"
            )}
          </InfoRow>
          <InfoRow label="تلفن">
            {supplier.phone ? (
              <span dir="ltr">{supplier.phone}</span>
            ) : (
              "—"
            )}
          </InfoRow>
          <InfoRow label="استان / شهر">
            {supplier.city || supplier.province
              ? [supplier.province, supplier.city].filter(Boolean).join("، ")
              : "—"}
          </InfoRow>
          {supplier.address && (
            <InfoRow label="آدرس">{supplier.address}</InfoRow>
          )}
          {supplier.postalCode && (
            <InfoRow label="کد پستی">
              <span dir="ltr">{supplier.postalCode}</span>
            </InfoRow>
          )}
          <InfoRow label="حداقل سفارش">
            {supplier.minimumOrderAmount > 0
              ? `${supplier.minimumOrderAmount.toLocaleString("fa-IR")} تومان`
              : "—"}
          </InfoRow>
          {supplier.description && (
            <InfoRow label="توضیحات">{supplier.description}</InfoRow>
          )}
        </dl>

        {/* Status & audit */}
        <dl className="mt-6 space-y-3 border-t border-line pt-6">
          <InfoRow label="وضعیت">
            <StatusBadge status={supplier.status} />
          </InfoRow>
          <InfoRow label="وضعیت تأیید">
            {supplier.isVerified ? (
              <span className="text-xs font-black text-success">تأییدشده</span>
            ) : (
              <span className="text-xs text-warning">تأییدنشده</span>
            )}
          </InfoRow>
          {supplier.verifiedAt && (
            <InfoRow label="تاریخ تأیید">{formatDate(supplier.verifiedAt)}</InfoRow>
          )}
          {supplier.verifiedByAdminId && (
            <InfoRow label="تأییدکننده (Admin ID)">
              <span className="break-all font-mono text-xs">
                {supplier.verifiedByAdminId}
              </span>
            </InfoRow>
          )}
          <InfoRow label="تاریخ عضویت">{formatDate(supplier.createdAt)}</InfoRow>
          <InfoRow label="تعداد اعضا">
            {supplier.memberCount.toLocaleString("fa-IR")}
          </InfoRow>
        </dl>
      </div>

      {/* Controls */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SupplierStatusForm
          supplierId={supplier.id}
          currentStatus={supplier.status}
        />
        <SupplierVerificationForm
          supplierId={supplier.id}
          isVerified={supplier.isVerified}
        />
      </div>

      {/* Members */}
      {supplier.members.length > 0 && (
        <div className="rounded-xl border border-line bg-surface shadow-card">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-black text-ink">
              اعضا ({supplier.members.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-ink-muted">
                  <th className="px-4 py-2 text-start font-bold">نام</th>
                  <th className="px-4 py-2 text-start font-bold">ایمیل</th>
                  <th className="px-4 py-2 text-start font-bold">نقش</th>
                  <th className="px-4 py-2 text-start font-bold">وضعیت</th>
                  <th className="hidden px-4 py-2 text-start font-bold sm:table-cell">
                    تاریخ عضویت
                  </th>
                </tr>
              </thead>
              <tbody>
                {supplier.members.map((member) => (
                  <tr
                    key={member.memberId}
                    className="border-b border-line last:border-0"
                  >
                    <td className="px-4 py-2.5 font-bold text-ink">
                      {[member.firstName, member.lastName]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </td>
                    <td
                      className="px-4 py-2.5 text-xs text-ink-muted"
                      dir="ltr"
                    >
                      {member.email || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">
                      {memberRoleLabels[member.role] ?? member.role}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">
                      {memberStatusLabels[member.status] ?? member.status}
                    </td>
                    <td className="hidden px-4 py-2.5 text-xs text-ink-muted sm:table-cell">
                      {formatDate(member.joinedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Back */}
      <div className="pb-4">
        <Link
          href="/admin/suppliers"
          className="inline-flex items-center gap-2 text-sm font-bold text-ink-muted transition hover:text-primary"
        >
          ← بازگشت به لیست تأمین‌کنندگان
        </Link>
      </div>
    </section>
  );
}
