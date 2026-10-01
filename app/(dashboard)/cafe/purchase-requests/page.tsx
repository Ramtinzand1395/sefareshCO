import {
  IconArrowLeft,
  IconCalendar,
  IconClipboardList,
  IconEye,
  IconHash,
  IconPlus,
  IconUser,
} from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AdminPagination } from "@/app/(dashboard)/admin/_components/admin-pagination";
import { NewPurchaseRequest } from "@/app/(dashboard)/cafe/purchase-requests/_components/new-purchase-request";
import { PurchaseRequestStatusBadge } from "@/app/(dashboard)/cafe/purchase-requests/_components/purchase-request-status-badge";
import { canCreatePurchaseRequest } from "@/src/domain/cafe-access";
import type { PurchaseRequestStatus } from "@/src/domain/purchase-request";
import { purchaseRequestStatusValues } from "@/src/domain/schemas/purchase-request";
import { createPaginationMeta } from "@/src/lib/admin-query";
import {
  formatPersianDateTime,
  formatPersianNumber,
} from "@/src/lib/persian-format";
import {
  listPurchaseRequests,
  requireCafeMemberAccess,
} from "@/src/services/purchase-request-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "استعلام‌های قیمت | پنل کافه",
};

type QueryParam = string | string[] | undefined;
type Props = { searchParams: Promise<Record<string, QueryParam>> };

const PAGE_SIZE = 20;
const statusFilters: Array<{ value?: PurchaseRequestStatus; label: string }> = [
  { label: "همه" },
  { value: "draft", label: "پیش‌نویس" },
  { value: "submitted", label: "ارسال‌شده" },
  { value: "cancelled", label: "لغوشده" },
];

function singleParam(value: QueryParam) {
  return typeof value === "string" ? value : undefined;
}

function safePage(value: QueryParam) {
  const parsed = Number(singleParam(value));
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function safeStatus(value: QueryParam): PurchaseRequestStatus | undefined {
  const status = singleParam(value);
  return purchaseRequestStatusValues.includes(status as PurchaseRequestStatus)
    ? (status as PurchaseRequestStatus)
    : undefined;
}

function listHref(status?: PurchaseRequestStatus, page = 1) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query
    ? `/cafe/purchase-requests?${query}`
    : "/cafe/purchase-requests";
}

