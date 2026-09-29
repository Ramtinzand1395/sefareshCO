import { IconArrowRight } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminMembersList } from "@/app/(dashboard)/admin/_components/admin-members-list";
import { AdminInfoRow } from "@/app/(dashboard)/admin/_components/admin-ui";
import { BusinessStatusBadge, VerificationBadge } from "@/app/(dashboard)/admin/_components/status-badge";
import { CafeStatusForm } from "@/app/(dashboard)/admin/cafes/cafe-status-form";
import { formatPersianDate, formatPersianNumber } from "@/src/lib/persian-format";
import {
  CafeNotFoundError,
  getAdminCafeDetail,
  InvalidCafeIdError,
} from "@/src/services/admin-cafe-service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const cafe = await getAdminCafeDetail(id);
    return { title: `${cafe.name} — کافه‌ها — پنل مدیریت` };
  } catch (error) {
    if (error instanceof CafeNotFoundError || error instanceof InvalidCafeIdError) return { title: "کافه یافت نشد" };
    throw error;
  }
}

const typeLabels: Record<string, string> = {
  cafe: "کافه",
  restaurant: "رستوران",
  fast_food: "فست‌فود",
  bakery: "نانوایی / قنادی",
  catering: "کترینگ",
  other: "سایر",
};

export default async function AdminCafeDetailPage({ params }: Props) {
  const { id } = await params;
  let cafe;
  try {
    cafe = await getAdminCafeDetail(id);
  } catch (error) {
    if (error instanceof CafeNotFoundError || error instanceof InvalidCafeIdError) notFound();
    throw error;
  }

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5">
      <Link href="/admin/cafes" className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-ink-muted transition hover:text-primary">
        <IconArrowRight className="size-4" aria-hidden="true" />
        بازگشت به کافه‌ها
      </Link>

      <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black text-primary">جزئیات کافه یا رستوران</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">{cafe.name || "کسب‌وکار بدون نام"}</h1>
            <p className="mt-2 text-sm text-ink-muted">{typeLabels[cafe.type] ?? cafe.type}</p>
          </div>
          <div className="flex flex-wrap gap-2"><BusinessStatusBadge status={cafe.status} /><VerificationBadge isVerified={cafe.isVerified} /></div>
        </div>

        <dl className="mt-7 border-t border-line pt-3">
          <AdminInfoRow label="شناسه"><span className="font-mono text-xs" dir="ltr">{cafe.id}</span></AdminInfoRow>
          <AdminInfoRow label="نام کسب‌وکار">{cafe.name || "—"}</AdminInfoRow>
          <AdminInfoRow label="نوع">{typeLabels[cafe.type] ?? cafe.type}</AdminInfoRow>
          <AdminInfoRow label="اسلاگ">{cafe.slug ? <span className="font-mono text-xs" dir="ltr">{cafe.slug}</span> : "—"}</AdminInfoRow>
          <AdminInfoRow label="موبایل">{cafe.mobile ? <span dir="ltr">{cafe.mobile}</span> : "—"}</AdminInfoRow>
          <AdminInfoRow label="تلفن">{cafe.phone ? <span dir="ltr">{cafe.phone}</span> : "—"}</AdminInfoRow>
          <AdminInfoRow label="استان / شهر">{[cafe.province, cafe.city].filter(Boolean).join("، ") || "—"}</AdminInfoRow>
          <AdminInfoRow label="آدرس">{cafe.address || "—"}</AdminInfoRow>
          <AdminInfoRow label="کد پستی">{cafe.postalCode ? <span dir="ltr">{cafe.postalCode}</span> : "—"}</AdminInfoRow>
          <AdminInfoRow label="تاریخ تأیید">{formatPersianDate(cafe.verifiedAt)}</AdminInfoRow>
          <AdminInfoRow label="تاریخ عضویت">{formatPersianDate(cafe.createdAt)}</AdminInfoRow>
          <AdminInfoRow label="آخرین به‌روزرسانی">{formatPersianDate(cafe.updatedAt)}</AdminInfoRow>
          <AdminInfoRow label="تعداد اعضا">{formatPersianNumber(cafe.memberCount)}</AdminInfoRow>
        </dl>
      </div>

      <CafeStatusForm cafeId={cafe.id} currentStatus={cafe.status} />
      <AdminMembersList members={cafe.members} />
    </section>
  );
}
