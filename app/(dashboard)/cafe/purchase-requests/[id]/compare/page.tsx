import {
  IconAlertCircle,
  IconArrowRight,
  IconCalendar,
  IconClipboardCheck,
  IconHash,
  IconListDetails,
} from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PurchaseRequestComparisonWorkspace } from "@/app/(dashboard)/cafe/purchase-requests/[id]/compare/purchase-request-comparison-workspace";
import { PurchaseRequestStatusBadge } from "@/app/(dashboard)/cafe/purchase-requests/_components/purchase-request-status-badge";
import { getPurchaseRequestComparisonAction } from "@/app/actions/purchase-request-selections";
import { canCompareSuppliers } from "@/src/domain/cafe-access";
import { formatPersianDate, formatPersianNumber } from "@/src/lib/persian-format";
import { requireCafeMemberAccess } from "@/src/services/purchase-request-selection-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "مقایسه پیشنهادهای تأمین‌کنندگان | پنل کافه",
};

type Props = { params: Promise<{ id: string }> };

function safeLoadError(message?: string) {
  if (
    !message ||
    /mongo|mongoose|validation failed|cast to|stack|\bat\s+\w+/i.test(message)
  ) {
    return "خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.";
  }
  return message.slice(0, 300);
}

export default async function PurchaseRequestComparisonPage({ params }: Props) {
  const [{ id }, identity] = await Promise.all([
    params,
    requireCafeMemberAccess(),
  ]);
  const result = await getPurchaseRequestComparisonAction(id);

  if (!result.ok || !result.data) {
    const permission = result.error?.includes("دسترسی") ?? false;
    return (
      <div className="cafe-content-container space-y-6">
        <Link
          href={`/cafe/purchase-requests/${id}`}
          className="inline-flex min-h-10 items-center gap-2 rounded-control text-xs font-black text-ink-muted transition hover:text-primary"
        >
          <IconArrowRight className="size-4" aria-hidden="true" />
          بازگشت به جزئیات استعلام
        </Link>
        <section className="flex min-h-80 flex-col items-center justify-center rounded-card border border-danger/25 bg-surface p-8 text-center shadow-card">
          <span className="grid size-14 place-items-center rounded-full bg-danger-soft text-danger">
            <IconAlertCircle className="size-7" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-lg font-black text-ink">
            {permission ? "دسترسی به مقایسه امکان‌پذیر نیست" : "اطلاعات مقایسه دریافت نشد"}
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-7 text-ink-muted">
            {safeLoadError(result.error)}
          </p>
        </section>
      </div>
    );
  }

  const comparison = result.data;
  const selection = comparison.currentSelection;
  const editable =
    comparison.rfqStatus === "submitted" && canCompareSuppliers(identity);
  const selectedCount = selection?.totals.selectedItemCount ?? 0;

  return (
    <div className="cafe-content-container space-y-6 pb-24 xl:pb-0">
      <Link
        href={`/cafe/purchase-requests/${comparison.purchaseRequestId}`}
        className="inline-flex min-h-10 items-center gap-2 rounded-control text-xs font-black text-ink-muted transition hover:text-primary"
      >
        <IconArrowRight className="size-4" aria-hidden="true" />
        بازگشت به جزئیات استعلام
      </Link>

      <header className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <PurchaseRequestStatusBadge status={comparison.rfqStatus} />
              <span
                className="inline-flex items-center gap-1 text-xs font-black text-primary"
                dir="ltr"
              >
                <IconHash className="size-3.5" aria-hidden="true" />
                {comparison.referenceNumber}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-ink sm:text-3xl">
              مقایسه پیشنهادهای تأمین‌کنندگان
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-muted">
              پیشنهادهای هر کالا را جداگانه بررسی کنید و در صورت نیاز مقدار خرید را بین چند تأمین‌کننده تقسیم کنید.
            </p>
          </div>
          <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${selection ? "bg-success-soft text-success" : "bg-surface-subtle text-ink-muted"}`}>
            <IconClipboardCheck className="size-4" aria-hidden="true" />
            {selection
              ? `${formatPersianNumber(selectedCount)} قلم دارای انتخاب`
              : "هنوز انتخابی ذخیره نشده است"}
          </span>
        </div>

        <dl className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-3">
          <HeaderMeta
            icon={<IconCalendar className="size-4" aria-hidden="true" />}
            label="تاریخ موردنیاز"
            value={formatPersianDate(comparison.neededByDate)}
          />
          <HeaderMeta
            icon={<IconListDetails className="size-4" aria-hidden="true" />}
            label="تعداد اقلام"
            value={`${formatPersianNumber(comparison.totalRfqItems)} قلم`}
          />
          <HeaderMeta
            icon={<IconClipboardCheck className="size-4" aria-hidden="true" />}
            label="وضعیت انتخاب"
            value={
              selection
                ? `${formatPersianNumber(selection.totals.fullySelectedItemCount)} کامل، ${formatPersianNumber(selection.totals.partiallySelectedItemCount)} جزئی`
                : "بدون انتخاب ذخیره‌شده"
            }
          />
        </dl>
      </header>

      {comparison.rfqStatus === "cancelled" ? (
        <section className="flex items-start gap-3 rounded-card border border-line bg-surface p-4 text-ink-muted shadow-card">
          <IconAlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-black text-ink">این استعلام لغو شده است</h2>
            <p className="mt-1 text-xs leading-6">مقایسه و انتخاب‌های قبلی فقط برای مشاهده در دسترس‌اند و امکان تغییر آن‌ها وجود ندارد.</p>
          </div>
        </section>
      ) : comparison.rfqStatus === "draft" ? (
        <section className="flex items-start gap-3 rounded-card border border-warning/25 bg-warning-soft p-4 text-warning">
          <IconAlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-black">استعلام هنوز پیش‌نویس است</h2>
            <p className="mt-1 text-xs leading-6">پس از ثبت و ارسال استعلام، مقایسه و انتخاب پیشنهادها فعال می‌شود.</p>
          </div>
        </section>
      ) : !editable ? (
        <section className="flex items-start gap-3 rounded-card border border-line bg-surface p-4 text-ink-muted shadow-card">
          <IconAlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-black text-ink">نمایش فقط‌خواندنی</h2>
            <p className="mt-1 text-xs leading-6">شما می‌توانید پیشنهادها و انتخاب فعلی را ببینید، اما دسترسی تغییر انتخاب تأمین‌کنندگان را ندارید.</p>
          </div>
        </section>
      ) : null}

      <PurchaseRequestComparisonWorkspace
        key={comparison.currentSelection?.version ?? 0}
        comparison={comparison}
        editable={editable}
      />
    </div>
  );
}

function HeaderMeta({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-control bg-surface-subtle p-3">
      <dt className="flex items-center gap-1.5 text-[11px] font-bold text-ink-muted">
        <span className="text-primary">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 text-sm font-black text-ink">{value}</dd>
    </div>
  );
}
