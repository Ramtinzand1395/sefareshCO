import { IconArrowLeft, IconBuildingStore, IconSearch } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/app/(dashboard)/admin/_components/admin-page-header";
import { AdminPagination } from "@/app/(dashboard)/admin/_components/admin-pagination";
import { AdminEmptyState } from "@/app/(dashboard)/admin/_components/admin-ui";
import { BusinessStatusBadge, VerificationBadge } from "@/app/(dashboard)/admin/_components/status-badge";
import type { CafeStatus } from "@/src/domain/schemas/admin-cafe";
import { formatPersianDate, formatPersianNumber } from "@/src/lib/persian-format";
import { getAdminCafeList } from "@/src/services/admin-cafe-service";

export const metadata: Metadata = { title: "کافه‌ها — پنل مدیریت" };

const typeLabels: Record<string, string> = {
  cafe: "کافه",
  restaurant: "رستوران",
  fast_food: "فست‌فود",
  bakery: "نانوایی / قنادی",
  catering: "کترینگ",
  other: "سایر",
};
const statusOptions = [
  { value: "", label: "همه وضعیت‌ها" },
  { value: "active", label: "فعال" },
  { value: "pending", label: "در انتظار" },
  { value: "suspended", label: "تعلیق‌شده" },
  { value: "rejected", label: "ردشده" },
];
const validStatuses = new Set(["pending", "active", "suspended", "rejected"]);

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminCafesPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const search = typeof params.search === "string" ? params.search.trim() : undefined;
  const statusParam = typeof params.status === "string" ? params.status : undefined;
  const status = statusParam && validStatuses.has(statusParam) ? (statusParam as CafeStatus) : undefined;

  const { items, pagination } = await getAdminCafeList({
    page,
    pageSize: 20,
    search: search || undefined,
    status,
  });

  function buildUrl(overrides: Record<string, string | undefined>) {
    const query = new URLSearchParams();
    const merged = { search: search ?? "", status: statusParam ?? "", page: String(page), ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) query.set(key, value);
    }
    return `/admin/cafes?${query.toString()}`;
  }

  const hasFilters = Boolean(search || statusParam);

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5">
      <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
        <AdminPageHeader
          title="کافه‌ها و رستوران‌ها"
          description="اطلاعات کسب‌وکار، وضعیت فعالیت و اعضای کافه‌ها و رستوران‌ها را بررسی کنید."
          meta={`${formatPersianNumber(pagination.total)} کسب‌وکار`}
        />
      </div>

      <div className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
        <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem_auto] sm:items-end">
          <div className="min-w-0">
            <label htmlFor="cafe-search" className="mb-1.5 block text-xs font-bold text-ink-muted">جستجو</label>
            <div className="relative">
              <IconSearch className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <input
                id="cafe-search"
                name="search"
                type="search"
                defaultValue={search ?? ""}
                placeholder="نام، شماره تماس یا شهر"
                className="h-11 w-full rounded-control border border-line bg-surface ps-10 pe-3 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label htmlFor="cafe-status" className="mb-1.5 block text-xs font-bold text-ink-muted">وضعیت</label>
            <select id="cafe-status" name="status" defaultValue={statusParam ?? ""} className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary">
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="h-11 flex-1 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover sm:flex-none">اعمال فیلتر</button>
            {hasFilters ? <Link href="/admin/cafes" className="inline-flex h-11 items-center rounded-control border border-line px-4 text-sm font-bold text-ink-muted transition hover:border-primary hover:text-primary">پاک‌سازی</Link> : null}
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-black text-ink">فهرست کافه‌ها و رستوران‌ها</h2>
            <p className="mt-1 text-xs text-ink-muted">{hasFilters ? "نتیجهٔ جستجو و فیلتر اعمال‌شده" : "جدیدترین کسب‌وکارها در ابتدای فهرست"}</p>
          </div>
          <IconBuildingStore className="size-5 text-primary" aria-hidden="true" />
        </div>

        {items.length === 0 ? (
          <AdminEmptyState
            title={hasFilters ? "کافه‌ای با این مشخصات پیدا نشد" : "هنوز کافه‌ای ثبت نشده است"}
            description={hasFilters ? "عبارت جستجو یا وضعیت انتخاب‌شده را تغییر دهید." : undefined}
          />
        ) : (
          <>
            <div className="divide-y divide-line md:hidden">
              {items.map((cafe) => (
                <article key={cafe.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black text-ink">{cafe.name || "بدون نام"}</p>
                      <p className="mt-1 text-xs text-ink-muted">{typeLabels[cafe.type] ?? cafe.type}</p>
                    </div>
                    <BusinessStatusBadge status={cafe.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2"><VerificationBadge isVerified={cafe.isVerified} /></div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div><dt className="text-ink-muted">شهر</dt><dd className="mt-1 text-ink">{[cafe.province, cafe.city].filter(Boolean).join("، ") || "—"}</dd></div>
                    <div><dt className="text-ink-muted">تاریخ عضویت</dt><dd className="mt-1 text-ink">{formatPersianDate(cafe.createdAt)}</dd></div>
                  </dl>
                  <Link href={`/admin/cafes/${cafe.id}`} className="mt-4 inline-flex min-h-10 items-center gap-1.5 text-xs font-black text-primary">مشاهده جزئیات <IconArrowLeft className="size-4" aria-hidden="true" /></Link>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-surface-subtle text-xs text-ink-muted">
                  <tr>
                    <th className="px-5 py-3 text-start font-bold">کسب‌وکار</th>
                    <th className="px-5 py-3 text-start font-bold">موقعیت</th>
                    <th className="px-5 py-3 text-start font-bold">تماس</th>
                    <th className="px-5 py-3 text-start font-bold">وضعیت</th>
                    <th className="px-5 py-3 text-start font-bold">تأیید</th>
                    <th className="px-5 py-3 text-start font-bold">عضویت</th>
                    <th className="px-5 py-3 text-start font-bold"><span className="sr-only">عملیات</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((cafe) => (
                    <tr key={cafe.id} className="transition hover:bg-surface-subtle">
                      <td className="px-5 py-4"><p className="font-black text-ink">{cafe.name || "بدون نام"}</p><p className="mt-1 text-xs text-ink-muted">{typeLabels[cafe.type] ?? cafe.type}</p></td>
                      <td className="px-5 py-4 text-ink-muted">{[cafe.province, cafe.city].filter(Boolean).join("، ") || "—"}</td>
                      <td className="px-5 py-4 text-xs text-ink-muted" dir="ltr">{cafe.mobile || cafe.phone || "—"}</td>
                      <td className="px-5 py-4"><BusinessStatusBadge status={cafe.status} /></td>
                      <td className="px-5 py-4"><VerificationBadge isVerified={cafe.isVerified} /></td>
                      <td className="px-5 py-4 text-xs text-ink-muted">{formatPersianDate(cafe.createdAt)}</td>
                      <td className="px-5 py-4 text-end"><Link href={`/admin/cafes/${cafe.id}`} aria-label={`مشاهده جزئیات ${cafe.name}`} className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap text-xs font-black text-primary transition hover:text-primary-hover">جزئیات <IconArrowLeft className="size-4" aria-hidden="true" /></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <AdminPagination pagination={pagination} entityLabel="کافه" previousHref={buildUrl({ page: String(pagination.page - 1) })} nextHref={buildUrl({ page: String(pagination.page + 1) })} />
      </div>
    </section>
  );
}
