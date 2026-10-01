import {
  IconArrowLeft,
  IconCalendar,
  IconClipboardList,
  IconEye,
  IconPlus,
  IconUser,
} from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AdminPagination } from "@/app/(dashboard)/admin/_components/admin-pagination";
import { InternalRequestStatusBadge } from "@/app/(dashboard)/cafe/internal-requests/_components/internal-request-status-badge";
import { NewInternalRequest } from "@/app/(dashboard)/cafe/internal-requests/_components/new-internal-request";
import { canCreateInternalRequest } from "@/src/domain/cafe-access";
import {
  internalRequestStatusValues,
  type InternalRequestStatus,
} from "@/src/domain/schemas/internal-purchase-request";
import {
  formatPersianDateTime,
  formatPersianNumber,
} from "@/src/lib/persian-format";
import { getBuyerCatalog } from "@/src/services/cafe-catalog-service";
import {
  getInternalPurchaseRequestsList,
  requireCafeMemberAccess,
} from "@/src/services/internal-purchase-request-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "درخواست‌های داخلی | پنل کافه",
};

type QueryParam = string | string[] | undefined;
type Props = {
  searchParams: Promise<Record<string, QueryParam>>;
};

const statusFilters: Array<{
  value?: InternalRequestStatus;
  label: string;
}> = [
  { label: "همه" },
  { value: "pending", label: "در انتظار" },
  { value: "approved", label: "تأیید شده" },
  { value: "partially_approved", label: "تأیید جزئی" },
  { value: "rejected", label: "رد شده" },
  { value: "cancelled", label: "لغو شده" },
];

function getSingleParam(value: QueryParam) {
  return typeof value === "string" ? value : undefined;
}

