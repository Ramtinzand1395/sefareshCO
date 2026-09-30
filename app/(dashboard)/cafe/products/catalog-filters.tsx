"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  IconFilter,
  IconSearch,
  IconSortAscending,
  IconX,
} from "@tabler/icons-react";

import {
  BUYER_CATALOG_SEARCH_MAX_LENGTH,
  type BuyerCatalogSort,
} from "@/src/domain/schemas/cafe-catalog";
import type { BuyerCatalogCategoryDTO } from "@/src/repositories/cafe-catalog-repository";

const sortLabels: Record<BuyerCatalogSort, string> = {
  newest: "جدیدترین کالاها",
  price_asc: "کمترین قیمت",
  price_desc: "بیشترین قیمت",
};

export function CatalogFilters({
  categories,
  currentSearch = "",
  currentCategory = "",
  currentSort = "newest",
}: {
  categories: BuyerCatalogCategoryDTO[];
  currentSearch?: string;
  currentCategory?: string;
  currentSort?: BuyerCatalogSort;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchDraft, setSearchDraft] = useState(currentSearch);

  const selectedCategory = categories.find(
    (category) => category.id === currentCategory,
  );
  const hasFilters = Boolean(
    currentSearch || currentCategory || currentSort !== "newest",
  );

  function updateQuery(updates: Record<string, string | null>) {
    if (isPending) return;

    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    if ("search" in updates || "categoryId" in updates || "sort" in updates) {
      params.delete("page");
    }

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateQuery({ search: searchDraft.trim() });
  }

  function clearAllFilters() {
    setSearchDraft("");
    updateQuery({ search: null, categoryId: null, sort: null });
  }

  return (
    <section
      aria-label="جستجو و فیلتر کالاها"
      aria-busy={isPending}
      className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(18rem,1fr)_auto] xl:items-end">
        <form onSubmit={handleSearchSubmit} className="min-w-0">
          <label
            htmlFor="catalog-search"
            className="mb-1.5 block text-xs font-bold text-ink-muted"
          >
            جستجوی کالا یا برند
          </label>
          <div className="relative flex min-w-0 items-center">
            <IconSearch
              className="pointer-events-none absolute start-3 size-4 text-ink-muted"
              aria-hidden="true"
            />
            <input
              id="catalog-search"
              name="search"
              type="search"
              maxLength={BUYER_CATALOG_SEARCH_MAX_LENGTH}
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              disabled={isPending}
              placeholder="مثلاً قهوه عربیکا یا نام برند"
              className="h-11 min-w-0 flex-1 rounded-s-control border border-line bg-surface ps-10 pe-3 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-primary disabled:cursor-wait disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isPending}
              className="h-11 shrink-0 rounded-e-control bg-primary px-4 text-sm font-black text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
            >
              جستجو
            </button>
          </div>
        </form>

        <div className="grid gap-3 sm:grid-cols-2 xl:flex xl:items-end">
          <div className="min-w-0">
            <label htmlFor="catalog-category" className="mb-1.5 block text-xs font-bold text-ink-muted">
              دسته‌بندی
            </label>
            <div className="relative">
              <IconFilter className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <select
                id="catalog-category"
                value={currentCategory}
                disabled={isPending}
                onChange={(event) => updateQuery({ categoryId: event.target.value })}
                className="h-11 w-full min-w-0 rounded-control border border-line bg-surface ps-10 pe-3 text-sm text-ink outline-none transition focus:border-primary disabled:cursor-wait disabled:opacity-60 xl:w-52"
              >
                <option value="">همه دسته‌بندی‌ها</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="min-w-0">
            <label htmlFor="catalog-sort" className="mb-1.5 block text-xs font-bold text-ink-muted">
              مرتب‌سازی
            </label>
            <div className="relative">
              <IconSortAscending className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <select
                id="catalog-sort"
                value={currentSort}
                disabled={isPending}
                onChange={(event) => updateQuery({ sort: event.target.value })}
                className="h-11 w-full min-w-0 rounded-control border border-line bg-surface ps-10 pe-3 text-sm text-ink outline-none transition focus:border-primary disabled:cursor-wait disabled:opacity-60 xl:w-48"
              >
                <option value="newest">جدیدترین کالاها</option>
                <option value="price_asc">کمترین قیمت</option>
                <option value="price_desc">بیشترین قیمت</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex min-h-7 flex-wrap items-center gap-2 border-t border-line/70 pt-3">
        <span className="text-xs font-bold text-ink-muted">فیلترهای فعال:</span>
        {!hasFilters ? (
          <span className="text-xs text-ink-muted">بدون فیلتر</span>
        ) : (
          <>
            {currentSearch ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setSearchDraft("");
                  updateQuery({ search: null });
                }}
                className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-full bg-primary-soft px-2.5 text-xs font-bold text-primary disabled:opacity-60"
                aria-label={`پاک کردن جستجوی ${currentSearch}`}
              >
                <span className="max-w-48 truncate">جستجو: {currentSearch}</span>
                <IconX className="size-3.5 shrink-0" aria-hidden="true" />
              </button>
            ) : null}
            {selectedCategory ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => updateQuery({ categoryId: null })}
                className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-full bg-primary-soft px-2.5 text-xs font-bold text-primary disabled:opacity-60"
                aria-label={`پاک کردن دسته‌بندی ${selectedCategory.name}`}
              >
                <span className="max-w-48 truncate">{selectedCategory.name}</span>
                <IconX className="size-3.5 shrink-0" aria-hidden="true" />
              </button>
            ) : null}
            {currentSort !== "newest" ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => updateQuery({ sort: null })}
                className="inline-flex min-h-8 items-center gap-1 rounded-full bg-primary-soft px-2.5 text-xs font-bold text-primary disabled:opacity-60"
                aria-label={`پاک کردن مرتب‌سازی ${sortLabels[currentSort]}`}
              >
                {sortLabels[currentSort]}
                <IconX className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              disabled={isPending}
              onClick={clearAllFilters}
              className="min-h-8 rounded-control px-2.5 text-xs font-black text-danger transition hover:bg-danger-soft disabled:opacity-60"
            >
              پاک‌سازی همه
            </button>
          </>
        )}
      </div>

      <p className="sr-only" aria-live="polite" role="status">
        {isPending ? "در حال به‌روزرسانی نتایج کاتالوگ" : ""}
      </p>
    </section>
  );
}
