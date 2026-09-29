import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  CafeNotFoundError,
  getAdminCafeDetail,
  InvalidCafeIdError,
} from "@/src/services/admin-cafe-service";
import { CafeStatusForm } from "@/app/(dashboard)/admin/cafes/cafe-status-form";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const cafe = await getAdminCafeDetail(id);
    return { title: `${cafe.name} — کافه‌ها — پنل مدیریت` };
  } catch (error) {
    if (error instanceof CafeNotFoundError || error instanceof InvalidCafeIdError) {
      return { title: "کافه یافت نشد" };
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

const typeLabels: Record<string, string> = {
  cafe: "کافه",
  restaurant: "رستوران",
  fast_food: "فست‌فود",
  bakery: "نانوایی / قنادی",
  catering: "کترینگ",
  other: "سایر",
};

const memberRoleLabels: Record<string, string> = {
  owner: "مالک",
  manager: "مدیر",
  purchase_manager: "مدیر خرید",
  chef: "سرآشپز",
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

export default async function AdminCafeDetailPage({ params }: Props) {
  const { id } = await params;

  let cafe;
  try {
    cafe = await getAdminCafeDetail(id);
  } catch (error) {
    if (error instanceof CafeNotFoundError || error instanceof InvalidCafeIdError) {
      notFound();
    }
    throw error;
  }

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-ink-muted">
        <Link href="/admin/cafes" className="transition hover:text-primary">
          کافه‌ها
        </Link>
        <span>/</span>
        <span className="text-ink">{cafe.name}</span>
      </nav>

      {/* Header card */}
      <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black text-primary">
              پنل مدیریت / کافه‌ها
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-ink">
              {cafe.name}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {typeLabels[cafe.type] ?? cafe.type}
            </p>
          </div>
          <StatusBadge status={cafe.status} />
        </div>

        {/* Business info */}
        <dl className="mt-8 space-y-3 border-t border-line pt-6">
          <InfoRow label="شناسه">
            <span className="break-all font-mono text-xs">{cafe.id}</span>
          </InfoRow>
          <InfoRow label="نام">{cafe.name}</InfoRow>
          <InfoRow label="نوع">
            {typeLabels[cafe.type] ?? cafe.type}
          </InfoRow>
          {cafe.slug && (
            <InfoRow label="اسلاگ">
              <span dir="ltr" className="text-xs font-mono">
                {cafe.slug}
              </span>
            </InfoRow>
          )}
          <InfoRow label="موبایل">
            {cafe.mobile ? <span dir="ltr">{cafe.mobile}</span> : "—"}
          </InfoRow>
          <InfoRow label="تلفن">
            {cafe.phone ? <span dir="ltr">{cafe.phone}</span> : "—"}
          </InfoRow>
          <InfoRow label="استان / شهر">
            {cafe.city || cafe.province
              ? [cafe.province, cafe.city].filter(Boolean).join("، ")
              : "—"}
          </InfoRow>
          {cafe.address && (
            <InfoRow label="آدرس">{cafe.address}</InfoRow>
          )}
          {cafe.postalCode && (
            <InfoRow label="کد پستی">
              <span dir="ltr">{cafe.postalCode}</span>
            </InfoRow>
          )}
        </dl>

        {/* Status & dates */}
        <dl className="mt-6 space-y-3 border-t border-line pt-6">
          <InfoRow label="وضعیت">
            <StatusBadge status={cafe.status} />
          </InfoRow>
          <InfoRow label="تأیید">
            {cafe.isVerified ? (
              <span className="text-xs font-black text-success">تأییدشده</span>
            ) : (
              <span className="text-xs text-warning">تأییدنشده</span>
            )}
          </InfoRow>
          {cafe.verifiedAt && (
            <InfoRow label="تاریخ تأیید">
              {formatDate(cafe.verifiedAt)}
            </InfoRow>
          )}
          <InfoRow label="تاریخ عضویت">{formatDate(cafe.createdAt)}</InfoRow>
          <InfoRow label="آخرین بروزرسانی">{formatDate(cafe.updatedAt)}</InfoRow>
          <InfoRow label="تعداد اعضا">
            {cafe.memberCount.toLocaleString("fa-IR")}
          </InfoRow>
        </dl>
      </div>

      {/* Status change form */}
      <CafeStatusForm cafeId={cafe.id} currentStatus={cafe.status} />

      {/* Members table */}
      {cafe.members.length > 0 && (
        <div className="rounded-xl border border-line bg-surface shadow-card">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-black text-ink">
              اعضا ({cafe.members.length})
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
                {cafe.members.map((member) => (
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
          href="/admin/cafes"
          className="inline-flex items-center gap-2 text-sm font-bold text-ink-muted transition hover:text-primary"
        >
          ← بازگشت به لیست کافه‌ها
        </Link>
      </div>
    </section>
  );
}
