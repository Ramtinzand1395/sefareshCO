import {
  IconArrowLeft,
  IconCalendar,
  IconClipboardList,
  IconHash,
  IconInbox,
  IconPackage,
} from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AdminPagination } from "@/app/(dashboard)/admin/_components/admin-pagination";
import { SupplierRequestStatusBadge } from "@/app/(dashboard)/supplier/requests/_components/supplier-request-status-badge";
import { listSupplierRequestsForSupplierAction } from "@/app/actions/supplier-requests";
import { supplierRequestStatusValues } from "@/model/supplier-request";
import type { SupplierRequestStatus } from "@/src/domain/supplier-request";
import { createPaginationMeta } from "@/src/lib/admin-query";
import {
  formatPersianDate,
  formatPersianDateTime,
  formatPersianNumber,
} from "@/src/lib/persian-format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "درخواست‌های استعلام | پنل تأمین‌کننده",
};

type QueryParam = string | string[] | undefined;
type Props = { searchParams: Promise<Record<string, QueryParam>> };

const PAGE_SIZE = 20;
const statusFilters: Array<{
  value?: SupplierRequestStatus;
  label: string;
}> = [
  { label: "همه" },
  { value: "pending", label: "در انتظار پاسخ" },
  { value: "responded", label: "پاسخ داده‌شده" },
  { value: "declined", label: "ردشده" },
  { value: "cancelled", label: "لغوشده" },
];

function singleParam(value: QueryParam) {
  return typeof value === "string" ? value : undefined;
}

