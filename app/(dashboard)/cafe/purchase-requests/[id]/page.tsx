import {
  IconArrowRight,
  IconArrowsDiff,
  IconCalendar,
  IconClipboardList,
  IconFileDescription,
  IconHash,
  IconPackage,
  IconScale,
  IconSend,
  IconUser,
} from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PurchaseRequestActions } from "@/app/(dashboard)/cafe/purchase-requests/_components/purchase-request-actions";
import { PurchaseRequestStatusBadge } from "@/app/(dashboard)/cafe/purchase-requests/_components/purchase-request-status-badge";
import {
  canCancelPurchaseRequest,
  canCompareSuppliers,
  canCreatePurchaseRequest,
} from "@/src/domain/cafe-access";
import type { PurchaseRequestItemDTO } from "@/src/domain/purchase-request";
import {
  formatPersianDate,
  formatPersianDateTime,
  formatPersianNumber,
} from "@/src/lib/persian-format";
import {
  getPurchaseRequestById,
  PurchaseRequestNotFoundError,
  PurchaseRequestValidationError,
  requireCafeMemberAccess,
} from "@/src/services/purchase-request-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "جزئیات استعلام قیمت | پنل کافه",
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string | string[] }>;
};

function itemTitle(item: PurchaseRequestItemDTO) {
  return item.itemType === "catalog"
    ? item.productSnapshot?.name || "کالای کاتالوگ"
    : item.customTitle || "کالای سفارشی";
}

function itemUnit(item: PurchaseRequestItemDTO) {
  return item.itemType === "catalog"
    ? item.productSnapshot?.unit || "واحد"
    : item.customUnit || "واحد";
}

