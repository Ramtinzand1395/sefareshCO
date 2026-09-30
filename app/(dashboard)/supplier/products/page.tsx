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
import type { OfferStatus } from "@/src/domain/schemas/supplier-offer";
import {
  formatPersianDate,
  formatPersianNumber,
  formatToman,
} from "@/src/lib/persian-format";
import {
  getActiveProductsForOfferSearch,
  getMyOfferList,
} from "@/src/services/supplier-offer-service";

export const metadata: Metadata = {
  title: "عرضهٔ محصولات کاتالوگ — پنل تأمین‌کننده",
};

const statusOptions = [
  { value: "", label: "همه وضعیت‌ها" },
  { value: "active", label: "فعال" },
  { value: "inactive", label: "غیرفعال" },
];

const validStatuses = new Set(["active", "inactive"]);

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SupplierProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const search =
    typeof params.search === "string" ? params.search.trim() : undefined;
  const statusParam =
    typeof params.status === "string" ? params.status : undefined;
  const status =
    statusParam && validStatuses.has(statusParam)
      ? (statusParam as OfferStatus)
      : undefined;

  const [{ items, pagination }, availableProducts] = await Promise.all([
    getMyOfferList({
      page,
      pageSize: 20,
      search: search || undefined,
      status,
    }),
    getActiveProductsForOfferSearch(""),
  ]);

  function buildUrl(overrides: Record<string, string | undefined>) {
    const query = new URLSearchParams();
    const merged = {
      search: search ?? "",
      status: statusParam ?? "",
      page: String(page),
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) query.set(key, value);
    }
    return `/supplier/products?${query.toString()}`;
  }

  const hasFilters = Boolean(search || statusParam);

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5">
      <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
        <AdminPageHeader
          title="عرضهٔ محصولات در Marketplace"
          description="کالاهای کاتالوگ را انتخاب کرده و قیمت، موجودی انبار و شرایط ارسال خود را مدیریت کنید."
          meta={`${formatPersianNumber(pagination.total)} عرضه ثبت‌شده`}
        />
      </div>

      {/* فرم ایجاد عرضه جدید */}
      <OfferCreateForm availableProducts={availableProducts} />

      {/* فیلترها و جستجو */}
      <div className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem_auto] md:items-end">
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
              defaultValue={statusParam ?? ""}
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

      {/* جدول فهرست عرضه‌ها */}
      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        {items.length === 0 ? (
          <AdminEmptyState
            title="هیچ عرضه‌ای یافت نشد"
            description="با استفاده از فرم ثبت بالا، نخستین محصول کاتالوگ را با قیمت و موجودی اختصاصی خود عرضه کنید."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-start text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-subtle text-xs font-bold text-ink-muted">
                  <th className="px-5 py-3.5 text-start">کالای مرجع</th>
                  <th className="px-5 py-3.5 text-start">دسته‌بندی</th>
                  <th className="px-5 py-3.5 text-start">قیمت فروش</th>
                  <th className="px-5 py-3.5 text-start">موجودی انبار</th>
                  <th className="px-5 py-3.5 text-start">حداقل سفارش (MOQ)</th>
                  <th className="px-5 py-3.5 text-start">وضعیت انتشار</th>
                  <th className="px-5 py-3.5 text-start">وضعیت خرید</th>
                  <th className="px-5 py-3.5 text-start">زمان ارسال</th>
                  <th className="px-5 py-3.5 text-start">آخرین به‌روزرسانی</th>
                  <th className="px-5 py-3.5 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((offer) => (
                  <tr
                    key={offer.id}
                    className="transition hover:bg-surface-subtle/50"
                  >
                    <td className="px-5 py-4 font-black text-ink">
                      <div className="flex items-center gap-2">
                        <IconPackage className="size-4 shrink-0 text-ink-muted" />
                        <span>{offer.productName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-ink-muted">
                      {offer.categoryName ? (
                        <span className="rounded-control bg-surface-subtle px-2 py-0.5 font-medium">
                          {offer.categoryName}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-4 font-black tabular-nums text-primary">
                      {formatToman(offer.price)}
                    </td>
                    <td className="px-5 py-4 font-bold tabular-nums text-ink">
                      {formatPersianNumber(offer.stock)} {offer.productUnit}
                    </td>
                    <td className="px-5 py-4 text-xs tabular-nums text-ink-muted">
                      {formatPersianNumber(offer.minOrderQuantity)}{" "}
                      {offer.productUnit}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          offer.status === "active"
                            ? "bg-success-soft text-success"
                            : "bg-danger-soft text-danger"
                        }`}
                      >
                        {offer.status === "active" ? "فعال" : "غیرفعال"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {offer.isEligibleForPurchase ? (
                        <span className="inline-flex items-center rounded-full bg-success-soft/70 px-2 py-0.5 text-[11px] font-bold text-success">
                          آماده سفارش
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-bold text-warning"
                          title="موجودی کمتر از حداقل سفارش است یا عرضه غیرفعال است"
                        >
                          {offer.status === "inactive"
                            ? "غیرفعال"
                            : "کسری موجودی"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-ink-muted tabular-nums">
                      {offer.deliveryDays === 0
                        ? "تحویل فوری"
                        : `${formatPersianNumber(offer.deliveryDays)} روز`}
                    </td>
                    <td className="px-5 py-4 text-xs text-ink-muted">
                      {formatPersianDate(offer.updatedAt)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <OfferRowActions offer={offer} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdminPagination
        pagination={pagination}
        entityLabel="عرضه"
        previousHref={buildUrl({ page: String(pagination.page - 1) })}
        nextHref={buildUrl({ page: String(pagination.page + 1) })}
      />
    </section>
  );
}
