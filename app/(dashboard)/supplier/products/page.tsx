import { IconPackage, IconSearch } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/app/(dashboard)/admin/_components/admin-page-header";
import { AdminPagination } from "@/app/(dashboard)/admin/_components/admin-pagination";
import { AdminEmptyState } from "@/app/(dashboard)/admin/_components/admin-ui";
import {
  OfferCreateForm,
  OfferRowActions,
} from "@/app/(dashboard)/supplier/products/offer-forms";
import {
  SUPPLIER_OFFER_SEARCH_MAX_LENGTH,
  supplierOfferQuerySchema,
  type OfferStatus,
} from "@/src/domain/schemas/supplier-offer";
import {
  formatPersianDate,
  formatPersianNumber,
  formatToman,
} from "@/src/lib/persian-format";
import { getMyOfferList } from "@/src/services/supplier-offer-service";

export const metadata: Metadata = {
  title: "عرضهٔ محصولات کاتالوگ — پنل تأمین‌کننده",
};

const statusOptions = [
  { value: "", label: "همه وضعیت‌ها" },
  { value: "active", label: "فعال" },
  { value: "inactive", label: "غیرفعال" },
];

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function PublicationBadge({ status }: { status: OfferStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
        status === "active"
          ? "bg-success-soft text-success"
          : "bg-danger-soft text-danger"
      }`}
    >
      {status === "active" ? "فعال" : "غیرفعال"}
    </span>
  );
}

function PurchaseCheckBadge({ eligible }: { eligible: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
        eligible
          ? "bg-success-soft/70 text-success"
          : "bg-warning-soft text-warning"
      }`}
      title="این نشانگر فقط وضعیت انتشار و کف موجودی را می‌سنجد؛ امکان خرید نهایی در مسیر خریدار بررسی می‌شود."
    >
      {eligible ? "بررسی اولیه مثبت" : "نیازمند بررسی"}
    </span>
  );
}

function DeliveryTime({ days }: { days: number }) {
  return days === 0 ? (
    <>تحویل فوری</>
  ) : (
    <>{formatPersianNumber(days)} روز</>
  );
}