export default async function PurchaseRequestDetailPage({ params, searchParams }: Props) {
  const [{ id }, query, identity] = await Promise.all([
    params,
    searchParams,
    requireCafeMemberAccess(),
  ]);
  let request;
  try {
    request = await getPurchaseRequestById(id);
  } catch (error) {
    if (error instanceof PurchaseRequestNotFoundError || error instanceof PurchaseRequestValidationError) notFound();
    throw error;
  }

  const canSubmit = request.status === "draft" && canCreatePurchaseRequest(identity);
  const canCancel = canCancelPurchaseRequest(identity, request);
  const canCompare =
    request.status === "submitted" && canCompareSuppliers(identity);
  const created = typeof query.created === "string" ? query.created : undefined;
  const successMessage =
    created === "draft" && request.status === "draft"
      ? "پیش‌نویس استعلام ذخیره شد."
      : created === "submitted" && request.status === "submitted"
        ? "استعلام با موفقیت ثبت شد."
        : null;

  return (
    <div className="cafe-content-container space-y-6">
      <Link href="/cafe/purchase-requests" className="inline-flex min-h-10 items-center gap-2 rounded-control text-xs font-black text-ink-muted transition hover:text-primary"><IconArrowRight className="size-4" aria-hidden="true" />بازگشت به استعلام‌های قیمت</Link>

      {successMessage ? <div role="status" className="rounded-control border border-success/25 bg-success-soft px-4 py-3 text-sm font-bold leading-7 text-success">{successMessage} شماره استعلام: <span dir="ltr" className="font-black">{request.referenceNumber}</span></div> : null}

      <header className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><PurchaseRequestStatusBadge status={request.status} /><span className="inline-flex items-center gap-1 text-xs font-black text-primary" dir="ltr"><IconHash className="size-3.5" aria-hidden="true" />{request.referenceNumber}</span></div>
            <h1 className="mt-3 break-words text-2xl font-black tracking-tight text-ink sm:text-3xl">{request.title || "استعلام بدون عنوان"}</h1>
            <dl className="mt-4 flex flex-col gap-2 text-xs text-ink-muted sm:flex-row sm:flex-wrap sm:gap-x-5">
              <div className="flex items-center gap-2"><IconUser className="size-4 text-primary" aria-hidden="true" /><dt className="sr-only">ایجادکننده</dt><dd className="font-bold text-ink">{request.creatorName || "کاربر کافه"}</dd></div>
              <div className="flex items-center gap-2"><IconCalendar className="size-4 text-primary" aria-hidden="true" /><dt className="sr-only">تاریخ ایجاد</dt><dd>{formatPersianDateTime(request.createdAt)}</dd></div>
              <div className="flex items-center gap-2"><IconClipboardList className="size-4 text-primary" aria-hidden="true" /><dt className="sr-only">تعداد اقلام</dt><dd className="font-bold text-ink">{formatPersianNumber(request.itemCount)} قلم</dd></div>
            </dl>
          </div>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
            <PurchaseRequestActions requestId={request.id} canSubmit={canSubmit} canCancel={canCancel} />
            {canCompare ? (
              <Link
                href={`/cafe/purchase-requests/${request.id}/compare`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover"
              >
                <IconArrowsDiff className="size-4" aria-hidden="true" />
                مقایسه پیشنهادها
              </Link>
            ) : null}
          </div>
        </div>

        <dl className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-3">
          <DetailMeta label="تاریخ موردنیاز" value={formatPersianDate(request.neededByDate)} />
          <DetailMeta label="زمان ارسال" value={request.submittedAt ? formatPersianDateTime(request.submittedAt) : "هنوز ارسال نشده"} />
          <DetailMeta label="آخرین تغییر" value={formatPersianDateTime(request.updatedAt)} />
        </dl>

        {request.note ? <div className="mt-5 rounded-control border border-line bg-surface-subtle px-4 py-3"><div className="flex items-center gap-2 text-xs font-black text-ink-muted"><IconFileDescription className="size-4 text-primary" aria-hidden="true" />یادداشت استعلام</div><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink">{request.note}</p></div> : null}
      </header>

      {request.status === "submitted" ? <section className="flex items-start gap-3 rounded-card border border-primary/20 bg-primary-soft p-4 text-primary"><IconSend className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><div><h2 className="text-sm font-black">استعلام ثبت شده است</h2><p className="mt-1 text-xs leading-6">این استعلام آماده ورود به مرحله تطبیق با تأمین‌کنندگان است.</p></div></section> : null}

      <section aria-labelledby="rfq-items-title">
        <div className="mb-3"><h2 id="rfq-items-title" className="text-base font-black text-ink">اقلام استعلام</h2><p className="mt-1 text-xs leading-6 text-ink-muted">نام، برند، دسته‌بندی و واحد از snapshot زمان ثبت استعلام نمایش داده می‌شود.</p></div>
        <div className="grid gap-3 md:grid-cols-2">
          {request.items.map((item, index) => (
            <article key={item.id} className="min-w-0 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
              <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-control bg-primary-soft font-black text-primary">{formatPersianNumber(index + 1)}</span><div className="min-w-0"><h3 className="break-words text-sm font-black leading-6 text-ink">{itemTitle(item)}</h3><p className="mt-1 inline-flex items-center gap-1.5 text-xs text-ink-muted">{item.itemType === "catalog" ? <IconPackage className="size-3.5" aria-hidden="true" /> : <IconClipboardList className="size-3.5" aria-hidden="true" />}{item.itemType === "catalog" ? "کالای کاتالوگ" : "کالای سفارشی"}</p></div></div>
              <div className="mt-4 rounded-control bg-surface-subtle p-3"><p className="flex items-center gap-1.5 text-[11px] font-bold text-ink-muted"><IconScale className="size-3.5" aria-hidden="true" />مقدار استعلام</p><p className="mt-1 text-lg font-black text-ink">{formatPersianNumber(item.quantity)} {itemUnit(item)}</p></div>
              {item.itemType === "catalog" && (item.productSnapshot?.brand || item.productSnapshot?.categoryName) ? <dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><dt className="font-bold text-ink-muted">برند</dt><dd className="mt-1 font-black text-ink">{item.productSnapshot.brand || "—"}</dd></div><div><dt className="font-bold text-ink-muted">دسته‌بندی</dt><dd className="mt-1 font-black text-ink">{item.productSnapshot.categoryName || "—"}</dd></div></dl> : null}
              {item.note ? <p className="mt-3 text-xs leading-6 text-ink-muted"><strong className="text-ink">یادداشت قلم:</strong> {item.note}</p> : null}
            </article>
          ))}
        </div>
      </section>

      {request.status === "cancelled" ? <section className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-6"><h2 className="text-base font-black text-ink">اطلاعات لغو</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2"><DetailMeta label="لغوکننده" value={request.cancellerName || "کاربر کافه"} /><DetailMeta label="زمان لغو" value={formatPersianDateTime(request.cancelledAt)} /></dl>{request.cancelReason ? <div className="mt-4 rounded-control bg-danger-soft px-4 py-3 text-sm leading-7 text-danger"><strong>دلیل لغو:</strong> {request.cancelReason}</div> : null}</section> : null}
    </div>
  );
}

function DetailMeta({ label, value }: { label: string; value: string }) {
  return <div className="rounded-control bg-surface-subtle p-3"><dt className="text-[11px] font-bold text-ink-muted">{label}</dt><dd className="mt-1 text-sm font-black text-ink">{value}</dd></div>;
}
