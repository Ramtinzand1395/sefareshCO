import {
  IconArrowRight,
  IconCalendar,
  IconCheck,
  IconClipboardList,
  IconFileDescription,
  IconPackage,
  IconScale,
  IconUser,
} from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CancelInternalRequest } from "@/app/(dashboard)/cafe/internal-requests/_components/cancel-internal-request";
import { InternalRequestReview } from "@/app/(dashboard)/cafe/internal-requests/_components/internal-request-review";
import { InternalRequestStatusBadge } from "@/app/(dashboard)/cafe/internal-requests/_components/internal-request-status-badge";
import {
  canCancelInternalRequest,
  canReviewInternalRequest,
} from "@/src/domain/cafe-access";
import {
  formatPersianDateTime,
  formatPersianNumber,
} from "@/src/lib/persian-format";
import type { InternalRequestItemDTO } from "@/src/repositories/internal-purchase-request-repository";
import {
  getInternalPurchaseRequestDetail,
  InternalRequestNotFoundError,
  InternalRequestValidationError,
  requireCafeMemberAccess,
} from "@/src/services/internal-purchase-request-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "جزئیات درخواست داخلی | پنل کافه",
};

type Props = {
  params: Promise<{ id: string }>;
};

function itemTitle(item: InternalRequestItemDTO) {
  return item.itemType === "catalog"
    ? item.productName || "کالای کاتالوگ"
    : item.customTitle || "کالای خارج از کاتالوگ";
}

function itemUnit(item: InternalRequestItemDTO) {
  return item.itemType === "catalog"
    ? item.productUnit || "واحد"
    : item.customUnit || "واحد";
}

export default async function InternalRequestDetailPage({ params }: Props) {
  const { id } = await params;
  const identity = await requireCafeMemberAccess();

  let request;
  try {
    request = await getInternalPurchaseRequestDetail(id);
  } catch (error) {
    if (
      error instanceof InternalRequestNotFoundError ||
      error instanceof InternalRequestValidationError
    ) {
      notFound();
    }
    throw error;
  }

  const pending = request.status === "pending";
  const canReview = pending && canReviewInternalRequest(identity);
  const canCancel = canCancelInternalRequest(identity, request);

  return (
    <div className="cafe-content-container space-y-6">
      <div>
        <Link
          href="/cafe/internal-requests"
          className="inline-flex min-h-10 items-center gap-2 rounded-control text-xs font-black text-ink-muted transition hover:text-primary"
        >
          <IconArrowRight className="size-4" aria-hidden="true" />
          بازگشت به درخواست‌های داخلی
        </Link>
      </div>

      <header className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <InternalRequestStatusBadge status={request.status} />
              <span className="text-xs font-bold text-ink-muted">
                {formatPersianNumber(request.items.length)} قلم
              </span>
            </div>
            <h1 className="mt-3 break-words text-2xl font-black tracking-tight text-ink sm:text-3xl">
              {request.title || "درخواست خرید بدون عنوان"}
            </h1>
            <dl className="mt-4 flex flex-col gap-2 text-xs text-ink-muted sm:flex-row sm:flex-wrap sm:gap-x-5">
              <div className="flex items-center gap-2">
                <IconUser className="size-4 text-primary" aria-hidden="true" />
                <dt className="sr-only">ثبت‌کننده</dt>
                <dd className="font-bold text-ink">{request.requesterName || "کاربر کافه"}</dd>
              </div>
              <div className="flex items-center gap-2">
                <IconCalendar className="size-4 text-primary" aria-hidden="true" />
                <dt className="sr-only">تاریخ ثبت</dt>
                <dd>{formatPersianDateTime(request.createdAt)}</dd>
              </div>
            </dl>
          </div>

          {canCancel ? <CancelInternalRequest requestId={request.id} /> : null}
        </div>

        {request.description ? (
          <div className="mt-5 rounded-control border border-line bg-surface-subtle px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-black text-ink-muted">
              <IconFileDescription className="size-4 text-primary" aria-hidden="true" />
              توضیحات درخواست
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink">{request.description}</p>
          </div>
        ) : null}
      </header>

      <section aria-labelledby="request-items-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="request-items-title" className="text-base font-black text-ink">اقلام درخواست</h2>
            <p className="mt-1 text-xs leading-6 text-ink-muted">
              مقدار درخواست‌شده و نتیجه بررسی هر قلم را جداگانه ببینید.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {request.items.map((item, index) => {
            const unit = itemUnit(item);
            return (
              <article key={item.id} className="flex min-w-0 flex-col rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-control bg-primary-soft font-black text-primary">
                      {formatPersianNumber(index + 1)}
                    </span>
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-black leading-6 text-ink">{itemTitle(item)}</h3>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-ink-muted">
                        {item.itemType === "catalog" ? <IconPackage className="size-3.5" aria-hidden="true" /> : <IconClipboardList className="size-3.5" aria-hidden="true" />}
                        {item.itemType === "catalog" ? "کالای کاتالوگ" : "کالای خارج از کاتالوگ"}
                      </p>
                    </div>
                  </div>
                  <InternalRequestStatusBadge status={item.status} />
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-line/70 py-4">
                  <div className="rounded-control bg-surface-subtle p-3">
                    <dt className="flex items-center gap-1.5 text-[11px] font-bold text-ink-muted">
                      <IconScale className="size-3.5" aria-hidden="true" />
                      مقدار درخواست‌شده
                    </dt>
                    <dd className="mt-1 text-base font-black text-ink">
                      {formatPersianNumber(item.requestedQuantity)} {unit}
                    </dd>
                  </div>
                  <div className="rounded-control bg-surface-subtle p-3">
                    <dt className="flex items-center gap-1.5 text-[11px] font-bold text-ink-muted">
                      <IconCheck className="size-3.5" aria-hidden="true" />
                      مقدار تأییدشده
                    </dt>
                    <dd className={`mt-1 font-black ${pending ? "text-xs leading-6 text-warning" : "text-base text-ink"}`}>
                      {pending
                        ? "هنوز بررسی نشده"
                        : `${formatPersianNumber(item.approvedQuantity)} ${unit}`}
                    </dd>
                  </div>
                </dl>

                {item.note ? (
                  <p className="mt-3 text-xs leading-6 text-ink-muted">
                    <strong className="text-ink">یادداشت قلم:</strong> {item.note}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      {!pending ? (
        <section className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-6" aria-labelledby="request-result-title">
          <h2 id="request-result-title" className="text-base font-black text-ink">
            نتیجه نهایی
          </h2>

          {request.status === "cancelled" ? (
            <div className="mt-4 space-y-3 text-sm leading-7 text-ink-muted">
              <p>
                این درخواست در {formatPersianDateTime(request.cancelledAt)} لغو شده است.
              </p>
              {request.cancelReason ? (
                <div className="rounded-control bg-danger-soft px-4 py-3 text-sm text-danger">
                  <strong>دلیل لغو:</strong> {request.cancelReason}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-bold text-ink-muted">بررسی‌کننده</dt>
                  <dd className="mt-1 font-black text-ink">{request.reviewerName || "مدیر کافه"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-ink-muted">زمان بررسی</dt>
                  <dd className="mt-1 text-ink">{formatPersianDateTime(request.reviewedAt)}</dd>
                </div>
              </dl>
              {request.reviewNotes ? (
                <div className="rounded-control bg-surface-subtle px-4 py-3">
                  <p className="text-xs font-bold text-ink-muted">توضیحات بررسی</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink">{request.reviewNotes}</p>
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {canReview ? <InternalRequestReview requestId={request.id} items={request.items} /> : null}
    </div>
  );
}
