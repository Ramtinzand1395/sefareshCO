import {
  IconBuildingBank,
  IconClockHour4,
  IconCoins,
  IconReceipt,
} from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  FinanceAmount,
  FinanceEmptyState,
  FinanceErrorState,
  FinancePagination,
  FinanceSummaryCard,
  PayableStatusBadge,
} from "@/app/(dashboard)/_components/finance-ui";
import {
  getSupplierFinanceOverviewAction,
  listSupplierPayablesAction,
  listSupplierSettlementsAction,
} from "@/app/actions/finance";
import type { SupplierPayableStatus } from "@/src/domain/finance";
import {
  formatPersianDateTime,
  formatPersianNumber,
} from "@/src/lib/persian-format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "امور مالی | پنل تأمین‌کننده",
};

const PAGE_SIZE = 20;
const validStatuses = new Set<SupplierPayableStatus>([
  "pending",
  "eligible",
  "settled",
  "cancelled",
]);

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SupplierFinancePage({ searchParams }: Props) {
  const params = await searchParams;
  const tab = params.tab === "settlements" ? "settlements" : "payables";
  const page = Math.max(1, Number(params.page) || 1);
  const statusParam = typeof params.status === "string" ? params.status : undefined;
  const status =
    statusParam && validStatuses.has(statusParam as SupplierPayableStatus)
      ? (statusParam as SupplierPayableStatus)
      : undefined;

  const [overviewResult, payablesResult, settlementsResult] = await Promise.all([
    getSupplierFinanceOverviewAction(),
    tab === "payables"
      ? listSupplierPayablesAction({ page, pageSize: PAGE_SIZE, status })
      : Promise.resolve(null),
    tab === "settlements"
      ? listSupplierSettlementsAction({ page, pageSize: PAGE_SIZE })
      : Promise.resolve(null),
  ]);

  const buildHref = (overrides: {
    tab?: "payables" | "settlements";
    status?: SupplierPayableStatus;
    page?: number;
  }) => {
    const nextTab = overrides.tab ?? tab;
    const nextStatus = Object.prototype.hasOwnProperty.call(overrides, "status")
      ? overrides.status
      : status;
    const nextPage = overrides.page ?? 1;
    const query = new URLSearchParams({ tab: nextTab });
    if (nextTab === "payables" && nextStatus) query.set("status", nextStatus);
    if (nextPage > 1) query.set("page", String(nextPage));
    return `/supplier/finance?${query.toString()}`;
  };

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6">
      <header className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
        <p className="text-xs font-black tracking-wide text-primary">پنل تأمین‌کننده</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          امور مالی
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-muted sm:text-base">
          مطالبات، مبالغ آماده تسویه و تاریخچه تسویه‌های خود را مشاهده کنید.
        </p>
      </header>

      {overviewResult.ok && overviewResult.data ? (
        <div className="grid gap-4 md:grid-cols-3">
          <FinanceSummaryCard
            title="در انتظار تکمیل سفارش"
            amount={overviewResult.data.pendingPayableAmount}
            meta={`${formatPersianNumber(overviewResult.data.totalPayableCount)} قلم مالی ثبت‌شده`}
            icon={<IconClockHour4 className="size-5" />}
          />
          <FinanceSummaryCard
            title="آماده تسویه"
            amount={overviewResult.data.eligibleSettlementAmount}
            tone="warning"
            icon={<IconCoins className="size-5" />}
          />
          <FinanceSummaryCard
            title="تسویه‌شده"
            amount={overviewResult.data.settledAmount}
            tone="success"
            icon={<IconBuildingBank className="size-5" />}
          />
        </div>
      ) : (
        <FinanceErrorState message={overviewResult.error} compact />
      )}

      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <nav
          aria-label="بخش‌های امور مالی"
          className="flex gap-1 overflow-x-auto border-b border-line p-2"
        >
          <FinanceTab
            href={buildHref({ tab: "payables", page: 1 })}
            active={tab === "payables"}
          >
            مطالبات
          </FinanceTab>
          <FinanceTab
            href={buildHref({ tab: "settlements", page: 1 })}
            active={tab === "settlements"}
          >
            تاریخچه تسویه‌ها
          </FinanceTab>
        </nav>

        {tab === "payables" && payablesResult ? (
          <PayablesSection
            result={payablesResult}
            status={status}
            page={page}
            buildHref={buildHref}
          />
        ) : settlementsResult ? (
          <SettlementsSection
            result={settlementsResult}
            page={page}
            buildHref={buildHref}
          />
        ) : null}
      </div>
    </section>
  );
}

function FinanceTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-10 shrink-0 items-center rounded-control px-4 text-xs font-black transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        active
          ? "bg-primary text-white"
          : "text-ink-muted hover:bg-surface-subtle hover:text-primary"
      }`}
    >
      {children}
    </Link>
  );
}

type SupplierFinanceHrefBuilder = (overrides: {
  tab?: "payables" | "settlements";
  status?: SupplierPayableStatus;
  page?: number;
}) => string;

function PayablesSection({
  result,
  status,
  page,
  buildHref,
}: {
  result: Awaited<ReturnType<typeof listSupplierPayablesAction>>;
  status?: SupplierPayableStatus;
  page: number;
  buildHref: SupplierFinanceHrefBuilder;
}) {
  const filters: Array<{ label: string; value?: SupplierPayableStatus }> = [
    { label: "همه" },
    { label: "در انتظار تکمیل سفارش", value: "pending" },
    { label: "آماده تسویه", value: "eligible" },
    { label: "تسویه‌شده", value: "settled" },
  ];

  if (!result.ok || !result.data) {
    return <div className="p-5"><FinanceErrorState message={result.error} compact /></div>;
  }

  return (
    <section aria-labelledby="supplier-payables-heading">
      <div className="border-b border-line px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <IconReceipt className="size-5 text-primary" aria-hidden="true" />
          <h2 id="supplier-payables-heading" className="text-base font-black text-ink">
            مطالبات
          </h2>
        </div>
        <p className="mt-1 text-xs leading-6 text-ink-muted">
          هر مبلغ پس از پرداخت سفارش ثبت می‌شود و با تحویل سفارش آماده تسویه خواهد بود.
        </p>
        <nav aria-label="فیلتر وضعیت مطالبات" className="mt-4 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2">
            {filters.map((filter) => {
              const active = status === filter.value;
              return (
                <Link
                  key={filter.value ?? "all"}
                  href={buildHref({ tab: "payables", status: filter.value, page: 1 })}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-10 items-center rounded-control border px-3 text-xs font-black transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    active
                      ? "border-primary bg-primary text-white"
                      : "border-line bg-surface text-ink-muted hover:border-primary hover:text-primary"
                  }`}
                >
                  {filter.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {result.data.items.length === 0 ? (
        <FinanceEmptyState
          title={status === "eligible" ? "در حال حاضر مبلغی آماده تسویه نیست." : "هنوز مطالبه‌ای برای شما ثبت نشده است."}
          description={status ? "برای مشاهده سایر موارد، فیلتر وضعیت را تغییر دهید." : undefined}
        />
      ) : (
        <>
          <div className="divide-y divide-line md:hidden">
            {result.data.items.map((item) => (
              <article key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-ink-muted">شماره سفارش</p>
                    <p dir="ltr" className="mt-1 inline-block font-black text-ink">{item.orderNumber}</p>
                  </div>
                  <PayableStatusBadge status={item.status} />
                </div>
                <FinanceAmount value={item.netAmount} className="mt-4 block text-lg font-black text-ink" />
                <dl className="mt-3 grid grid-cols-2 gap-3 rounded-control bg-surface-subtle p-3 text-xs">
                  <PayableDetail label="مبلغ سفارش" value={<FinanceAmount value={item.grossAmount} />} />
                  <PayableDetail label="کارمزد پلتفرم" value={<FinanceAmount value={item.platformFee} />} />
                  <PayableDetail label="تاریخ ثبت" value={formatPersianDateTime(item.createdAt)} />
                  <PayableDetail label="آماده از" value={formatPersianDateTime(item.eligibleAt)} />
                </dl>
                {item.settlementNumber ? (
                  <p className="mt-3 text-xs text-ink-muted">شماره تسویه: <span dir="ltr" className="inline-block font-black text-ink">{item.settlementNumber}</span></p>
                ) : null}
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-surface-subtle text-xs text-ink-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 text-start font-black">سفارش</th>
                  <th scope="col" className="px-4 py-3 text-start font-black">مبلغ سفارش</th>
                  <th scope="col" className="px-4 py-3 text-start font-black">کارمزد</th>
                  <th scope="col" className="px-4 py-3 text-start font-black">خالص تسویه</th>
                  <th scope="col" className="px-4 py-3 text-start font-black">وضعیت</th>
                  <th scope="col" className="px-4 py-3 text-start font-black">تاریخ</th>
                  <th scope="col" className="px-5 py-3 text-start font-black">شماره تسویه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.data.items.map((item) => (
                  <tr key={item.id} className="transition hover:bg-surface-subtle">
                    <td className="px-5 py-4"><span dir="ltr" className="inline-block font-black text-ink">{item.orderNumber}</span></td>
                    <td className="px-4 py-4 text-ink"><FinanceAmount value={item.grossAmount} /></td>
                    <td className="px-4 py-4 text-ink-muted"><FinanceAmount value={item.platformFee} /></td>
                    <td className="px-4 py-4 font-black text-ink"><FinanceAmount value={item.netAmount} /></td>
                    <td className="px-4 py-4"><PayableStatusBadge status={item.status} /></td>
                    <td className="px-4 py-4 text-xs text-ink-muted">{formatPersianDateTime(item.eligibleAt || item.createdAt)}</td>
                    <td className="px-5 py-4 text-ink-muted">{item.settlementNumber ? <span dir="ltr" className="inline-block font-bold text-ink">{item.settlementNumber}</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <FinancePagination
        page={page}
        pageSize={PAGE_SIZE}
        total={result.data.total}
        entityLabel="مطالبه"
        previousHref={buildHref({ tab: "payables", page: page - 1 })}
        nextHref={buildHref({ tab: "payables", page: page + 1 })}
      />
    </section>
  );
}

function SettlementsSection({
  result,
  page,
  buildHref,
}: {
  result: Awaited<ReturnType<typeof listSupplierSettlementsAction>>;
  page: number;
  buildHref: SupplierFinanceHrefBuilder;
}) {
  if (!result.ok || !result.data) {
    return <div className="p-5"><FinanceErrorState message={result.error} compact /></div>;
  }
  return (
    <section aria-labelledby="supplier-settlements-heading">
      <div className="border-b border-line px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <IconBuildingBank className="size-5 text-primary" aria-hidden="true" />
          <h2 id="supplier-settlements-heading" className="text-base font-black text-ink">تاریخچه تسویه‌ها</h2>
        </div>
        <p className="mt-1 text-xs leading-6 text-ink-muted">تسویه‌های ثبت‌شده برای مطالبات این تأمین‌کننده</p>
      </div>
      {result.data.items.length === 0 ? (
        <FinanceEmptyState title="هنوز تسویه‌ای ثبت نشده است." />
      ) : (
        <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
          {result.data.items.map((settlement) => (
            <article key={settlement.id} className="rounded-card border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-ink-muted">شماره تسویه</p>
                  <p dir="ltr" className="mt-1 inline-block font-black text-ink">{settlement.settlementNumber}</p>
                </div>
                <span className="rounded-full border border-success/25 bg-success-soft px-2.5 py-1 text-[11px] font-black text-success">تسویه‌شده</span>
              </div>
              <FinanceAmount value={settlement.totalAmount} className="mt-4 block text-xl font-black text-ink" />
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-3 text-xs text-ink-muted">
                <span>{formatPersianNumber(settlement.payableCount)} مطالبه</span>
                <time dateTime={settlement.settledAt}>{formatPersianDateTime(settlement.settledAt)}</time>
              </div>
              {settlement.note ? <p className="mt-3 text-xs leading-6 text-ink-muted">{settlement.note}</p> : null}
            </article>
          ))}
        </div>
      )}
      <FinancePagination
        page={page}
        pageSize={PAGE_SIZE}
        total={result.data.total}
        entityLabel="تسویه"
        previousHref={buildHref({ tab: "settlements", page: page - 1 })}
        nextHref={buildHref({ tab: "settlements", page: page + 1 })}
      />
    </section>
  );
}

function PayableDetail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt className="text-ink-muted">{label}</dt><dd className="mt-1 font-black leading-6 text-ink">{value}</dd></div>;
}
