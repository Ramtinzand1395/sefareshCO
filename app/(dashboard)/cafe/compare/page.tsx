import type { Metadata } from "next";
import Link from "next/link";
import {
  IconAlertCircle,
  IconArrowRight,
  IconBuildingStore,
  IconCheck,
  IconCoins,
  IconPackage,
  IconScale,
  IconX,
} from "@tabler/icons-react";

import { CompareControls } from "@/app/(dashboard)/cafe/compare/compare-controls";
import {
  formatPersianDate,
  formatPersianNumber,
  formatToman,
} from "@/src/lib/persian-format";
import { getBuyerProductComparison } from "@/src/services/cafe-catalog-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "مقایسه قیمت و شرایط تأمین‌کنندگان | پنل کافه",
};

type Props = {
  searchParams: Promise<{
    productId?: string;
    quantity?: string;
    sortBy?: string;
  }>;
};

export default async function CafeComparePage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const productId = resolvedParams.productId?.trim();

  // If no productId is provided, show the product selection prompt
  if (!productId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-black text-ink sm:text-2xl">
            مقایسه قیمت و شرایط تأمین‌کنندگان
          </h1>
          <p className="mt-1 text-xs text-ink-muted sm:text-sm">
            پیشنهادهای قیمت، موجودی، حداقل سفارش و زمان تحویل تأمین‌کنندگان را
            برای یک کالای مشخص مقایسه کنید.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-card border border-line bg-surface p-12 text-center shadow-card">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <IconScale className="size-7" />
          </div>
          <h2 className="mt-4 text-base font-bold text-ink">
            کالایی برای مقایسه انتخاب نشده است
          </h2>
          <p className="mt-1.5 max-w-md text-xs text-ink-muted">
            جهت مشاهده و مقایسهٔ پیشنهادهای رقابتی تأمین‌کنندگان، لطفاً ابتدا کالای
            مورد نظر خود را از کاتالوگ محصولات انتخاب فرمایید.
          </p>
          <Link
            href="/cafe/products"
            className="mt-5 inline-flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-hover"
          >
            <IconPackage className="size-4" />
            <span>مشاهده کاتالوگ محصولات</span>
          </Link>
        </div>
      </div>
    );
  }

  // Fetch comparison data from service
  const comparisonResult = await getBuyerProductComparison(
    productId,
    resolvedParams.quantity,
    resolvedParams.sortBy,
  ).catch((err: unknown) => {
    return {
      state: "error" as const,
      message:
        err instanceof Error
          ? err.message
          : "خطایی در دریافت اطلاعات مقایسه رخ داد.",
    };
  });

  // Handle service error
  if ("state" in comparisonResult && comparisonResult.state === "error") {
    return (
      <div className="space-y-6">
        <div className="rounded-card border border-danger/30 bg-danger-soft p-6 text-center text-xs font-bold text-danger">
          {"message" in comparisonResult && comparisonResult.message}
          <div className="mt-4">
            <Link
              href="/cafe/products"
              className="inline-flex items-center gap-1 text-xs font-bold text-ink underline"
            >
              <IconArrowRight className="size-3.5" />
              <span>بازگشت به کاتالوگ</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Product not found, inactive, or category branch inactive
  if (comparisonResult.state === "not_found_or_inactive") {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center rounded-card border border-amber-200 bg-amber-50 p-12 text-center text-amber-900 shadow-card">
          <IconAlertCircle className="size-10 text-amber-600" />
          <h2 className="mt-3 text-base font-black">
            محصول انتخاب‌شده غیرفعال است
          </h2>
          <p className="mt-1 max-w-md text-xs text-amber-700">
            این محصول در کاتالوگ فعال نیست یا دسته‌بندی آن غیرفعال شده است و
            امکان مقایسه قیمت‌های آن وجود ندارد.
          </p>
          <Link
            href="/cafe/products"
            className="mt-4 inline-flex items-center gap-1.5 rounded-control bg-amber-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-700"
          >
            <span>بازگشت به کاتالوگ محصولات</span>
          </Link>
        </div>
      </div>
    );
  }

  const {
    product,
    offers,
    quantity,
    sortBy,
    fulfillableCount,
    totalOffersCount,
  } = comparisonResult;

  return (
    <div className="space-y-6">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/cafe/products"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-muted transition hover:text-primary"
        >
          <IconArrowRight className="size-4" />
          <span>بازگشت به کاتالوگ کالاها</span>
        </Link>
        <span className="rounded-full bg-surface-subtle px-3 py-1 text-xs font-bold text-ink-muted">
          مقایسه قیمت کالا
        </span>
      </div>

      {/* Product Overview Card */}
      <div className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            {product.brand && (
              <span className="text-xs font-bold text-primary">
                {product.brand}
              </span>
            )}
            <h1 className="text-lg font-black text-ink sm:text-xl">
              {product.name}
            </h1>
            {product.categoryName && (
              <p className="text-xs text-ink-muted">
                دسته‌بندی:{" "}
                <span className="font-bold text-ink">
                  {product.categoryName}
                </span>
              </p>
            )}
            {product.description && (
              <p className="mt-2 text-xs text-ink-muted sm:text-sm">
                {product.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 self-start rounded-control bg-surface-subtle px-3.5 py-2 text-xs font-bold text-ink">
            <span>واحد سنجش کالا:</span>
            <span className="font-black text-primary">{product.unit}</span>
          </div>
        </div>
      </div>

      {/* Compare Interactive Controls */}
      <CompareControls
        currentQuantity={quantity}
        currentSortBy={sortBy}
        productUnit={product.unit}
      />

      {/* No Offers State */}
      {offers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-card border border-line bg-surface p-10 text-center shadow-card">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <IconPackage className="size-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-ink">
            هیچ عرضه معتبری برای این محصول ثبت نشده است
          </h3>
          <p className="mt-1 text-xs text-ink-muted">
            تأمین‌کنندگان هنوز پیشنهادی برای این کالا ثبت نکرده‌اند یا موجودی آن‌ها به
            اتمام رسیده است.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Fulfillability Summary Banner */}
          <div className="flex flex-col gap-2 rounded-control border border-primary/20 bg-primary/5 p-4 text-xs font-bold text-primary sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <IconCoins className="size-4 shrink-0" />
              <span>
                {formatPersianNumber(fulfillableCount)} پیشنهاد از مجموع{" "}
                {formatPersianNumber(totalOffersCount)} پیشنهاد، قابلیت تأمین{" "}
                {formatPersianNumber(quantity)} {product.unit} را دارند.
              </span>
            </div>
            <span className="text-[11px] text-ink-muted">
              پیشنهادهای قابل تأمین در ابتدای فهرست قرار دارند.
            </span>
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-card md:block">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-line bg-surface-subtle text-[11px] font-black text-ink-muted">
                <tr>
                  <th className="px-4 py-3">نام تأمین‌کننده</th>
                  <th className="px-4 py-3">قیمت واحد</th>
                  <th className="px-4 py-3">وضعیت برای {quantity} {product.unit}</th>
                  <th className="px-4 py-3">مبلغ کالا</th>
                  <th className="px-4 py-3">موجودی انبار</th>
                  <th className="px-4 py-3">حداقل سفارش (MOQ)</th>
                  <th className="px-4 py-3">زمان تحویل</th>
                  <th className="px-4 py-3">آخرین به‌روزرسانی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {offers.map((offer) => (
                  <tr
                    key={offer.offerId}
                    className={`transition hover:bg-surface-subtle/50 ${
                      !offer.isFulfillable ? "opacity-60 bg-surface-subtle/20" : ""
                    }`}
                  >
                    {/* Supplier Business Name */}
                    <td className="px-4 py-3 font-bold text-ink">
                      <div className="flex items-center gap-1.5">
                        <IconBuildingStore className="size-4 text-primary shrink-0" />
                        <span>{offer.supplierBusinessName}</span>
                      </div>
                    </td>

                    {/* Unit Price */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-black text-primary">
                          {formatToman(offer.price)}
                        </span>
                        <span className="text-[10px] text-ink-muted">
                          به ازای هر {offer.productUnit}
                        </span>
                        {offer.isLowestPrice && (
                          <span className="inline-flex w-fit items-center rounded-sm bg-success/15 px-1.5 py-0.5 text-[10px] font-black text-success">
                            کمترین قیمت
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Fulfillability */}
                    <td className="px-4 py-3">
                      {offer.isFulfillable ? (
                        <span className="inline-flex items-center gap-1 rounded-control bg-success-soft px-2 py-1 text-[11px] font-bold text-success">
                          <IconCheck className="size-3.5" />
                          <span>قابل تأمین</span>
                        </span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex w-fit items-center gap-1 rounded-control bg-danger-soft px-2 py-0.5 text-[10px] font-bold text-danger">
                            <IconX className="size-3" />
                            <span>غیرقابل تأمین</span>
                          </span>
                          <span className="text-[10px] text-danger">
                            {offer.unfulfillableReason}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Total Item Amount */}
                    <td className="px-4 py-3 font-black text-ink">
                      {offer.isFulfillable ? (
                        <div>
                          <span>{formatToman(offer.itemTotal)}</span>
                          <span className="block text-[10px] font-normal text-ink-muted">
                            (مبلغ کالا)
                          </span>
                        </div>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>

                    {/* Stock */}
                    <td className="px-4 py-3 font-bold text-ink">
                      {formatPersianNumber(offer.stock)} {offer.productUnit}
                    </td>

                    {/* MOQ */}
                    <td className="px-4 py-3 text-ink-muted">
                      {formatPersianNumber(offer.minOrderQuantity)}{" "}
                      {offer.productUnit}
                    </td>

                    {/* Delivery Days */}
                    <td className="px-4 py-3 text-ink">
                      {offer.deliveryDays === 0
                        ? "تحویل همان روز"
                        : `${formatPersianNumber(offer.deliveryDays)} روز کاری`}
                    </td>

                    {/* Updated At */}
                    <td className="px-4 py-3 text-ink-muted">
                      {formatPersianDate(offer.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="space-y-3 md:hidden">
            {offers.map((offer) => (
              <div
                key={offer.offerId}
                className={`rounded-card border border-line bg-surface p-4 shadow-card ${
                  !offer.isFulfillable ? "opacity-75" : ""
                }`}
              >
                <div className="flex items-center justify-between border-b border-line pb-2.5">
                  <div className="flex items-center gap-1.5 font-black text-ink">
                    <IconBuildingStore className="size-4 text-primary" />
                    <span>{offer.supplierBusinessName}</span>
                  </div>
                  {offer.isLowestPrice && (
                    <span className="rounded-sm bg-success/15 px-2 py-0.5 text-[10px] font-black text-success">
                      کمترین قیمت
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-ink-muted">قیمت هر واحد:</span>
                    <span className="font-black text-primary">
                      {formatToman(offer.price)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-ink-muted">
                      مبلغ برای {formatPersianNumber(quantity)} {offer.productUnit}:
                    </span>
                    {offer.isFulfillable ? (
                      <span className="font-black text-ink">
                        {formatToman(offer.itemTotal)}{" "}
                        <span className="text-[10px] font-normal text-ink-muted">
                          (مبلغ کالا)
                        </span>
                      </span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </div>

                  <div className="flex justify-between">
                    <span className="text-ink-muted">وضعیت تأمین:</span>
                    {offer.isFulfillable ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success">
                        <IconCheck className="size-3" />
                        <span>قابل تأمین</span>
                      </span>
                    ) : (
                      <span className="text-left text-[11px] font-bold text-danger">
                        {offer.unfulfillableReason}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between text-ink-muted">
                    <span>موجودی انبار:</span>
                    <span className="font-bold text-ink">
                      {formatPersianNumber(offer.stock)} {offer.productUnit}
                    </span>
                  </div>

                  <div className="flex justify-between text-ink-muted">
                    <span>حداقل سفارش (MOQ):</span>
                    <span className="font-bold text-ink">
                      {formatPersianNumber(offer.minOrderQuantity)}{" "}
                      {offer.productUnit}
                    </span>
                  </div>

                  <div className="flex justify-between text-ink-muted">
                    <span>زمان تحویل:</span>
                    <span className="font-bold text-ink">
                      {offer.deliveryDays === 0
                        ? "تحویل همان روز"
                        : `${formatPersianNumber(offer.deliveryDays)} روز کاری`}
                    </span>
                  </div>

                  <div className="flex justify-between border-t border-line/60 pt-2 text-[10px] text-ink-muted">
                    <span>آخرین به‌روزرسانی:</span>
                    <span>{formatPersianDate(offer.updatedAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Commercial Notice Box */}
          <div className="rounded-control border border-line bg-surface p-4 text-[11px] text-ink-muted">
            <p className="font-bold text-ink">نکات تجاری مهم:</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>
                مبالغ نمایش‌داده‌شده صرفاً «مبلغ کالا» بوده و شامل مالیات، هزینه‌های
                ارسال یا تخفیف‌های احتمالی نیست.
              </li>
              <li>
                در این بخش صرفاً مقایسه پیشنهادها انجام می‌شود و هیچ خریدی ثبت
                نمی‌گردد.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