export default async function SupplierProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  const rawSearch = getSingleSearchParam(params.search)?.trim();
  const normalizedSearch = rawSearch
    ? rawSearch.slice(0, SUPPLIER_OFFER_SEARCH_MAX_LENGTH)
    : undefined;
  const parsedPage = supplierOfferQuerySchema.shape.page.safeParse(
    getSingleSearchParam(params.page),
  );
  const parsedStatus = supplierOfferQuerySchema.shape.status.safeParse(
    getSingleSearchParam(params.status),
  );
  const parsedQuery = supplierOfferQuerySchema.safeParse({
    page: parsedPage.success ? parsedPage.data : 1,
    pageSize: 20,
    search: normalizedSearch,
    status: parsedStatus.success ? parsedStatus.data : undefined,
  });
  const query = parsedQuery.success
    ? parsedQuery.data
    : supplierOfferQuerySchema.parse({ page: 1, pageSize: 20 });
  const { page, search, status } = query;
  const hasFilters = Boolean(search || status);

  const { items, pagination } = await getMyOfferList(query);

  let hasAnyOffers = pagination.total > 0;
  if (hasFilters && pagination.total === 0) {
    const unfiltered = await getMyOfferList({ page: 1, pageSize: 1 });
    hasAnyOffers = unfiltered.pagination.total > 0;
  }

  function buildUrl(overrides: Record<string, string | undefined>) {
    const query = new URLSearchParams();
    const merged = {
      search: search ?? "",
      status: status ?? "",
      page: String(page),
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) query.set(key, value);
    }
    const queryString = query.toString();
    return queryString ? `/supplier/products?${queryString}` : "/supplier/products";
  }

  const emptyTitle = !hasAnyOffers
    ? "هنوز عرضه‌ای ثبت نشده"
    : hasFilters
      ? "نتیجه‌ای برای این فیلتر پیدا نشد"
      : "در این صفحه عرضه‌ای وجود ندارد";
  const emptyDescription = !hasAnyOffers
    ? "با استفاده از فرم ثبت بالا، نخستین کالای کاتالوگ را با قیمت و موجودی اختصاصی خود عرضه کنید."
    : hasFilters
      ? "عبارت جستجو یا وضعیت انتشار را تغییر دهید و دوباره تلاش کنید."
      : "به صفحه قبلی برگردید یا فیلترها را پاک کنید.";

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5">
      <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
        <AdminPageHeader
          title="مدیریت عرضه‌های کاتالوگ"
          description="کالاهای کاتالوگ را انتخاب کنید و قیمت، موجودی انبار و شرایط ارسال عرضهٔ خود را مدیریت کنید."
          meta={`${formatPersianNumber(pagination.total)} عرضه در این فهرست`}
        />
      </div>

      <OfferCreateForm />

      <div className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
        <form
          method="get"
          className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem_auto] md:items-end"
        >
          <div className="min-w-0">
            <label
              htmlFor="offer-search"
              className="mb-1.5 block text-xs font-bold text-ink-muted"
            >
              جستجو در کالاهای عرضه‌شده
            </label>
            <div className="relative">
              <IconSearch
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
                aria-hidden="true"
              />
              <input
                id="offer-search"
                name="search"
                type="search"
                maxLength={SUPPLIER_OFFER_SEARCH_MAX_LENGTH}
                defaultValue={search ?? ""}
                placeholder="نام کالا، برند یا کد کالا..."
                className="h-11 w-full rounded-control border border-line bg-surface ps-10 pe-3 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="offer-status-filter"
              className="mb-1.5 block text-xs font-bold text-ink-muted"
            >
              وضعیت انتشار عرضه
            </label>
            <select
              id="offer-status-filter"
              name="status"
              defaultValue={status ?? ""}
              className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="h-11 flex-1 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover md:flex-none"
            >
              اعمال فیلتر
            </button>
            {hasFilters ? (
              <Link
                href="/supplier/products"
                className="inline-flex h-11 items-center rounded-control border border-line px-4 text-sm font-bold text-ink-muted transition hover:border-primary hover:text-primary"
              >
                پاک‌سازی
              </Link>
            ) : null}
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        {items.length === 0 ? (
          <AdminEmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          <div className="overflow-x-auto">
            <table className="block w-full border-collapse text-start text-sm lg:table lg:min-w-[1040px]">
              <thead className="hidden lg:table-header-group">
                <tr className="border-b border-line bg-surface-subtle text-xs font-bold text-ink-muted">
                  <th className="px-5 py-3.5 text-start">کالای مرجع</th>
                  <th className="px-5 py-3.5 text-start">دسته‌بندی</th>
                  <th className="px-5 py-3.5 text-start">قیمت فروش</th>
                  <th className="px-5 py-3.5 text-start">موجودی انبار</th>
                  <th className="px-5 py-3.5 text-start">حداقل سفارش</th>
                  <th className="px-5 py-3.5 text-start">وضعیت انتشار</th>
                  <th className="px-5 py-3.5 text-start">بررسی اولیه خرید</th>
                  <th className="px-5 py-3.5 text-start">زمان تحویل</th>
                  <th className="px-5 py-3.5 text-start">آخرین به‌روزرسانی</th>
                  <th className="px-5 py-3.5 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="block divide-y divide-line lg:table-row-group">
                {items.map((offer) => (
                  <tr
                    key={offer.id}
                    className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 transition hover:bg-surface-subtle/50 sm:p-5 lg:table-row lg:p-0"
                  >
                    <td className="col-span-2 block font-black text-ink lg:table-cell lg:px-5 lg:py-4">
                      <div className="flex items-center gap-2">
                        <span className="grid size-9 shrink-0 place-items-center rounded-control bg-primary-soft text-primary lg:size-auto lg:bg-transparent lg:text-ink-muted">
                          <IconPackage className="size-4" aria-hidden="true" />
                        </span>
                        <span>{offer.productName}</span>
                      </div>
                    </td>
                    <td className="col-span-2 block text-xs text-ink-muted lg:table-cell lg:px-5 lg:py-4">
                      <span className="mb-1 block lg:hidden">دسته‌بندی</span>
                      {offer.categoryName ? (
                        <span className="rounded-control bg-surface-subtle px-2 py-0.5 font-medium">
                          {offer.categoryName}
                        </span>
                      ) : (
                        "بدون دسته‌بندی مشخص"
                      )}
                    </td>
                    <td className="block font-black tabular-nums text-primary lg:table-cell lg:px-5 lg:py-4">
                      <span className="mb-1 block text-xs font-normal text-ink-muted lg:hidden">
                        قیمت فروش
                      </span>
                      {formatToman(offer.price)}
                    </td>
                    <td className="block font-bold tabular-nums text-ink lg:table-cell lg:px-5 lg:py-4">
                      <span className="mb-1 block text-xs font-normal text-ink-muted lg:hidden">
                        موجودی
                      </span>
                      {formatPersianNumber(offer.stock)} {offer.productUnit}
                    </td>
                    <td className="block text-xs tabular-nums text-ink lg:table-cell lg:px-5 lg:py-4 lg:text-ink-muted">
                      <span className="mb-1 block text-ink-muted lg:hidden">
                        حداقل سفارش
                      </span>
                      {formatPersianNumber(offer.minOrderQuantity)} {offer.productUnit}
                    </td>
                    <td className="block lg:table-cell lg:px-5 lg:py-4">
                      <span className="mb-1 block text-xs text-ink-muted lg:hidden">
                        وضعیت انتشار
                      </span>
                      <PublicationBadge status={offer.status} />
                    </td>
                    <td className="block lg:table-cell lg:px-5 lg:py-4">
                      <span className="mb-1 block text-xs text-ink-muted lg:hidden">
                        بررسی اولیه خرید
                      </span>
                      <PurchaseCheckBadge eligible={offer.isEligibleForPurchase} />
                    </td>
                    <td className="block text-xs tabular-nums text-ink lg:table-cell lg:px-5 lg:py-4 lg:text-ink-muted">
                      <span className="mb-1 block text-ink-muted lg:hidden">
                        زمان تحویل
                      </span>
                      <DeliveryTime days={offer.deliveryDays} />
                    </td>
                    <td className="col-span-2 block text-xs text-ink-muted lg:table-cell lg:px-5 lg:py-4">
                      <span className="lg:hidden">آخرین به‌روزرسانی: </span>
                      {formatPersianDate(offer.updatedAt)}
                    </td>
                    <td className="col-span-2 block border-t border-line pt-3 text-center lg:table-cell lg:border-0 lg:px-5 lg:py-4">
                      <OfferRowActions offer={offer} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AdminPagination
          pagination={pagination}
          entityLabel="عرضه"
          previousHref={buildUrl({ page: String(pagination.page - 1) })}
          nextHref={buildUrl({ page: String(pagination.page + 1) })}
        />
      </div>
    </section>
  );
}
