"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { IconFilter, IconSearch, IconSortAscending } from "@tabler/icons-react";

import type { BuyerCatalogCategoryDTO } from "@/src/repositories/cafe-catalog-repository";

export function CatalogFilters({
  categories,
  currentSearch = "",
  currentCategory = "",
  currentSort = "newest",
}: {
  categories: BuyerCatalogCategoryDTO[];
  currentSearch?: string;
  currentCategory?: string;
  currentSort?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateQuery(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    // Any filter or search change resets page to 1
    if ("search" in updates || "categoryId" in updates || "sort" in updates) {
      params.delete("page");
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const search = formData.get("search")?.toString().trim() ?? "";
    updateQuery({ search });
  }

  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Search form */}
        <form
          onSubmit={handleSearchSubmit}
          className="relative flex flex-1 items-center"
        >
          <IconSearch className="pointer-events-none absolute right-3 size-4 text-ink-muted" />
          <input
            name="search"
            defaultValue={currentSearch}
            placeholder="جستجوی نام کالا یا برند..."
            className="h-10 w-full rounded-control border border-line bg-surface pr-9 pl-20 text-xs text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={isPending}
            className="absolute left-1.5 rounded-control bg-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary-hover disabled:opacity-50"
          >
            {isPending ? "..." : "جستجو"}
          </button>
        </form>

        {/* Filters and Sorting */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Dropdown */}
          <div className="relative flex items-center">
            <IconFilter className="pointer-events-none absolute right-2.5 size-3.5 text-ink-muted" />
            <select
              value={currentCategory}
              onChange={(e) => updateQuery({ categoryId: e.target.value })}
              className="h-10 rounded-control border border-line bg-surface pr-8 pl-3 text-xs text-ink focus:border-primary focus:outline-none"
            >
              <option value="">همه دسته‌بندی‌ها</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="relative flex items-center">
            <IconSortAscending className="pointer-events-none absolute right-2.5 size-3.5 text-ink-muted" />
            <select
              value={currentSort}
              onChange={(e) => updateQuery({ sort: e.target.value })}
              className="h-10 rounded-control border border-line bg-surface pr-8 pl-3 text-xs text-ink focus:border-primary focus:outline-none"
            >
              <option value="newest">جدیدترین محصولات</option>
              <option value="price_asc">کمترین قیمت (صعودی)</option>
              <option value="price_desc">بیشترین قیمت (نزولی)</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(currentSearch || currentCategory || currentSort !== "newest") && (
            <button
              type="button"
              onClick={() =>
                updateQuery({
                  search: null,
                  categoryId: null,
                  sort: null,
                })
              }
              className="h-10 rounded-control border border-line px-3 text-xs font-bold text-ink-muted transition hover:border-danger hover:text-danger"
            >
              پاکسازی فیلترها
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
