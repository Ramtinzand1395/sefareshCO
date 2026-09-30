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
  getSingleQueryParam,
  type QueryParamValue,
} from "@/src/domain/schemas/cafe-catalog";
import {
  formatPersianDate,
  formatPersianNumber,
  formatToman,
} from "@/src/lib/persian-format";
import {
  getBuyerProductComparison,
  type ProcessedComparisonOfferDTO,
} from "@/src/services/cafe-catalog-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "مقایسه قیمت و شرایط تأمین‌کنندگان | پنل کافه",
};

type Props = {
  searchParams: Promise<Record<string, QueryParamValue>>;
};

function formatDeliveryTime(days: number) {
  return days === 0
    ? "تحویل همان روز"
    : `${formatPersianNumber(days)} روز`;
}

function LowestPriceBadge() {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-black text-success">
      کمترین قیمت قابل تأمین
    </span>
  );
}

function FulfillmentStatus({
  offer,
  showReason = true,
}: {
  offer: ProcessedComparisonOfferDTO;
  showReason?: boolean;
}) {
  return (
    <div className="min-w-0">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ${
          offer.isFulfillable
            ? "bg-success-soft text-success"
            : "bg-danger-soft text-danger"
        }`}
      >
        {offer.isFulfillable ? (
          <IconCheck className="size-3.5" aria-hidden="true" />
        ) : (
          <IconX className="size-3.5" aria-hidden="true" />
        )}
        {offer.isFulfillable ? "قابل تأمین" : "غیرقابل تأمین"}
      </span>
      {!offer.isFulfillable && showReason && offer.unfulfillableReason ? (
        <p className="mt-1.5 max-w-64 break-words text-[11px] font-bold leading-5 text-danger">
          {offer.unfulfillableReason}
        </p>
      ) : null}
    </div>
  );
}

function PageIntro() {
  return (
    <header>
      <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">
        مقایسه قیمت و شرایط تأمین‌کنندگان
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-muted">
        مقدار موردنیاز را اعمال کنید تا قیمت، موجودی، حداقل سفارش و زمان تحویل
        عرضه‌ها با همان مقدار مقایسه شوند.
      </p>
    </header>
  );
}

export default async function CafeComparePage({ searchParams }: Props) {
  const rawParams = await searchParams;
  const productId = getSingleQueryParam(rawParams.productId)?.trim();

  if (!productId) {
    return (
      <div className="cafe-content-container space-y-6">
        <PageIntro />
        <div className="flex flex-col items-center justify-center rounded-card border border-line bg-surface p-8 text-center shadow-card sm:p-12">
          <div className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
            <IconScale className="size-7" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-base font-black text-ink">
            کالایی برای مقایسه انتخاب نشده است
          </h2>
          <p className="mt-2 max-w-md text-xs leading-6 text-ink-muted">
            ابتدا یک کالا را از کاتالوگ انتخاب کنید تا عرضه‌های همان کالا نمایش داده شوند.
          </p>
          <Link
            href="/cafe/products"
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover"
          >
            <IconPackage className="size-4" aria-hidden="true" />
            مشاهده کاتالوگ کالاها
          </Link>
        </div>
      </div>
    );
  }

  const comparisonResult = await getBuyerProductComparison(
    productId,
    rawParams.quantity,
    rawParams.sortBy,
  );

  if (comparisonResult.state === "not_found_or_inactive") {
    return (
      <div className="cafe-content-container space-y-6">
        <PageIntro />
        <div className="flex flex-col items-center justify-center rounded-card border border-warning/30 bg-warning-soft p-8 text-center shadow-card sm:p-12">
          <IconAlertCircle className="size-10 text-warning" aria-hidden="true" />
          <h2 className="mt-3 text-base font-black text-ink">
            این کالا برای مقایسه در دسترس نیست
          </h2>
          <p className="mt-2 max-w-md text-xs leading-6 text-ink-muted">
            اطلاعات کافی برای نمایش مقایسهٔ این کالا وجود ندارد. کالای دیگری را از کاتالوگ انتخاب کنید.
          </p>
          <Link
            href="/cafe/products"
            className="mt-5 inline-flex min-h-11 items-center rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover"
          >
            بازگشت به کاتالوگ
          </Link>
        </div>
      </div>
    );
  }

  const { product, sortBy } = comparisonResult;
  const hasValidQuantity = comparisonResult.state === "available";
  const quantity = hasValidQuantity ? comparisonResult.quantity : null;
  const quantityInput = hasValidQuantity
    ? String(comparisonResult.quantity)
    : comparisonResult.quantityInput;
  const quantityError = hasValidQuantity
    ? undefined
    : comparisonResult.quantityError;

  return (
    <div className="cafe-content-container space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/cafe/products"
          className="inline-flex min-h-10 items-center gap-1.5 text-xs font-bold text-ink-muted transition hover:text-primary"
        >
          <IconArrowRight className="size-4" aria-hidden="true" />
          بازگشت به کاتالوگ کالاها
        </Link>
        <span className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-bold text-primary">
          مقایسه عرضه‌ها
        </span>
      </div>

      <section aria-labelledby="comparison-product-title" className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black text-primary">کالای انتخاب‌شده</p>
            <h1 id="comparison-product-title" className="mt-1 break-words text-xl font-black leading-8 text-ink sm:text-2xl">
              {product.name}
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
              {product.brand ? <span>برند: <strong className="text-ink">{product.brand}</strong></span> : null}
              {product.categoryName ? <span>دسته‌بندی: <strong className="text-ink">{product.categoryName}</strong></span> : null}
            </div>
            {product.description ? (
              <p className="mt-3 max-w-3xl break-words text-xs leading-6 text-ink-muted sm:text-sm">
                {product.description}
              </p>
            ) : null}
          </div>
          <div className="inline-flex min-h-10 shrink-0 items-center gap-2 self-start rounded-control bg-surface-subtle px-3.5 text-xs font-bold text-ink-muted">
            واحد کالا
            <strong className="text-primary">{product.unit}</strong>
          </div>
        </div>
      </section>

      <CompareControls
        key={`${product.id}:${quantityInput}:${quantityError ?? ""}`}
        currentQuantity={quantity}
        quantityInput={quantityInput}
        quantityError={quantityError}
        currentSortBy={sortBy}
        productUnit={product.unit}
      />

      {!hasValidQuantity ? (
        <section className="rounded-card border border-danger/30 bg-danger-soft p-5" aria-live="polite">
          <div className="flex items-start gap-3">
            <IconAlertCircle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-black text-danger">برای نمایش نتایج، تعداد معتبر وارد کنید</h2>
              <p className="mt-1 text-xs leading-6 text-ink-muted">
                تا زمانی که مقدار صحیح اعمال نشود، قیمت کل و وضعیت تأمین جدید محاسبه نمی‌شوند.
              </p>
            </div>
          </div>
        </section>
      ) : comparisonResult.offers.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-card border border-line bg-surface p-8 text-center shadow-card sm:p-10">
          <div className="grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
            <IconPackage className="size-6" aria-hidden="true" />
          </div>
          <h2 className="mt-3 text-sm font-black text-ink">
            عرضه‌ای برای مقایسه نمایش داده نمی‌شود
          </h2>
          <p className="mt-2 max-w-md text-xs leading-6 text-ink-muted">
            در حال حاضر عرضهٔ واجد شرایطی برای این کالا در داده‌های مقایسه وجود ندارد.
          </p>
        </section>
      ) : (
        <section aria-labelledby="comparison-results-title" className="space-y-4">
          <div className="flex flex-col gap-3 rounded-card border border-primary/20 bg-primary-soft p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2 text-sm font-black text-primary">
              <IconCoins className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div>
                <h2 id="comparison-results-title">نتایج برای {formatPersianNumber(comparisonResult.quantity)} {product.unit}</h2>
                <p className="mt-1 text-xs font-bold leading-6 text-ink-muted" aria-live="polite">
                  {formatPersianNumber(comparisonResult.fulfillableCount)} پیشنهاد از {formatPersianNumber(comparisonResult.totalOffersCount)} پیشنهاد، این مقدار را تأمین می‌کنند.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-ink-muted">پیشنهادهای قابل تأمین در ابتدای فهرست‌اند.</span>
          </div>

          <div
            className="cafe-compare-table overflow-x-auto rounded-card border border-line bg-surface shadow-card focus-visible:outline-2 focus-visible:outline-primary"
            role="region"
            aria-label="جدول مقایسه عرضه‌ها؛ برای مشاهده ستون‌های بیشتر به صورت افقی پیمایش کنید"
            tabIndex={0}
          >
            <table className="min-w-[72rem] w-full text-start text-xs">
              <caption className="sr-only">
                مقایسه تأمین‌کنندگان برای {formatPersianNumber(comparisonResult.quantity)} {product.unit} از {product.name}
              </caption>
              <thead className="border-b border-line bg-surface-subtle text-[11px] font-black text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start">تأمین‌کننده</th>
                  <th scope="col" className="px-4 py-3 text-start">قیمت واحد</th>
                  <th scope="col" className="px-4 py-3 text-start">مبلغ کالا</th>
                  <th scope="col" className="px-4 py-3 text-start">موجودی</th>
                  <th scope="col" className="px-4 py-3 text-start">حداقل سفارش</th>
                  <th scope="col" className="px-4 py-3 text-start">زمان تحویل</th>
                  <th scope="col" className="px-4 py-3 text-start">وضعیت تأمین</th>
                  <th scope="col" className="px-4 py-3 text-start">به‌روزرسانی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {comparisonResult.offers.map((offer) => (
                  <tr key={offer.offerId} className={`align-top transition hover:bg-surface-subtle/70 ${offer.isFulfillable ? "" : "bg-danger-soft/25"}`}>
                    <td className="max-w-52 px-4 py-4">
                      <div className="flex min-w-0 items-start gap-2">
                        <IconBuildingStore className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="break-words font-black leading-5 text-ink">{offer.supplierBusinessName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 tabular-nums">
                      <p className="whitespace-nowrap text-sm font-black text-primary">{formatToman(offer.price)}</p>
                      <p className="mt-1 text-[10px] text-ink-muted">برای هر {offer.productUnit}</p>
                      {offer.isLowestPrice ? <span className="mt-2 block"><LowestPriceBadge /></span> : null}
                    </td>
                    <td className="px-4 py-4 tabular-nums">
                      {offer.isFulfillable ? <span className="whitespace-nowrap text-sm font-black text-ink">{formatToman(offer.itemTotal)}</span> : <span className="text-ink-muted">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-bold tabular-nums text-ink">{formatPersianNumber(offer.stock)} {offer.productUnit}</td>
                    <td className="whitespace-nowrap px-4 py-4 tabular-nums text-ink-muted">{formatPersianNumber(offer.minOrderQuantity)} {offer.productUnit}</td>
                    <td className="whitespace-nowrap px-4 py-4 font-bold text-ink">{formatDeliveryTime(offer.deliveryDays)}</td>
                    <td className="px-4 py-4"><FulfillmentStatus offer={offer} /></td>
                    <td className="whitespace-nowrap px-4 py-4 text-ink-muted">{formatPersianDate(offer.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cafe-compare-cards grid gap-3">
            {comparisonResult.offers.map((offer) => (
              <article key={offer.offerId} className={`min-w-0 rounded-card border bg-surface p-4 shadow-card ${offer.isFulfillable ? "border-line" : "border-danger/25"}`}>
                <div className="flex min-w-0 flex-col gap-3 border-b border-line pb-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-2">
                    <IconBuildingStore className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                    <h3 className="min-w-0 break-words text-sm font-black leading-6 text-ink">{offer.supplierBusinessName}</h3>
                  </div>
                  <FulfillmentStatus offer={offer} showReason={false} />
                </div>

                <div className="grid gap-3 border-b border-line py-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink-muted">قیمت هر {offer.productUnit}</p>
                    <p className="mt-1 break-words text-lg font-black tabular-nums text-primary">{formatToman(offer.price)}</p>
                    {offer.isLowestPrice ? <span className="mt-2 block"><LowestPriceBadge /></span> : null}
                  </div>
                  <div className="min-w-0 sm:text-end">
                    <p className="text-xs font-bold text-ink-muted">مبلغ کالا</p>
                    <p className="mt-1 break-words text-lg font-black tabular-nums text-ink">
                      {offer.isFulfillable ? formatToman(offer.itemTotal) : "—"}
                    </p>
                  </div>
                </div>

                <dl className="grid gap-x-5 gap-y-3 py-4 text-xs sm:grid-cols-2">
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3"><dt className="text-ink-muted">موجودی</dt><dd className="break-words text-end font-bold tabular-nums text-ink">{formatPersianNumber(offer.stock)} {offer.productUnit}</dd></div>
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3"><dt className="text-ink-muted">حداقل سفارش</dt><dd className="break-words text-end font-bold tabular-nums text-ink">{formatPersianNumber(offer.minOrderQuantity)} {offer.productUnit}</dd></div>
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3"><dt className="text-ink-muted">زمان تحویل</dt><dd className="break-words text-end font-bold text-ink">{formatDeliveryTime(offer.deliveryDays)}</dd></div>
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3"><dt className="text-ink-muted">آخرین به‌روزرسانی</dt><dd className="break-words text-end text-ink">{formatPersianDate(offer.updatedAt)}</dd></div>
                </dl>

                {!offer.isFulfillable && offer.unfulfillableReason ? (
                  <div className="rounded-control bg-danger-soft p-3 text-xs font-bold leading-6 text-danger">
                    <span className="block text-[11px]">علت عدم تأمین</span>
                    <span className="break-words">{offer.unfulfillableReason}</span>
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <aside className="rounded-control border border-line bg-surface p-4 text-xs leading-6 text-ink-muted">
            <p className="font-black text-ink">درباره مبلغ کالا</p>
            <p className="mt-1">
              «مبلغ کالا» حاصل قیمت عرضه برای تعداد اعمال‌شده است و هزینه ارسال، مالیات و تخفیف‌های احتمالی در آن محاسبه نشده‌اند.
            </p>
          </aside>
        </section>
      )}
    </div>
  );
}
