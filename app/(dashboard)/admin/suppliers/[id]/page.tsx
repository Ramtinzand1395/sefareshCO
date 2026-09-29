import { IconArrowRight } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminMembersList } from "@/app/(dashboard)/admin/_components/admin-members-list";
import { AdminInfoRow } from "@/app/(dashboard)/admin/_components/admin-ui";
import { BusinessStatusBadge, VerificationBadge } from "@/app/(dashboard)/admin/_components/status-badge";
import { SupplierStatusForm, SupplierVerificationForm } from "@/app/(dashboard)/admin/suppliers/supplier-forms";
import { formatPersianDate, formatPersianNumber, formatToman } from "@/src/lib/persian-format";
import {
  getAdminSupplierDetail,
  InvalidSupplierIdError,
  SupplierNotFoundError,
} from "@/src/services/admin-supplier-service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const supplier = await getAdminSupplierDetail(id);
    return { title: `${supplier.businessName} — تأمین‌کنندگان — پنل مدیریت` };
  } catch (error) {
    if (error instanceof SupplierNotFoundError || error instanceof InvalidSupplierIdError) return { title: "تأمین‌کننده یافت نشد" };
    throw error;
  }
}

export default async function AdminSupplierDetailPage({ params }: Props) {
  const { id } = await params;
  let supplier;
  try {
    supplier = await getAdminSupplierDetail(id);
  } catch (error) {
    if (error instanceof SupplierNotFoundError || error instanceof InvalidSupplierIdError) notFound();
    throw error;
  }

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5">
      <Link href="/admin/suppliers" className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-ink-muted transition hover:text-primary">
        <IconArrowRight className="size-4" aria-hidden="true" />
        بازگشت به تأمین‌کنندگان
      </Link>

      <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black text-primary">جزئیات تأمین‌کننده</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">{supplier.businessName || "تأمین‌کننده بدون نام"}</h1>
            {supplier.legalName ? <p className="mt-2 text-sm text-ink-muted">{supplier.legalName}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2"><BusinessStatusBadge status={supplier.status} /><VerificationBadge isVerified={supplier.isVerified} /></div>
        </div>

        <dl className="mt-7 border-t border-line pt-3">
          <AdminInfoRow label="شناسه"><span className="font-mono text-xs" dir="ltr">{supplier.id}</span></AdminInfoRow>
          <AdminInfoRow label="نام تجاری">{supplier.businessName || "—"}</AdminInfoRow>
          <AdminInfoRow label="نام حقوقی">{supplier.legalName || "—"}</AdminInfoRow>
          <AdminInfoRow label="شناسه ملی / ثبت">{supplier.nationalId ? <span dir="ltr">{supplier.nationalId}</span> : "—"}</AdminInfoRow>
          <AdminInfoRow label="کد اقتصادی">{supplier.economicCode ? <span dir="ltr">{supplier.economicCode}</span> : "—"}</AdminInfoRow>
          <AdminInfoRow label="موبایل">{supplier.mobile ? <span dir="ltr">{supplier.mobile}</span> : "—"}</AdminInfoRow>
          <AdminInfoRow label="تلفن">{supplier.phone ? <span dir="ltr">{supplier.phone}</span> : "—"}</AdminInfoRow>
          <AdminInfoRow label="استان / شهر">{[supplier.province, supplier.city].filter(Boolean).join("، ") || "—"}</AdminInfoRow>
          <AdminInfoRow label="آدرس">{supplier.address || "—"}</AdminInfoRow>
          <AdminInfoRow label="کد پستی">{supplier.postalCode ? <span dir="ltr">{supplier.postalCode}</span> : "—"}</AdminInfoRow>
          <AdminInfoRow label="حداقل سفارش">{supplier.minimumOrderAmount > 0 ? formatToman(supplier.minimumOrderAmount) : "—"}</AdminInfoRow>
          <AdminInfoRow label="توضیحات">{supplier.description || "—"}</AdminInfoRow>
          <AdminInfoRow label="تاریخ تأیید">{formatPersianDate(supplier.verifiedAt)}</AdminInfoRow>
          <AdminInfoRow label="تأییدکننده">{supplier.verifiedByAdminId ? <span className="font-mono text-xs" dir="ltr">{supplier.verifiedByAdminId}</span> : "—"}</AdminInfoRow>
          <AdminInfoRow label="تاریخ عضویت">{formatPersianDate(supplier.createdAt)}</AdminInfoRow>
          <AdminInfoRow label="تعداد اعضا">{formatPersianNumber(supplier.memberCount)}</AdminInfoRow>
        </dl>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SupplierStatusForm supplierId={supplier.id} currentStatus={supplier.status} />
        <SupplierVerificationForm supplierId={supplier.id} isVerified={supplier.isVerified} />
      </div>
      <AdminMembersList members={supplier.members} />
    </section>
  );
}