function safePage(value: QueryParam) {
  const parsed = Number(singleParam(value));
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function safeStatus(value: QueryParam): SupplierRequestStatus | undefined {
  const status = singleParam(value);
  return supplierRequestStatusValues.includes(status as SupplierRequestStatus)
    ? (status as SupplierRequestStatus)
    : undefined;
}

function listHref(status?: SupplierRequestStatus, page = 1) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/supplier/requests?${query}` : "/supplier/requests";
}

export default async function SupplierRequestsPage({ searchParams }: Props) {
  const rawParams = await searchParams;
  const page = safePage(rawParams.page);
  const status = safeStatus(rawParams.status);

  const [result, ...countResults] = await Promise.all([
    listSupplierRequestsForSupplierAction({ page, pageSize: PAGE_SIZE, status }),
    ...supplierRequestStatusValues.map((itemStatus) =>
      listSupplierRequestsForSupplierAction({
        page: 1,
        pageSize: 1,
        status: itemStatus,
      }),
    ),
  ]);

  if (!result.ok || !result.data) {
    return <LoadFailure message={result.error} />;
  }

  const counts = Object.fromEntries(
    supplierRequestStatusValues.map((itemStatus, index) => [
      itemStatus,
      countResults[index]?.data?.total ?? 0,
    ]),
  ) as Record<SupplierRequestStatus, number>;
  const totalAcrossStatuses = Object.values(counts).reduce(
    (sum, count) => sum + count,
    0,
  );
  const pagination = createPaginationMeta(page, PAGE_SIZE, result.data.total);
  const isOutOfRange = result.data.total > 0 && page > pagination.totalPages;

  return (
    <div className="cafe-content-container space-y-6">
      <header>
        <p className="text-xs font-black tracking-wide text-primary">
          کارتابل فروش
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          درخواست‌های استعلام
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-muted">
          استعلام‌های دریافتی را بررسی کنید و پیشنهاد قیمت خود را ثبت کنید.
        </p>
      </header>

      <section
        aria-label="خلاصه وضعیت درخواست‌های استعلام"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {statusFilters.slice(1).map((filter) => (
          <Link
            key={filter.value}
            href={listHref(filter.value)}
            className="rounded-card border border-line bg-surface p-4 shadow-card transition hover:border-primary"
          >
            <span className="block text-xs font-bold text-ink-muted">
              {filter.label}
            </span>
            <span className="mt-2 block text-2xl font-black tabular-nums text-ink">
              {formatPersianNumber(counts[filter.value!] ?? 0)}
            </span>
          </Link>
        ))}
      </section>

      <section aria-label="فیلتر وضعیت درخواست‌ها">
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2 rounded-card border border-line bg-surface p-2 shadow-card">
            {statusFilters.map((filter) => {
              const active = status === filter.value;
              return (
                <Link
                  key={filter.value ?? "all"}
                  href={listHref(filter.value)}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-control px-4 text-xs font-black transition ${
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
        aria-labelledby="supplier-requests-list-title"
        aria-live="polite"
        className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
      >
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div>
            <h2
              id="supplier-requests-list-title"
              className="text-base font-black text-ink"
            >
              فهرست درخواست‌ها
            </h2>
            <p className="mt-1 text-xs leading-6 text-ink-muted">
              {status
                ? `${formatPersianNumber(result.data.total)} درخواست در وضعیت انتخاب‌شده`
                : `${formatPersianNumber(result.data.total)} درخواست استعلام`}
            </p>
          </div>
          {result.data.total > 0 ? (
            <span className="text-xs font-bold text-ink-muted">
              صفحه {formatPersianNumber(Math.min(page, pagination.totalPages))} از{" "}
              {formatPersianNumber(pagination.totalPages)}
            </span>
          ) : null}
        </div>

        {isOutOfRange ? (
          <EmptyState
            title="این صفحه از درخواست‌ها وجود ندارد."
            description="ممکن است تعداد درخواست‌ها تغییر کرده باشد. به صفحه اول همین فیلتر برگردید."
            action={
              <Link href={listHref(status)} className={primaryLinkClass}>
                بازگشت به صفحه اول
              </Link>
            }
          />
        ) : result.data.items.length === 0 ? (
          <EmptyState
            title={
              status
                ? filteredEmptyTitle(status)
                : "هنوز درخواست استعلامی دریافت نکرده‌اید."
            }
            description={
              status
                ? "برای دیدن سایر درخواست‌ها، فیلتر وضعیت را تغییر دهید."
                : "درخواست‌های جدیدی که با کالاهای شما مطابقت داشته باشند در این بخش نمایش داده می‌شوند."
            }
            action={
              status && totalAcrossStatuses > 0 ? (
                <Link href="/supplier/requests" className={primaryLinkClass}>
                  مشاهده همه درخواست‌ها
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[900px] text-start">
                <thead className="bg-surface-subtle text-xs font-black text-ink-muted">
                  <tr>
                    <th className="px-5 py-3 text-start">شماره استعلام</th>
                    <th className="px-4 py-3 text-start">تعداد اقلام</th>
                    <th className="px-4 py-3 text-start">تاریخ دریافت</th>
                    <th className="px-4 py-3 text-start">تاریخ موردنیاز</th>
                    <th className="px-4 py-3 text-start">وضعیت</th>
                    <th className="px-5 py-3 text-end">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/80">
                  {result.data.items.map((request) => (
                    <tr
                      key={request.id}
                      className="transition hover:bg-surface-subtle/65"
                    >
                      <td className="px-5 py-4 align-top font-black text-primary" dir="ltr">
                        {request.referenceNumber}
                      </td>
                      <td className="px-4 py-4 align-top text-sm font-black text-ink">
                        {formatPersianNumber(request.itemCount)} قلم
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-ink-muted">
                        {formatPersianDateTime(request.sentAt ?? request.createdAt)}
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-ink-muted">
                        {formatPersianDate(request.neededByDate)}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <SupplierRequestStatusBadge status={request.status} />
                      </td>
                      <td className="px-5 py-4 text-end align-top">
                        <RequestLink id={request.id} status={request.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-3 lg:hidden">
              {result.data.items.map((request) => (
                <article
                  key={request.id}
                  className="min-w-0 rounded-card border border-line bg-surface p-4 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p
                      className="flex min-w-0 items-center gap-1 text-xs font-black text-primary"
                      dir="ltr"
                    >
                      <IconHash className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{request.referenceNumber}</span>
                    </p>
                    <SupplierRequestStatusBadge status={request.status} />
                  </div>
                  <dl className="mt-4 grid gap-3 border-y border-line/70 py-3 text-xs sm:grid-cols-2">
                    <Meta
                      icon={<IconPackage className="size-4 text-primary" />}
                      label="تعداد کالا"
                      value={`${formatPersianNumber(request.itemCount)} قلم`}
                    />
                    <Meta
                      icon={<IconCalendar className="size-4 text-primary" />}
                      label="تاریخ دریافت"
                      value={formatPersianDateTime(request.sentAt ?? request.createdAt)}
                    />
                    <Meta
                      icon={<IconClipboardList className="size-4 text-primary" />}
                      label="تاریخ موردنیاز"
                      value={formatPersianDate(request.neededByDate)}
                    />
                  </dl>
                  <RequestLink
                    id={request.id}
                    status={request.status}
                    mobile
                  />
                </article>
              ))}
            </div>

            <AdminPagination
              pagination={pagination}
              entityLabel="درخواست"
              previousHref={listHref(status, page - 1)}
              nextHref={listHref(status, page + 1)}
            />
          </>
        )}
      </section>
    </div>
  );
}

const primaryLinkClass =
  "inline-flex min-h-11 items-center rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover";

function filteredEmptyTitle(status: SupplierRequestStatus) {
  return {
    pending: "درخواست در انتظار پاسخی وجود ندارد.",
    responded: "درخواست پاسخ‌داده‌شده‌ای وجود ندارد.",
    declined: "درخواست ردشده‌ای وجود ندارد.",
    cancelled: "درخواست لغوشده‌ای وجود ندارد.",
  }[status];
}

function RequestLink({
  id,
  status,
  mobile = false,
}: {
  id: string;
  status: SupplierRequestStatus;
  mobile?: boolean;
}) {
  const label = status === "pending" ? "بررسی و پاسخ" : status === "responded" ? "مشاهده پاسخ" : "مشاهده";
  return (
    <Link
      href={`/supplier/requests/${id}`}
      className={
        mobile
          ? "mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-primary-soft px-4 text-xs font-black text-primary transition hover:bg-primary hover:text-white"
          : "inline-flex min-h-10 items-center gap-1.5 rounded-control border border-line px-3 text-xs font-black text-ink-muted transition hover:border-primary hover:text-primary"
      }
    >
      {label}
      <IconArrowLeft className="size-4" aria-hidden="true" />
    </Link>
  );
}

function Meta({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[10px] font-bold text-ink-muted">{label}</dt>
        <dd className="mt-1 break-words font-black text-ink">{value}</dd>
      </div>
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
        <IconInbox className="size-7" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-black text-ink">{title}</h3>
      <p className="mt-2 max-w-md text-xs leading-6 text-ink-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function LoadFailure({ message }: { message?: string }) {
  const isPermission = message?.includes("دسترسی");
  return (
    <section className="mx-auto max-w-2xl rounded-card border border-danger/20 bg-surface p-6 text-center shadow-card">
      <h1 className="text-xl font-black text-ink">بارگذاری درخواست‌ها انجام نشد</h1>
      <p className="mt-3 text-sm leading-7 text-ink-muted">
        {isPermission
          ? "اجازه مشاهده درخواست‌های استعلام برای حساب شما فعال نیست."
          : "در دریافت اطلاعات مشکلی پیش آمد. صفحه را دوباره بارگذاری کنید."}
      </p>
    </section>
  );
}
