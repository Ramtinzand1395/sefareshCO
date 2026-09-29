import { IconArrowLeft, IconSearch, IconTruckDelivery } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/app/(dashboard)/admin/_components/admin-page-header";
import { AdminPagination } from "@/app/(dashboard)/admin/_components/admin-pagination";
import { AdminEmptyState } from "@/app/(dashboard)/admin/_components/admin-ui";
import { BusinessStatusBadge, VerificationBadge } from "@/app/(dashboard)/admin/_components/status-badge";
import type { SupplierStatus } from "@/src/domain/schemas/admin-supplier";
import { formatPersianDate, formatPersianNumber } from "@/src/lib/persian-format";
import { getAdminSupplierList } from "@/src/services/admin-supplier-service";

export const metadata: Metadata = { title: "تأمین‌کنندگان — پنل مدیریت" };

const statusOptions = [
  { value: "", label: "همه وضعیت‌ها" },
  { value: "active", label: "فعال" },
  { value: "pending", label: "در انتظار" },
  { value: "suspended", label: "تعلیق‌شده" },
  { value: "rejected", label: "ردشده" },
];
const verificationOptions = [
  { value: "", label: "همه" },
  { value: "true", label: "تأییدشده" },
  { value: "false", label: "تأییدنشده" },
];
const validStatuses = new Set(["pending", "active", "suspended", "rejected"]);

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminSuppliersPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const search = typeof params.search === "string" ? params.search.trim() : undefined;
  const statusParam = typeof params.status === "string" ? params.status : undefined;
  const status = statusParam && validStatuses.has(statusParam) ? (statusParam as SupplierStatus) : undefined;
  const verifiedParam = typeof params.verified === "string" ? params.verified : undefined;
  const isVerified = verifiedParam === "true" ? true : verifiedParam === "false" ? false : undefined;

  const { items, pagination } = await getAdminSupplierList({
    page,
    pageSize: 20,
    search: search || undefined,
    status,
    isVerified,
  });

  function buildUrl(overrides: Record<string, string | undefined>) {
    const query = new URLSearchParams();
    const merged = {
      search: search ?? "",
      status: statusParam ?? "",
      verified: verifiedParam ?? "",
      page: String(page),
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) query.set(key, value);
    }
    return `/admin/suppliers?${query.toString()}`;
  }

  const hasFilters = Boolean(search || statusParam || verifiedParam);

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5">
      <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
        <AdminPageHeader
          title="تأمین‌کنندگان"
          description="وضعیت فعالیت، تأیید هویت کسب‌وکار و اعضای تأمین‌کنندگان را بررسی کنید."
          meta={`${formatPersianNumber(pagination.total)} تأمین‌کننده`}
        />
      </div>

      <div className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem_auto] md:items-end">
          <div className="min-w-0">
            <label htmlFor="supplier-search" className="mb-1.5 block text-xs font-bold text-ink-muted">جستجو</label>
            <div className="relative">
              <IconSearch className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <input id="supplier-search" name="search" type="search" defaultValue={search ?? ""} placeholder="نام، شماره، شناسه ملی یا شهر" className="h-11 w-full rounded-control border border-line bg-surface ps-10 pe-3 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-primary" />
            </div>
          </div>
          <div>
            <label htmlFor="supplier-status" className="mb-1.5 block text-xs font-bold text-ink-muted">وضعیت</label>
            <select id="supplier-status" name="status" defaultValue={statusParam ?? ""} className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary">
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="supplier-verified" className="mb-1.5 block text-xs font-bold text-ink-muted">وضعیت تأیید</label>
            <select id="supplier-verified" name="verified" defaultValue={verifiedParam ?? ""} className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary">
              {verificationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="h-11 flex-1 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover md:flex-none">اعمال فیلتر</button>
            {hasFilters ? <Link href="/admin/suppliers" className="inline-flex h-11 items-center rounded-control border border-line px-4 text-sm font-bold text-ink-muted transition hover:border-primary hover:text-primary">پاک‌سازی</Link> : null}
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-black text-ink">فهرست تأمین‌کنندگان</h2>
            <p className="mt-1 text-xs text-ink-muted">{hasFilters ? "نتیجهٔ جستجو و فیلتر اعمال‌شده" : "جدیدترین تأمین‌کنندگان در ابتدای فهرست"}</p>
          </div>
          <IconTruckDelivery className="size-5 text-primary" aria-hidden="true" />
        </div>

        {items.length === 0 ? (
          <AdminEmptyState
            title={hasFilters ? "تأمین‌کننده‌ای با این مشخصات پیدا نشد" : "هنوز تأمین‌کننده‌ای ثبت نشده است"}
            description={hasFilters ? "عبارت جستجو یا فیلترهای انتخاب‌شده را تغییر دهید." : undefined}
          />
        ) : (
          <>
            <div className="divide-y divide-line md:hidden">
              {items.map((supplier) => (
                <article key={supplier.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate font-black text-ink">{supplier.businessName || "بدون نام"}</p>{supplier.legalName ? <p className="mt-1 truncate text-xs text-ink-muted">{supplier.legalName}</p> : null}</div>
                    <BusinessStatusBadge status={supplier.status} />
                  </div>
                  <div className="mt-3"><VerificationBadge isVerified={supplier.isVerified} /></div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div><dt className="text-ink-muted">شهر</dt><dd className="mt-1 text-ink">{[supplier.province, supplier.city].filter(Boolean).join("، ") || "—"}</dd></div>
                    <div><dt className="text-ink-muted">تاریخ عضویت</dt><dd className="mt-1 text-ink">{formatPersianDate(supplier.createdAt)}</dd></div>
                  </dl>
                  <Link href={`/admin/suppliers/${supplier.id}`} className="mt-4 inline-flex min-h-10 items-center gap-1.5 text-xs font-black text-primary">مشاهده جزئیات <IconArrowLeft className="size-4" aria-hidden="true" /></Link>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-surface-subtle text-xs text-ink-muted">
                  <tr>
                    <th className="px-5 py-3 text-start font-bold">تأمین‌کننده</th>
                    <th className="px-5 py-3 text-start font-bold">موقعیت</th>
                    <th className="px-5 py-3 text-start font-bold">تماس</th>
                    <th className="px-5 py-3 text-start font-bold">وضعیت</th>
                    <th className="px-5 py-3 text-start font-bold">تأیید</th>
                    <th className="px-5 py-3 text-start font-bold">عضویت</th>
                    <th className="px-5 py-3 text-start font-bold"><span className="sr-only">عملیات</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((supplier) => (
                    <tr key={supplier.id} className="transition hover:bg-surface-subtle">
                      <td className="px-5 py-4"><p className="font-black text-ink">{supplier.businessName || "بدون نام"}</p>{supplier.legalName ? <p className="mt-1 text-xs text-ink-muted">{supplier.legalName}</p> : null}</td>
                      <td className="px-5 py-4 text-ink-muted">{[supplier.province, supplier.city].filter(Boolean).join("، ") || "—"}</td>
                      <td className="px-5 py-4 text-xs text-ink-muted" dir="ltr">{supplier.mobile || supplier.phone || "—"}</td>
                      <td className="px-5 py-4"><BusinessStatusBadge status={supplier.status} /></td>
                      <td className="px-5 py-4"><VerificationBadge isVerified={supplier.isVerified} /></td>
                      <td className="px-5 py-4 text-xs text-ink-muted">{formatPersianDate(supplier.createdAt)}</td>
                      <td className="px-5 py-4 text-end"><Link href={`/admin/suppliers/${supplier.id}`} aria-label={`مشاهده جزئیات ${supplier.businessName}`} className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap text-xs font-black text-primary transition hover:text-primary-hover">جزئیات <IconArrowLeft className="size-4" aria-hidden="true" /></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <AdminPagination pagination={pagination} entityLabel="تأمین‌کننده" previousHref={buildUrl({ page: String(pagination.page - 1) })} nextHref={buildUrl({ page: String(pagination.page + 1) })} />
      </div>
    </section>
  );
}
