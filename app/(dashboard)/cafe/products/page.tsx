import type { Metadata } from "next";
import Link from "next/link";
import {
  IconBuildingStore,
  IconCoins,
  IconPackage,
  IconScale,
} from "@tabler/icons-react";

import { CatalogFilters } from "@/app/(dashboard)/cafe/products/catalog-filters";
import {
  formatPersianNumber,
  formatToman,
} from "@/src/lib/persian-format";
import { getBuyerCatalog } from "@/src/services/cafe-catalog-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "کاتالوگ محصولات Marketplace | پنل کافه",
};

type Props = {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    categoryId?: string;
    sort?: string;
  }>;
};

export default async function CafeProductsPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;

  const catalogResult = await getBuyerCatalog(resolvedParams).catch(
    (err: unknown) => {
      return {
        error:
          err instanceof Error
            ? err.message
            : "خطایی در بارگذاری کاتالوگ رخ داد.",
        items: [],
        total: 0,
        page: 1,
        pageSize: 24,
        totalPages: 0,
        availableCategories: [],
      };
    },
  );

  const hasError = "error" in catalogResult && Boolean(catalogResult.error);
  const items = catalogResult.items ?? [];
  const total = catalogResult.total ?? 0;
  const page = catalogResult.page ?? 1;
  const totalPages = catalogResult.totalPages ?? 0;
  const categories = catalogResult.availableCategories ?? [];

  // Helper for pagination links
  function buildPageUrl(targetPage: number) {
    const params = new URLSearchParams();
    if (targetPage > 1) params.set("page", targetPage.toString());
    if (resolvedParams.search) params.set("search", resolvedParams.search);
    if (resolvedParams.categoryId)
      params.set("categoryId", resolvedParams.categoryId);
    if (resolvedParams.sort && resolvedParams.sort !== "newest")
      params.set("sort", resolvedParams.sort);
    const qs = params.toString();
    return qs ? `/cafe/products?${qs}` : "/cafe/products";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-ink sm:text-2xl">
            کاتالوگ محصولات Marketplace
          </h1>
          <p className="mt-1 text-xs text-ink-muted sm:text-sm">
            کالاهای دارای پیشنهاد فعال از سوی تأمین‌کنندگان را مشاهده کرده و برای
            دریافت بهترین شرایط، قیمت‌ها را مقایسه کنید.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
          <IconPackage className="size-4" />
          <span>
            {formatPersianNumber(total)} کالای دارای عرضه فعال
          </span>
        </div>
      </div>

      {/* Error alert */}
      {hasError && (
        <div className="rounded-card border border-danger/30 bg-danger-soft p-4 text-xs font-bold text-danger">
          {"error" in catalogResult && catalogResult.error}
        </div>
      )}

      {/* Filters & Search */}
      <CatalogFilters
        categories={categories}
        currentSearch={resolvedParams.search}
        currentCategory={resolvedParams.categoryId}
        currentSort={resolvedParams.sort ?? "newest"}
      />

      {/* Product List or Empty State */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-card border border-line bg-surface p-12 text-center shadow-card">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <IconPackage className="size-7" />
          </div>
          <h3 className="mt-4 text-base font-bold text-ink">
            {resolvedParams.search || resolvedParams.categoryId
              ? "هیچ محصولی با مشخصات جستجوشده یافت نشد"
              : "هنوز محصولی با عرضه معتبر در این بخش ثبت نشده است"}
          </h3>
          <p className="mt-1.5 max-w-md text-xs text-ink-muted">
            {resolvedParams.search || resolvedParams.categoryId
              ? "می‌توانید فیلترها را تغییر داده یا عبارت جستجوی دیگری را امتحان کنید."
              : "به محض اینکه تأمین‌کنندگان واجد شرایط برای کالاهای کاتالوگ پیشنهاد ثبت کنند، در این بخش نمایش داده می‌شوند."}
          </p>
          {(resolvedParams.search || resolvedParams.categoryId) && (
            <Link
              href="/cafe/products"
              className="mt-4 inline-flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-hover"
            >
              مشاهده همه محصولات
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((product) => (
            <div
              key={product.id}
              className="group flex flex-col justify-between overflow-hidden rounded-card border border-line bg-surface shadow-card transition hover:border-primary/50 hover:shadow-card-hover"
            >
              <div>
                {/* Visual / Image box */}
                <div className="relative flex h-40 w-full items-center justify-center border-b border-line bg-surface-subtle p-4">
                  {product.imageUrl && product.imageUrl.startsWith("/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-ink-muted">
                      <div className="flex size-12 items-center justify-center rounded-full bg-surface shadow-xs">
                        <IconPackage className="size-6 text-primary" />
                      </div>
                      <span className="text-[11px] font-semibold">
                        {product.unit}
                      </span>
                    </div>
                  )}

                  {product.categoryName && (
                    <span className="absolute top-2.5 right-2.5 rounded-full bg-surface/90 px-2 py-0.5 text-[10px] font-bold text-ink-muted shadow-xs backdrop-blur-xs">
                      {product.categoryName}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="p-4">
                  {product.brand && (
                    <p className="text-[11px] font-bold text-primary">
                      {product.brand}
                    </p>
                  )}
                  <h2 className="mt-0.5 text-sm font-black text-ink line-clamp-2">
                    {product.name}
                  </h2>

                  <div className="mt-4 space-y-1.5 border-t border-line/70 pt-3 text-xs">
                    <div className="flex items-center justify-between text-ink-muted">
                      <span className="flex items-center gap-1">
                        <IconCoins className="size-3.5" />
                        <span>شروع قیمت از:</span>
                      </span>
                      <span className="font-black text-primary">
                        {formatToman(product.minPrice)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-ink-muted">
                      <span className="flex items-center gap-1">
                        <IconBuildingStore className="size-3.5" />
                        <span>تأمین‌کنندگان:</span>
                      </span>
                      <span className="font-bold text-ink">
                        {formatPersianNumber(product.supplierCount)} تأمین‌کننده
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-ink-muted">
                      <span>واحد سنجش:</span>
                      <span className="font-medium text-ink">
                        {product.unit}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action button */}
              <div className="p-4 pt-0">
                <Link
                  href={`/cafe/compare?productId=${product.id}`}
                  className="flex w-full items-center justify-center gap-1.5 rounded-control bg-primary px-3.5 py-2 text-xs font-black text-white transition hover:bg-primary-hover"
                >
                  <IconScale className="size-4" />
                  <span>مقایسه قیمت و شرایط</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center justify-between gap-3 rounded-card border border-line bg-surface p-4 text-xs sm:flex-row">
          <p className="text-ink-muted">
            صفحه {formatPersianNumber(page)} از{" "}
            {formatPersianNumber(totalPages)} — مجموع{" "}
            {formatPersianNumber(total)} کالا
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={buildPageUrl(page - 1)}
                className="inline-flex min-h-9 items-center rounded-control border border-line px-3.5 font-bold text-ink transition hover:border-primary hover:text-primary"
              >
                صفحه قبلی
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={buildPageUrl(page + 1)}
                className="inline-flex min-h-9 items-center rounded-control border border-line px-3.5 font-bold text-ink transition hover:border-primary hover:text-primary"
              >
                صفحه بعدی
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