export default async function PurchaseRequestsPage({ searchParams }: Props) {
  const rawParams = await searchParams;
  const page = safePage(rawParams.page);
  const status = safeStatus(rawParams.status);
  const autoOpen = singleParam(rawParams.new) === "1";
  const identity = await requireCafeMemberAccess();
  const canCreate = canCreatePurchaseRequest(identity);
  const result = await listPurchaseRequests({ page, pageSize: PAGE_SIZE, status });
  const pagination = createPaginationMeta(page, PAGE_SIZE, result.total);
  const filtered = Boolean(status);
  const isOutOfRange = result.total > 0 && page > pagination.totalPages;

  return (
    <div className="cafe-content-container space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black tracking-wide text-primary">
            خرید هوشمند و قابل پیگیری
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">
            استعلام‌های قیمت
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-muted">
            درخواست‌های استعلام قیمت کافه را ایجاد و پیگیری کنید.
          </p>
        </div>
        {canCreate ? <NewPurchaseRequest autoOpen={autoOpen} /> : null}
      </header>

      <section aria-label="فیلتر وضعیت استعلام‌ها">
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2 rounded-card border border-line bg-surface p-2 shadow-card">
            {statusFilters.map((filter) => {
              const active = status === filter.value;
              return (
                <Link
                  key={filter.value ?? "all"}
                  href={listHref(filter.value)}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-10 items-center rounded-control px-4 text-xs font-black transition ${active ? "bg-primary text-white shadow-sm" : "text-ink-muted hover:bg-primary-soft hover:text-primary"}`}
                >
                  {filter.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="purchase-requests-list-title"
        aria-live="polite"
        className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
      >
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div>
            <h2 id="purchase-requests-list-title" className="text-base font-black text-ink">
              فهرست استعلام‌ها
            </h2>
            <p className="mt-1 text-xs leading-6 text-ink-muted">
              {filtered
                ? `${formatPersianNumber(result.total)} استعلام در وضعیت انتخاب‌شده`
                : `${formatPersianNumber(result.total)} استعلام ثبت‌شده`}
            </p>
          </div>
          {result.total > 0 ? (
            <span className="text-xs font-bold text-ink-muted">
              صفحه {formatPersianNumber(Math.min(page, pagination.totalPages))} از {formatPersianNumber(pagination.totalPages)}
            </span>
          ) : null}
        </div>

        {isOutOfRange ? (
          <EmptyState
            title="این صفحه از استعلام‌ها وجود ندارد"
            description="ممکن است تعداد استعلام‌ها تغییر کرده باشد. به صفحه اول همین فیلتر برگردید."
            action={<Link href={listHref(status)} className="inline-flex min-h-11 items-center rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover">بازگشت به صفحه اول</Link>}
          />
        ) : result.items.length === 0 ? (
          <EmptyState
            title={filtered ? "استعلامی با این وضعیت پیدا نشد." : "هنوز استعلام قیمتی ثبت نشده است."}
            description={filtered ? "برای دیدن سایر استعلام‌ها، فیلتر وضعیت را پاک کنید." : "از لیست خرید، کالاهای موردنیاز را انتخاب کنید و برای آن‌ها استعلام قیمت بسازید."}
            action={filtered ? <Link href="/cafe/purchase-requests" className="inline-flex min-h-11 items-center rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover">پاک کردن فیلتر</Link> : canCreate ? <span className="inline-flex min-h-11 items-center gap-2 rounded-control bg-primary-soft px-4 text-xs font-black text-primary"><IconPlus className="size-4" aria-hidden="true" />از دکمه «استعلام جدید» استفاده کنید</span> : null}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[900px] text-start">
                <thead className="bg-surface-subtle text-xs font-black text-ink-muted">
                  <tr>
                    <th className="px-5 py-3 text-start">شماره استعلام</th>
                    <th className="px-4 py-3 text-start">عنوان</th>
                    <th className="px-4 py-3 text-start">ثبت‌کننده</th>
                    <th className="px-4 py-3 text-start">تاریخ ایجاد</th>
                    <th className="px-4 py-3 text-start">اقلام</th>
                    <th className="px-4 py-3 text-start">وضعیت</th>
                    <th className="px-5 py-3 text-end">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/80">
                  {result.items.map((request) => (
                    <tr key={request.id} className="transition hover:bg-surface-subtle/65">
                      <td className="px-5 py-4 align-top font-black text-primary" dir="ltr">{request.referenceNumber}</td>
                      <td className="max-w-xs px-4 py-4 align-top"><Link href={`/cafe/purchase-requests/${request.id}`} className="font-black text-ink transition hover:text-primary">{request.title || "استعلام بدون عنوان"}</Link></td>
                      <td className="px-4 py-4 align-top text-sm font-bold text-ink">{request.creatorName || "کاربر کافه"}</td>
                      <td className="px-4 py-4 align-top text-xs text-ink-muted">{formatPersianDateTime(request.createdAt)}</td>
                      <td className="px-4 py-4 align-top text-sm font-black text-ink">{formatPersianNumber(request.itemCount)} قلم</td>
                      <td className="px-4 py-4 align-top"><PurchaseRequestStatusBadge status={request.status} /></td>
                      <td className="px-5 py-4 text-end align-top"><Link href={`/cafe/purchase-requests/${request.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-control border border-line px-3 text-xs font-black text-ink-muted transition hover:border-primary hover:text-primary"><IconEye className="size-4" aria-hidden="true" />مشاهده</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-3 lg:hidden">
              {result.items.map((request) => (
                <article key={request.id} className="min-w-0 rounded-card border border-line bg-surface p-4 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="flex items-center gap-1 text-[11px] font-black text-primary" dir="ltr"><IconHash className="size-3.5" aria-hidden="true" />{request.referenceNumber}</p><h3 className="mt-2 break-words text-sm font-black leading-6 text-ink">{request.title || "استعلام بدون عنوان"}</h3></div>
                    <PurchaseRequestStatusBadge status={request.status} />
                  </div>
                  <dl className="mt-4 grid gap-3 border-y border-line/70 py-3 text-xs text-ink-muted sm:grid-cols-3">
                    <Meta icon={<IconClipboardList className="size-4 text-primary" />} label="تعداد اقلام" value={`${formatPersianNumber(request.itemCount)} قلم`} />
                    <Meta icon={<IconUser className="size-4 text-primary" />} label="ثبت‌کننده" value={request.creatorName || "کاربر کافه"} />
                    <Meta icon={<IconCalendar className="size-4 text-primary" />} label="تاریخ" value={formatPersianDateTime(request.createdAt)} />
                  </dl>
                  <Link href={`/cafe/purchase-requests/${request.id}`} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-primary-soft px-4 text-xs font-black text-primary transition hover:bg-primary hover:text-white">مشاهده جزئیات<IconArrowLeft className="size-4" aria-hidden="true" /></Link>
                </article>
              ))}
            </div>

            <AdminPagination pagination={pagination} entityLabel="استعلام" previousHref={listHref(status, page - 1)} nextHref={listHref(status, page + 1)} />
          </>
        )}
      </section>
    </div>
  );
}

function Meta({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex min-w-0 items-start gap-2"><span aria-hidden="true">{icon}</span><div className="min-w-0"><dt className="text-[10px] font-bold text-ink-muted">{label}</dt><dd className="mt-1 break-words font-black text-ink">{value}</dd></div></div>;
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center justify-center px-5 py-12 text-center"><span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary"><IconClipboardList className="size-7" aria-hidden="true" /></span><h3 className="mt-4 text-base font-black text-ink">{title}</h3><p className="mt-2 max-w-md text-xs leading-6 text-ink-muted">{description}</p>{action ? <div className="mt-5">{action}</div> : null}</div>;
}