function getSafePage(value: QueryParam) {
  const parsed = Number(getSingleParam(value));
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function getSafeStatus(value: QueryParam): InternalRequestStatus | undefined {
  const status = getSingleParam(value);
  return internalRequestStatusValues.includes(status as InternalRequestStatus)
    ? (status as InternalRequestStatus)
    : undefined;
}

function buildListHref(status?: InternalRequestStatus, page = 1) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/cafe/internal-requests?${query}` : "/cafe/internal-requests";
}

export default async function InternalRequestsPage({ searchParams }: Props) {
  const rawParams = await searchParams;
  const page = getSafePage(rawParams.page);
  const status = getSafeStatus(rawParams.status);
  const identity = await requireCafeMemberAccess();
  const canCreate = canCreateInternalRequest(identity);

  const [result, catalog] = await Promise.all([
    getInternalPurchaseRequestsList({ page, pageSize: 20, status }),
    canCreate
      ? getBuyerCatalog({ page: 1, pageSize: 48, sort: "newest" })
      : Promise.resolve(null),
  ]);

  const { items, pagination } = result;
  const filtered = Boolean(status);
  const isOutOfRange = pagination.totalPages > 0 && page > pagination.totalPages;

  return (
    <div className="cafe-content-container space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black tracking-wide text-primary">
            گردش خرید داخل مجموعه
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">
            درخواست‌های داخلی
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-muted">
            نیازهای خرید روزانه تیم را ثبت کنید، روند بررسی را ببینید و تصمیم‌های
            مسئول خرید را در یک نمای روشن پیگیری کنید.
          </p>
        </div>
        {canCreate ? (
          <NewInternalRequest
            products={(catalog?.items ?? []).map((product) => ({
              id: product.id,
              name: product.name,
              brand: product.brand,
              unit: product.unit,
            }))}
          />
        ) : null}
      </header>

      <section aria-label="فیلتر وضعیت درخواست‌ها">
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2 rounded-card border border-line bg-surface p-2 shadow-card">
            {statusFilters.map((filter) => {
              const active = status === filter.value;
              return (
                <Link
                  key={filter.value ?? "all"}
                  href={buildListHref(filter.value)}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-10 items-center rounded-control px-4 text-xs font-black transition ${
                    active
                      ? "bg-primary text-white shadow-sm"
                      : "text-ink-muted hover:bg-primary-soft hover:text-primary"
                  }`}
                >
                  {filter.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="internal-requests-list-title"
        aria-live="polite"
        className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
      >
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div>
            <h2 id="internal-requests-list-title" className="text-base font-black text-ink">
              فهرست درخواست‌ها
            </h2>
            <p className="mt-1 text-xs leading-6 text-ink-muted">
              {filtered
                ? `${formatPersianNumber(pagination.total)} درخواست در وضعیت انتخاب‌شده`
                : `${formatPersianNumber(pagination.total)} درخواست ثبت‌شده`}
            </p>
          </div>
          {pagination.totalPages > 0 ? (
            <span className="text-xs font-bold text-ink-muted">
              صفحه {formatPersianNumber(Math.min(page, pagination.totalPages))} از {" "}
              {formatPersianNumber(pagination.totalPages)}
            </span>
          ) : null}
        </div>

        {isOutOfRange ? (
          <EmptyState
            title="این صفحه از درخواست‌ها وجود ندارد"
            description="ممکن است تعداد درخواست‌ها تغییر کرده باشد. به صفحه اول همین فیلتر برگردید."
            action={
                <Link href={buildListHref(status)} className="inline-flex min-h-11 items-center rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover">
                بازگشت به صفحه اول
              </Link>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            title={
              filtered
                ? "درخواستی با این وضعیت پیدا نشد."
                : "هنوز درخواست داخلی ثبت نشده است."
            }
            description={
              filtered
                ? "برای دیدن سایر درخواست‌ها، فیلتر وضعیت را پاک کنید."
                : "اولین نیاز خرید تیم را ثبت کنید تا روند بررسی آن از همین‌جا قابل پیگیری باشد."
            }
            action={
              filtered ? (
                <Link href="/cafe/internal-requests" className="inline-flex min-h-11 items-center rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover">
                  پاک کردن فیلتر
                </Link>
              ) : canCreate ? (
                <span className="inline-flex min-h-11 items-center gap-2 rounded-control bg-primary-soft px-4 text-xs font-black text-primary">
                  <IconPlus className="size-4" aria-hidden="true" />
                  از دکمه «درخواست جدید» استفاده کنید
                </span>
              ) : null
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[760px] text-start">
                <thead className="bg-surface-subtle text-xs font-black text-ink-muted">
                  <tr>
                    <th className="px-5 py-3 text-start">درخواست</th>
                    <th className="px-4 py-3 text-start">ثبت‌کننده</th>
                    <th className="px-4 py-3 text-start">تاریخ ثبت</th>
                    <th className="px-4 py-3 text-start">اقلام</th>
                    <th className="px-4 py-3 text-start">وضعیت بررسی</th>
                    <th className="px-5 py-3 text-end">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/80">
                  {items.map((request) => (
                    <tr key={request.id} className="transition hover:bg-surface-subtle/65">
                      <td className="max-w-xs px-5 py-4 align-top">
                        <Link href={`/cafe/internal-requests/${request.id}`} className="font-black text-ink transition hover:text-primary">
                          {request.title || "درخواست خرید بدون عنوان"}
                        </Link>
                        {request.description ? (
                          <p className="mt-1 line-clamp-1 text-xs leading-6 text-ink-muted">{request.description}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 align-top text-sm font-bold text-ink">
                        {request.requesterName || "کاربر کافه"}
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-ink-muted">
                        {formatPersianDateTime(request.createdAt)}
                      </td>
                      <td className="px-4 py-4 align-top text-sm font-black text-ink">
                        {formatPersianNumber(request.itemCount)} قلم
                      </td>
                      <td className="px-4 py-4 align-top">
                        <InternalRequestStatusBadge status={request.status} />
                      </td>
                      <td className="px-5 py-4 text-end align-top">
                        <Link href={`/cafe/internal-requests/${request.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-control border border-line px-3 text-xs font-black text-ink-muted transition hover:border-primary hover:text-primary">
                          <IconEye className="size-4" aria-hidden="true" />
                          مشاهده جزئیات
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-3 lg:hidden">
              {items.map((request) => (
                <article key={request.id} className="rounded-card border border-line bg-surface p-4 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-black leading-6 text-ink">
                        {request.title || "درخواست خرید بدون عنوان"}
                      </h3>
                      {request.description ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-6 text-ink-muted">{request.description}</p>
                      ) : null}
                    </div>
                    <InternalRequestStatusBadge status={request.status} />
                  </div>

                  <dl className="mt-4 grid gap-2 border-y border-line/70 py-3 text-xs text-ink-muted sm:grid-cols-3">
                    <div className="flex items-center gap-2">
                      <IconUser className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      <div className="min-w-0">
                        <dt className="sr-only">ثبت‌کننده</dt>
                        <dd className="truncate font-bold text-ink">{request.requesterName || "کاربر کافه"}</dd>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <IconCalendar className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      <div>
                        <dt className="sr-only">تاریخ ثبت</dt>
                        <dd>{formatPersianDateTime(request.createdAt)}</dd>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <IconClipboardList className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      <div>
                        <dt className="sr-only">تعداد اقلام</dt>
                        <dd className="font-bold text-ink">{formatPersianNumber(request.itemCount)} قلم</dd>
                      </div>
                    </div>
                  </dl>

                  <Link href={`/cafe/internal-requests/${request.id}`} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-primary-soft px-4 text-xs font-black text-primary transition hover:bg-primary hover:text-white">
                    مشاهده جزئیات
                    <IconArrowLeft className="size-4" aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>

            <AdminPagination
              pagination={pagination}
              entityLabel="درخواست"
              previousHref={buildListHref(status, page - 1)}
              nextHref={buildListHref(status, page + 1)}
            />
          </>
        )}
      </section>
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
        <IconClipboardList className="size-7" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-black text-ink">{title}</h3>
      <p className="mt-2 max-w-md text-xs leading-6 text-ink-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
