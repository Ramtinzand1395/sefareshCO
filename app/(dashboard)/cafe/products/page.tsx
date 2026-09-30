import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  IconBuildingStore,
  IconCoins,
  IconPackage,
  IconScale,
} from "@tabler/icons-react";

import { CatalogFilters } from "@/app/(dashboard)/cafe/products/catalog-filters";
import {
  normalizeBuyerCatalogSearchParams,
  type QueryParamValue,
} from "@/src/domain/schemas/cafe-catalog";
import { formatPersianNumber, formatToman } from "@/src/lib/persian-format";
import { getBuyerCatalog } from "@/src/services/cafe-catalog-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "کاتالوگ کالاها | پنل کافه",
};

type Props = {
  searchParams: Promise<Record<string, QueryParamValue>>;
};

function isLocalImagePath(value?: string) {
  return Boolean(value?.startsWith("/") && !value.startsWith("//"));
}

export default async function CafeProductsPage({ searchParams }: Props) {
  const query = normalizeBuyerCatalogSearchParams(await searchParams);
  const catalogResult = await getBuyerCatalog(query);
  const { items, total, page, pageSize, totalPages, availableCategories } =
    catalogResult;
  const hasFilters = Boolean(
    query.search || query.categoryId || query.sort !== "newest",
  );
  const isOutOfRange = totalPages > 0 && page > totalPages;

  function buildPageUrl(targetPage: number) {
    const params = new URLSearchParams();
    if (targetPage > 1) params.set("page", targetPage.toString());
    if (pageSize !== 24) params.set("pageSize", pageSize.toString());
    if (query.search) params.set("search", query.search);
    if (query.categoryId) params.set("categoryId", query.categoryId);
    if (query.sort !== "newest") params.set("sort", query.sort);
    const search = params.toString();
    return search ? `/cafe/products?${search}` : "/cafe/products";
  }

  return (
    <div className="cafe-content-container space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">
            کاتالوگ کالاها
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-muted">
            کالای موردنیاز را پیدا کنید و قیمت و شرایط واقعی تأمین‌کنندگان را کنار
            هم ببینید.
          </p>
        </div>
        <div className="inline-flex min-h-10 items-center gap-2 self-start rounded-full bg-primary-soft px-3.5 text-xs font-black text-primary sm:self-auto">
          <IconPackage className="size-4" aria-hidden="true" />
          <span>
            {formatPersianNumber(total)} {hasFilters ? "نتیجه در فیلتر فعلی" : "کالای قابل مقایسه"}
          </span>
        </div>
      </header>

      <CatalogFilters
        key={`${query.search ?? ""}:${query.categoryId ?? ""}:${query.sort}`}
        categories={availableCategories}
        currentSearch={query.search}
        currentCategory={query.categoryId}
        currentSort={query.sort}
      />

      <section id="catalog-results" aria-labelledby="catalog-results-heading" aria-live="polite">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="catalog-results-heading" className="text-base font-black text-ink">
              نتایج کاتالوگ
            </h2>
            <p className="mt-1 text-xs leading-6 text-ink-muted">
              {hasFilters
                ? `نمایش ${formatPersianNumber(items.length)} کالا از ${formatPersianNumber(total)} نتیجهٔ فیلترشده`
                : `نمایش ${formatPersianNumber(items.length)} کالا از ${formatPersianNumber(total)} کالای قابل مقایسه`}
            </p>
          </div>
          {totalPages > 0 ? (
            <span className="text-xs font-bold text-ink-muted">
              صفحه {formatPersianNumber(Math.min(page, totalPages))} از {formatPersianNumber(totalPages)}
            </span>
          ) : null}
        </div>

        {isOutOfRange ? (
          <div className="flex flex-col items-center justify-center rounded-card border border-line bg-surface p-8 text-center shadow-card sm:p-12">
            <div className="grid size-14 place-items-center rounded-full bg-warning-soft text-warning">
              <IconPackage className="size-7" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-base font-black text-ink">این صفحه از نتایج وجود ندارد</h3>
            <p className="mt-2 max-w-md text-xs leading-6 text-ink-muted">
              ممکن است تعداد نتایج تغییر کرده باشد. می‌توانید به اولین صفحهٔ همین فیلترها برگردید.
            </p>
            <Link href={buildPageUrl(1)} className="mt-5 inline-flex min-h-11 items-center rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover">
              بازگشت به صفحه اول
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-card border border-line bg-surface p-8 text-center shadow-card sm:p-12">
            <div className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
              <IconPackage className="size-7" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-base font-black text-ink">
              {hasFilters
                ? "نتیجه‌ای برای این فیلترها پیدا نشد"
                : "هنوز کالای قابل مقایسه‌ای در کاتالوگ نیست"}
            </h3>
            <p className="mt-2 max-w-md text-xs leading-6 text-ink-muted">
              {hasFilters
                ? "فیلترها را پاک کنید یا عبارت جستجوی دیگری وارد کنید."
                : "پس از ثبت عرضهٔ معتبر توسط تأمین‌کنندگان، کالاها در این بخش نمایش داده می‌شوند."}
            </p>
            {hasFilters ? (
              <Link href="/cafe/products" className="mt-5 inline-flex min-h-11 items-center rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover">
                پاک‌سازی فیلترها
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="cafe-catalog-grid grid gap-4">
            {items.map((product) => (
              <article key={product.id} className="group flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition hover:border-primary/45 hover:shadow-card-hover">
                <div className="relative h-40 border-b border-line bg-surface-subtle p-4">
                  {isLocalImagePath(product.imageUrl) ? (
                    <Image
                      src={product.imageUrl!}
                      alt={product.name}
                      fill
                      sizes="(max-width: 520px) 100vw, (max-width: 1100px) 50vw, 25vw"
                      className="object-contain p-4"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-muted">
                      <div className="grid size-12 place-items-center rounded-full bg-surface shadow-xs">
                        <IconPackage className="size-6 text-primary" aria-hidden="true" />
                      </div>
                      <span className="text-xs font-bold">بدون تصویر</span>
                    </div>
                  )}
                  {product.categoryName ? (
                    <span className="absolute start-2.5 top-2.5 max-w-[calc(100%-1.25rem)] truncate rounded-full border border-line bg-surface/95 px-2.5 py-1 text-[11px] font-bold text-ink-muted shadow-xs">
                      {product.categoryName}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="min-h-16">
                    {product.brand ? (
                      <p className="truncate text-xs font-bold text-primary">{product.brand}</p>
                    ) : null}
                    <h3 className="mt-1 line-clamp-2 break-words text-base font-black leading-7 text-ink" title={product.name}>
                      {product.name}
                    </h3>
                  </div>

                  <dl className="mt-4 space-y-2.5 border-t border-line/70 pt-4 text-xs">
                    <div className="flex min-w-0 items-end justify-between gap-3">
                      <dt className="inline-flex items-center gap-1.5 text-ink-muted">
                        <IconCoins className="size-4 shrink-0" aria-hidden="true" />
                        شروع قیمت از
                      </dt>
                      <dd className="min-w-0 break-words text-end text-base font-black tabular-nums text-primary">
                        {formatToman(product.minPrice)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="inline-flex items-center gap-1.5 text-ink-muted">
                        <IconBuildingStore className="size-4 shrink-0" aria-hidden="true" />
                        تأمین‌کنندگان
                      </dt>
                      <dd className="font-bold text-ink">{formatPersianNumber(product.supplierCount)} تأمین‌کننده</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-ink-muted">واحد کالا</dt>
                      <dd className="font-bold text-ink">{product.unit}</dd>
                    </div>
                  </dl>

                  <Link
                    href={`/cafe/compare?productId=${product.id}`}
                    className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-black text-white transition hover:bg-primary-hover"
                  >
                    <IconScale className="size-4" aria-hidden="true" />
                    مقایسه قیمت و شرایط
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {!isOutOfRange && totalPages > 1 ? (
        <nav aria-label="صفحه‌بندی کاتالوگ" className="flex flex-col items-center justify-between gap-3 rounded-card border border-line bg-surface p-4 text-xs sm:flex-row">
          <p className="text-ink-muted">
            صفحه <span aria-current="page" className="font-black text-ink">{formatPersianNumber(page)}</span> از {formatPersianNumber(totalPages)} — مجموع {formatPersianNumber(total)} کالا
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            {page > 1 ? (
              <Link href={buildPageUrl(page - 1)} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-control border border-line px-4 font-bold text-ink transition hover:border-primary hover:text-primary sm:flex-none">
                صفحه قبلی
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link href={buildPageUrl(page + 1)} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-control border border-line px-4 font-bold text-ink transition hover:border-primary hover:text-primary sm:flex-none">
                صفحه بعدی
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
