import { IconCategory, IconSearch } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/app/(dashboard)/admin/_components/admin-page-header";
import { AdminPagination } from "@/app/(dashboard)/admin/_components/admin-pagination";
import { AdminEmptyState } from "@/app/(dashboard)/admin/_components/admin-ui";
import {
  CategoryCreateForm,
  CategoryStatusToggle,
} from "@/app/(dashboard)/admin/catalog/categories/category-forms";
import type { CategoryStatus } from "@/src/domain/schemas/admin-catalog";
import {
  formatPersianDate,
  formatPersianNumber,
} from "@/src/lib/persian-format";
import {
  getAdminCategoryList,
  getAdminCategorySimpleList,
} from "@/src/services/admin-category-service";

export const metadata: Metadata = {
  title: "دسته‌بندی‌های کاتالوگ — پنل مدیریت",
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

export default async function AdminCategoriesPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const search =
    typeof params.search === "string" ? params.search.trim() : undefined;
  const statusParam =
    typeof params.status === "string" ? params.status : undefined;
  const status =
    statusParam && validStatuses.has(statusParam)
      ? (statusParam as CategoryStatus)
      : undefined;

  const [{ items, pagination }, simpleCategories] = await Promise.all([
    getAdminCategoryList({
      page,
      pageSize: 20,
      search: search || undefined,
      status,
    }),
    getAdminCategorySimpleList(),
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
    return `/admin/catalog/categories?${query.toString()}`;
  }

  const hasFilters = Boolean(search || statusParam);

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5">
      <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
        <AdminPageHeader
          title="دسته‌بندی‌های کاتالوگ"
          description="ساختار دسته‌بندی و درخت کالاهای مرجع Marketplace را مدیریت کنید."
          meta={`${formatPersianNumber(pagination.total)} دسته‌بندی`}
        />
      </div>

      <CategoryCreateForm parentCategories={simpleCategories} />

      <div className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem_auto] md:items-end">
          <div className="min-w-0">
            <label
              htmlFor="category-search"
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
                id="category-search"
                name="search"
                type="search"
                defaultValue={search ?? ""}
                placeholder="نام، نامک (slug) یا توضیحات"
                className="h-11 w-full rounded-control border border-line bg-surface ps-10 pe-3 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="category-status"
              className="mb-1.5 block text-xs font-bold text-ink-muted"
            >
              وضعیت
            </label>
            <select
              id="category-status"
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
                href="/admin/catalog/categories"
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
            title="هیچ دسته‌بندی‌ای یافت نشد"
            description="می‌توانید با استفاده از فرم بالا نخستین دسته‌بندی کاتالوگ را اضافه کنید."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-start text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-subtle text-xs font-bold text-ink-muted">
                  <th className="px-5 py-3.5 text-start">نام دسته‌بندی</th>
                  <th className="px-5 py-3.5 text-start">نامک (Slug)</th>
                  <th className="px-5 py-3.5 text-start">دسته‌بندی والد</th>
                  <th className="px-5 py-3.5 text-start">محصولات</th>
                  <th className="px-5 py-3.5 text-start">زیردسته‌ها</th>
                  <th className="px-5 py-3.5 text-start">وضعیت</th>
                  <th className="px-5 py-3.5 text-start">تاریخ ایجاد</th>
                  <th className="px-5 py-3.5 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((cat) => (
                  <tr
                    key={cat.id}
                    className="transition hover:bg-surface-subtle/50"
                  >
                    <td className="px-5 py-4 font-black text-ink">
                      <div className="flex items-center gap-2">
                        <IconCategory className="size-4 text-ink-muted" />
                        <span>{cat.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-ink-muted" dir="ltr">
                      {cat.slug}
                    </td>
                    <td className="px-5 py-4 text-ink-muted">
                      {cat.parentName ? (
                        <span className="rounded-control bg-surface-subtle px-2 py-0.5 text-xs font-medium">
                          {cat.parentName}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-muted/60">— (اصلی)</span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-bold tabular-nums text-ink">
                      {formatPersianNumber(cat.productCount)}
                    </td>
                    <td className="px-5 py-4 font-bold tabular-nums text-ink">
                      {formatPersianNumber(cat.childrenCount)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          cat.status === "active"
                            ? "bg-success-soft text-success"
                            : "bg-danger-soft text-danger"
                        }`}
                      >
                        {cat.status === "active" ? "فعال" : "غیرفعال"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-ink-muted">
                      {formatPersianDate(cat.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <CategoryStatusToggle category={cat} />
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
        entityLabel="دسته‌بندی"
        previousHref={buildUrl({ page: String(pagination.page - 1) })}
        nextHref={buildUrl({ page: String(pagination.page + 1) })}
      />
    </section>
  );
}
