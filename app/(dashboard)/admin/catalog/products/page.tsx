import { IconPackage, IconSearch } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/app/(dashboard)/admin/_components/admin-page-header";
import { AdminPagination } from "@/app/(dashboard)/admin/_components/admin-pagination";
import { AdminEmptyState } from "@/app/(dashboard)/admin/_components/admin-ui";
import {
  ProductCreateForm,
  ProductStatusSelector,
} from "@/app/(dashboard)/admin/catalog/products/product-forms";
import type { ProductStatus } from "@/src/domain/schemas/admin-catalog";
import {
  formatPersianDate,
  formatPersianNumber,
} from "@/src/lib/persian-format";
import { getAdminCategorySimpleList } from "@/src/services/admin-category-service";
import { getAdminProductList } from "@/src/services/admin-product-service";

export const metadata: Metadata = {
  title: "محصولات کاتالوگ — پنل مدیریت",
};

const statusOptions = [
  { value: "", label: "همه وضعیت‌ها" },
  { value: "active", label: "فعال" },
  { value: "draft", label: "پیش‌نویس" },
  { value: "inactive", label: "غیرفعال" },
];

const validStatuses = new Set(["draft", "active", "inactive"]);

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const search =
    typeof params.search === "string" ? params.search.trim() : undefined;
  const statusParam =
    typeof params.status === "string" ? params.status : undefined;
  const status =
    statusParam && validStatuses.has(statusParam)
      ? (statusParam as ProductStatus)
      : undefined;
  const categoryId =
    typeof params.categoryId === "string" && params.categoryId.trim().length > 0
      ? params.categoryId.trim()
      : undefined;

  const [{ items, pagination }, categories] = await Promise.all([
    getAdminProductList({
      page,
      pageSize: 20,
      search: search || undefined,
      status,
      categoryId,
    }),
    getAdminCategorySimpleList(),
  ]);

  function buildUrl(overrides: Record<string, string | undefined>) {
    const query = new URLSearchParams();
    const merged = {
      search: search ?? "",
      status: statusParam ?? "",
      categoryId: categoryId ?? "",
      page: String(page),
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) query.set(key, value);
    }
    return `/admin/catalog/products?${query.toString()}`;
  }

  const hasFilters = Boolean(search || statusParam || categoryId);

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5">
      <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
        <AdminPageHeader
          title="کالاهای مرجع کاتالوگ"
          description="کالاهای استاندارد Marketplace را تعریف کنید؛ قیمت‌گذاری و موجودی در لایه پیشنهاد تأمین‌کننده (SupplierOffer) مدیریت می‌شود."
          meta={`${formatPersianNumber(pagination.total)} کالا`}
        />
      </div>

      <ProductCreateForm categories={categories} />

      <div className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_14rem_auto] md:items-end">
          <div className="min-w-0">
            <label
              htmlFor="product-search"
              className="mb-1.5 block text-xs font-bold text-ink-muted"
            >
              جستجو
            </label>
            <div className="relative">
              <IconSearch
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
                aria-hidden="true"
              />
              <input
                id="product-search"
                name="search"
                type="search"
                defaultValue={search ?? ""}
                placeholder="نام، برند، کد کالا (SKU) یا بارکد"
                className="h-11 w-full rounded-control border border-line bg-surface ps-10 pe-3 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="product-status"
              className="mb-1.5 block text-xs font-bold text-ink-muted"
            >
              وضعیت انتشار
            </label>
            <select
              id="product-status"
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
          <div>
            <label
              htmlFor="product-cat-filter"
              className="mb-1.5 block text-xs font-bold text-ink-muted"
            >
              دسته‌بندی
            </label>
            <select
              id="product-cat-filter"
              name="categoryId"
              defaultValue={categoryId ?? ""}
              className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary"
            >
              <option value="">همه دسته‌بندی‌ها</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
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
                href="/admin/catalog/products"
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
          <AdminEmptyState
            title="هیچ کالایی یافت نشد"
            description="می‌توانید با استفاده از فرم بالا نخستین کالای مرجع کاتالوگ را اضافه کنید."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] border-collapse text-start text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-subtle text-xs font-bold text-ink-muted">
                  <th className="px-5 py-3.5 text-start">نام کالا</th>
                  <th className="px-5 py-3.5 text-start">نامک (Slug)</th>
                  <th className="px-5 py-3.5 text-start">دسته‌بندی</th>
                  <th className="px-5 py-3.5 text-start">برند / واحد</th>
                  <th className="px-5 py-3.5 text-start">کد کالا (SKU)</th>
                  <th className="px-5 py-3.5 text-start">وضعیت انتشار</th>
                  <th className="px-5 py-3.5 text-start">تاریخ ایجاد</th>
                  <th className="px-5 py-3.5 text-center">تغییر وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((prod) => (
                  <tr
                    key={prod.id}
                    className="transition hover:bg-surface-subtle/50"
                  >
                    <td className="px-5 py-4 font-black text-ink">
                      <div className="flex items-center gap-2">
                        <IconPackage className="size-4 text-ink-muted" />
                        <span>{prod.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-ink-muted" dir="ltr">
                      {prod.slug}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-control bg-surface-subtle px-2 py-0.5 text-xs font-medium text-ink">
                        {prod.categoryName || "نامشخص"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-ink-muted">
                      {prod.brand ? `${prod.brand} / ` : ""}
                      {prod.unit}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-ink-muted" dir="ltr">
                      {prod.sku || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          prod.status === "active"
                            ? "bg-success-soft text-success"
                            : prod.status === "draft"
                              ? "bg-warning-soft text-warning"
                              : "bg-danger-soft text-danger"
                        }`}
                      >
                        {prod.status === "active"
                          ? "فعال"
                          : prod.status === "draft"
                            ? "پیش‌نویس"
                            : "غیرفعال"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-ink-muted">
                      {formatPersianDate(prod.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <ProductStatusSelector product={prod} />
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
        entityLabel="کالا"
        previousHref={buildUrl({ page: String(pagination.page - 1) })}
        nextHref={buildUrl({ page: String(pagination.page + 1) })}
      />
    </section>
  );
}
