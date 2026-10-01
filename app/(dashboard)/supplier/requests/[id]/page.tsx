import {
  IconArrowRight,
  IconCalendar,
  IconClipboardList,
  IconFileDescription,
  IconHash,
  IconPackage,
  IconScale,
} from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ResponseWorkspace } from "@/app/(dashboard)/supplier/requests/_components/response-workspace";
import { SupplierRequestStatusBadge } from "@/app/(dashboard)/supplier/requests/_components/supplier-request-status-badge";
import { getSupplierRequestDetailForSupplierAction } from "@/app/actions/supplier-requests";
import { getSupplierResponseForSupplierAction } from "@/app/actions/supplier-responses";
import { canRespondToSupplierRequests } from "@/src/domain/supplier-access";
import { getCurrentSupplierIdentity } from "@/src/lib/auth-helpers";
import {
  formatPersianDate,
  formatPersianDateTime,
  formatPersianNumber,
} from "@/src/lib/persian-format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "جزئیات درخواست استعلام | پنل تأمین‌کننده",
};

type Props = { params: Promise<{ id: string }> };

export default async function SupplierRequestDetailPage({ params }: Props) {
  const { id } = await params;
  const requestResult = await getSupplierRequestDetailForSupplierAction(id);

  if (!requestResult.ok || !requestResult.data) {
    if (
      requestResult.error?.includes("یافت نشد") ||
      requestResult.error?.includes("شناسه درخواست نامعتبر")
    ) {
      notFound();
    }
    return <DetailLoadFailure permission={requestResult.error?.includes("دسترسی")} />;
  }

  const request = requestResult.data;
  const [identity, responseResult] = await Promise.all([
    getCurrentSupplierIdentity(),
    request.status === "responded" || request.status === "cancelled"
      ? getSupplierResponseForSupplierAction(request.id)
      : Promise.resolve({
          ok: false as const,
          data: undefined,
          error: undefined,
        }),
  ]);
  const canRespond = Boolean(identity && canRespondToSupplierRequests(identity));
  const response = responseResult.ok ? responseResult.data : undefined;
  const responseLoadFailed =
    request.status === "responded" && !response && Boolean(responseResult.error);

  return (
    <div className="cafe-content-container space-y-6">
      <Link
        href="/supplier/requests"
        className="inline-flex min-h-10 items-center gap-2 rounded-control text-xs font-black text-ink-muted transition hover:text-primary"
      >
        <IconArrowRight className="size-4" aria-hidden="true" />
        بازگشت به درخواست‌های استعلام
      </Link>

      <header className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <SupplierRequestStatusBadge status={request.status} />
              <span
                className="inline-flex items-center gap-1 text-xs font-black text-primary"
                dir="ltr"
              >
                <IconHash className="size-3.5" aria-hidden="true" />
                {request.referenceNumber}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-ink sm:text-3xl">
              جزئیات درخواست استعلام
            </h1>
            <p className="mt-2 text-sm leading-7 text-ink-muted">
              اقلام و زمان موردنیاز را بررسی کنید و در صورت امکان پیشنهاد قیمت بدهید.
            </p>
          </div>
        </div>

        <dl className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <DetailMeta
            icon={<IconCalendar className="size-4" />}
            label="تاریخ دریافت"
            value={formatPersianDateTime(request.sentAt ?? request.createdAt)}
          />
          <DetailMeta
            icon={<IconClipboardList className="size-4" />}
            label="تاریخ موردنیاز"
            value={formatPersianDate(request.neededByDate)}
          />
          <DetailMeta
            icon={<IconPackage className="size-4" />}
            label="تعداد اقلام"
            value={`${formatPersianNumber(request.itemCount)} قلم`}
          />
          <DetailMeta
            icon={<IconHash className="size-4" />}
            label="شماره استعلام"
            value={request.referenceNumber}
            ltr
          />
        </dl>
      </header>

      {request.status === "cancelled" ? (
        <section
          role="status"
          className="rounded-card border border-warning/25 bg-warning-soft p-4 text-warning"
        >
          <h2 className="text-sm font-black">این استعلام توسط خریدار لغو شده است.</h2>
          <p className="mt-1 text-xs leading-6">
            ثبت، ویرایش یا رد پیشنهاد برای این درخواست دیگر امکان‌پذیر نیست.
          </p>
        </section>
      ) : null}

      {request.status === "declined" ? (
        <section className="rounded-card border border-danger/20 bg-danger-soft p-4 text-danger">
          <h2 className="text-sm font-black">این درخواست رد شده است.</h2>
          <p className="mt-1 text-xs leading-6">
            برای این درخواست امکان ثبت یا ویرایش پیشنهاد قیمت وجود ندارد.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="supplier-request-items-title">
        <div className="mb-3">
          <h2 id="supplier-request-items-title" className="text-base font-black text-ink">
            اقلام درخواست
          </h2>
          <p className="mt-1 text-xs leading-6 text-ink-muted">
            اطلاعات کالاها مطابق زمان ارسال همین درخواست نمایش داده می‌شود.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {request.items.map((item, index) => (
            <article
              key={item.purchaseRequestItemId}
              className="min-w-0 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-control bg-primary-soft font-black text-primary">
                  {formatPersianNumber(index + 1)}
                </span>
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-black leading-6 text-ink">
                    {item.name}
                  </h3>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-ink-muted">
                    {item.brand ? <span>برند: {item.brand}</span> : null}
                    {item.categoryName ? <span>دسته: {item.categoryName}</span> : null}
                  </div>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs">
                <div>
                  <dt className="flex items-center gap-1 text-ink-muted">
                    <IconScale className="size-3.5 text-primary" aria-hidden="true" />
                    مقدار درخواستی
                  </dt>
                  <dd className="mt-1 font-black text-ink">
                    {formatPersianNumber(item.quantity)} {item.unit}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">واحد</dt>
                  <dd className="mt-1 font-black text-ink">{item.unit || "واحد"}</dd>
                </div>
              </dl>
              {item.note ? (
                <div className="mt-4 rounded-control bg-surface-subtle px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-ink-muted">
                    <IconFileDescription className="size-3.5" aria-hidden="true" />
                    یادداشت خریدار
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-ink">
                    {item.note}
                  </p>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      {responseLoadFailed ? (
        <section className="rounded-card border border-danger/20 bg-surface p-5 text-center shadow-card">
          <h2 className="text-base font-black text-ink">نمایش پیشنهاد ثبت‌شده ممکن نشد</h2>
          <p className="mt-2 text-xs leading-6 text-ink-muted">
            صفحه را دوباره بارگذاری کنید. اگر مشکل ادامه داشت، با پشتیبانی تماس بگیرید.
          </p>
        </section>
      ) : (
        <ResponseWorkspace
          request={request}
          initialResponse={response}
          canRespond={canRespond}
        />
      )}
    </div>
  );
}

function DetailMeta({
  icon,
  label,
  value,
  ltr = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="rounded-control bg-surface-subtle px-3 py-3">
      <dt className="flex items-center gap-1.5 text-[11px] font-bold text-ink-muted">
        <span className="text-primary" aria-hidden="true">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1.5 break-words text-sm font-black text-ink" dir={ltr ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );
}

function DetailLoadFailure({ permission = false }: { permission?: boolean }) {
  return (
    <section className="mx-auto max-w-2xl rounded-card border border-danger/20 bg-surface p-6 text-center shadow-card">
      <h1 className="text-xl font-black text-ink">نمایش درخواست ممکن نشد</h1>
      <p className="mt-3 text-sm leading-7 text-ink-muted">
        {permission
          ? "اجازه مشاهده این درخواست برای حساب شما فعال نیست."
          : "در دریافت اطلاعات مشکلی پیش آمد. لطفاً دوباره تلاش کنید."}
      </p>
      <Link href="/supplier/requests" className="mt-5 inline-flex min-h-11 items-center rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover">
        بازگشت به درخواست‌ها
      </Link>
    </section>
  );
}
