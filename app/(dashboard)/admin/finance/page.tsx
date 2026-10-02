import {
  IconBuildingBank,
  IconCash,
  IconClockHour4,
  IconCoins,
  IconCreditCard,
  IconReceipt,
  IconTruckDelivery,
} from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  FinanceAmount,
  FinanceEmptyState,
  FinanceErrorState,
  FinancePagination,
  FinanceSummaryCard,
  PaymentStatusBadge,
} from "@/app/(dashboard)/_components/finance-ui";
import { AdminPageHeader } from "@/app/(dashboard)/admin/_components/admin-page-header";
import { SettlementCandidateWorkspace } from "@/app/(dashboard)/admin/finance/settlement-candidate-workspace";
import {
  getAdminFinanceOverviewAction,
  getAdminSettlementCandidatesAction,
  listAdminPaymentsAction,
  listAdminSettlementsAction,
} from "@/app/actions/finance";
import type { PaymentStatus } from "@/src/domain/finance";
import {
  formatPersianDateTime,
  formatPersianNumber,
} from "@/src/lib/persian-format";
import { getAdminSupplierList } from "@/src/services/admin-supplier-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "امور مالی | پنل مدیریت",
};

const PAGE_SIZE = 20;
const validPaymentStatuses = new Set<PaymentStatus>([
  "pending",
  "paid",
  "failed",
  "cancelled",
]);
type AdminFinanceTab = "overview" | "payments" | "candidates" | "settlements";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminFinancePage({ searchParams }: Props) {
  const params = await searchParams;
  const requestedTab = typeof params.tab === "string" ? params.tab : "overview";
  const tab: AdminFinanceTab = ["payments", "candidates", "settlements"].includes(requestedTab)
    ? (requestedTab as AdminFinanceTab)
    : "overview";
  const page = Math.max(1, Number(params.page) || 1);
  const supplierPage = Math.max(1, Number(params.supplierPage) || 1);
  const statusParam = typeof params.status === "string" ? params.status : undefined;
  const status = statusParam && validPaymentStatuses.has(statusParam as PaymentStatus)
    ? (statusParam as PaymentStatus)
    : undefined;
  const selectedSupplierId = typeof params.supplierId === "string" && /^[a-f\d]{24}$/i.test(params.supplierId)
    ? params.supplierId
    : undefined;

  const [overviewResult, paymentsResult, settlementsResult, supplierList, candidatesResult] = await Promise.all([
    getAdminFinanceOverviewAction(),
    tab === "payments"
      ? listAdminPaymentsAction({ page, pageSize: PAGE_SIZE, status })
      : Promise.resolve(null),
    tab === "settlements"
      ? listAdminSettlementsAction({ page, pageSize: PAGE_SIZE })
      : Promise.resolve(null),
    tab === "candidates"
      ? getAdminSupplierList({ page: supplierPage, pageSize: 12 })
      : Promise.resolve(null),
    tab === "candidates" && selectedSupplierId
      ? getAdminSettlementCandidatesAction(selectedSupplierId)
      : Promise.resolve(null),
  ]);

  const selectedSupplier = supplierList?.items.find(
    (supplier) => supplier.id === selectedSupplierId,
  );

  const tabHref = (nextTab: AdminFinanceTab) =>
    nextTab === "overview" ? "/admin/finance" : `/admin/finance?tab=${nextTab}`;

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6">
      <header className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
        <AdminPageHeader
          title="امور مالی"
          description="مرکز پایش پرداخت‌ها، مطالبات آماده تسویه و سوابق مالی پلتفرم"
        />
      </header>

      <nav aria-label="بخش‌های مدیریت مالی" className="overflow-x-auto rounded-card border border-line bg-surface p-2 shadow-card">
        <div className="flex min-w-max gap-1">
          <AdminFinanceTabLink href={tabHref("overview")} active={tab === "overview"}>نمای کلی</AdminFinanceTabLink>
          <AdminFinanceTabLink href={tabHref("payments")} active={tab === "payments"}>پرداخت‌ها</AdminFinanceTabLink>
          <AdminFinanceTabLink href={tabHref("candidates")} active={tab === "candidates"}>آماده تسویه</AdminFinanceTabLink>
          <AdminFinanceTabLink href={tabHref("settlements")} active={tab === "settlements"}>تسویه‌ها</AdminFinanceTabLink>
        </div>
      </nav>

      {tab === "overview" ? (
        <AdminOverview result={overviewResult} />
      ) : null}
      {tab === "payments" && paymentsResult ? (
        <AdminPayments result={paymentsResult} page={page} status={status} />
      ) : null}
      {tab === "candidates" && supplierList ? (
        <AdminCandidates
          suppliers={supplierList}
          supplierPage={supplierPage}
          selectedSupplierId={selectedSupplierId}
          selectedSupplierName={selectedSupplier?.businessName || "تأمین‌کننده منتخب"}
          candidatesResult={candidatesResult}
          eligibleTotal={overviewResult.data?.eligibleSettlementAmount}
        />
      ) : null}
      {tab === "settlements" && settlementsResult ? (
        <AdminSettlements result={settlementsResult} page={page} />
      ) : null}
    </section>
  );
}

function AdminFinanceTabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-control px-4 text-xs font-black transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active ? "bg-primary text-white" : "text-ink-muted hover:bg-surface-subtle hover:text-primary"}`}>
      {children}
    </Link>
  );
}

function AdminOverview({ result }: { result: Awaited<ReturnType<typeof getAdminFinanceOverviewAction>> }) {
  if (!result.ok || !result.data) return <FinanceErrorState message={result.error} />;
  return (
    <section aria-labelledby="admin-finance-overview-heading">
      <div className="mb-4">
        <h2 id="admin-finance-overview-heading" className="text-base font-black text-ink">نمای کلان مالی</h2>
        <p className="mt-1 text-xs leading-6 text-ink-muted">مبالغ ثبت‌شده در دفتر مالی پلتفرم بر اساس وضعیت فعلی</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <CountSummaryCard title="پرداخت‌های موفق" value={result.data.totalSuccessfulPayments} icon={<IconCreditCard className="size-5" />} />
        <FinanceSummaryCard title="مبلغ دریافتی" amount={result.data.totalReceivedAmount} tone="success" icon={<IconCash className="size-5" />} />
        <FinanceSummaryCard title="مطالبات در انتظار" amount={result.data.pendingSupplierPayableAmount} icon={<IconClockHour4 className="size-5" />} />
        <FinanceSummaryCard title="مبلغ آماده تسویه" amount={result.data.eligibleSettlementAmount} tone="warning" icon={<IconCoins className="size-5" />} />
        <FinanceSummaryCard title="مبلغ تسویه‌شده" amount={result.data.settledAmount} tone="success" icon={<IconBuildingBank className="size-5" />} />
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <QuickLink href="/admin/finance?tab=payments" icon={<IconCreditCard className="size-5" />} title="مشاهده پرداخت‌ها" description="تلاش‌های پرداخت کافه‌ها و وضعیت هرکدام" />
        <QuickLink href="/admin/finance?tab=candidates" icon={<IconCoins className="size-5" />} title="ثبت تسویه" description="انتخاب مطالبات آماده تسویه برای هر تأمین‌کننده" />
        <QuickLink href="/admin/finance?tab=settlements" icon={<IconReceipt className="size-5" />} title="سوابق تسویه" description="مرور تمام تسویه‌های ثبت‌شده پلتفرم" />
      </div>
    </section>
  );
}

function CountSummaryCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <article className="rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="text-xs font-black leading-6 text-ink-muted">{title}</h3><p className="mt-2 text-2xl font-black tabular-nums text-ink">{formatPersianNumber(value)}</p><p className="mt-2 text-xs font-bold text-ink-muted">تراکنش ثبت‌شده</p></div>
        <span className="grid size-10 place-items-center rounded-xl bg-success-soft text-success" aria-hidden="true">{icon}</span>
      </div>
    </article>
  );
}

function QuickLink({ href, icon, title, description }: { href: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <Link href={href} className="group rounded-card border border-line bg-surface p-4 shadow-card transition hover:border-primary/40">
      <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary" aria-hidden="true">{icon}</span>
      <h3 className="mt-3 text-sm font-black text-ink group-hover:text-primary">{title}</h3>
      <p className="mt-1 text-xs leading-6 text-ink-muted">{description}</p>
    </Link>
  );
}

function AdminPayments({ result, page, status }: { result: Awaited<ReturnType<typeof listAdminPaymentsAction>>; page: number; status?: PaymentStatus }) {
  const filters: Array<{ value?: PaymentStatus; label: string }> = [
    { label: "همه" }, { value: "paid", label: "موفق" }, { value: "pending", label: "در انتظار" }, { value: "failed", label: "ناموفق" }, { value: "cancelled", label: "لغوشده" },
  ];
  const href = (nextPage: number, nextStatus = status) => {
    const query = new URLSearchParams({ tab: "payments" });
    if (nextStatus) query.set("status", nextStatus);
    if (nextPage > 1) query.set("page", String(nextPage));
    return `/admin/finance?${query.toString()}`;
  };
  if (!result.ok || !result.data) return <FinanceErrorState message={result.error} />;
  return (
    <section aria-labelledby="admin-payments-heading" className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="border-b border-line px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2"><IconCreditCard className="size-5 text-primary" aria-hidden="true" /><h2 id="admin-payments-heading" className="text-base font-black text-ink">پرداخت‌های پلتفرم</h2></div>
        <p className="mt-1 text-xs leading-6 text-ink-muted">فهرست تلاش‌های پرداخت بدون امکان تغییر دستی وضعیت</p>
        <nav aria-label="فیلتر وضعیت پرداخت" className="mt-4 overflow-x-auto pb-1"><div className="flex min-w-max gap-2">
          {filters.map((filter) => <Link key={filter.value ?? "all"} href={href(1, filter.value)} aria-current={status === filter.value ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-control border px-3 text-xs font-black transition ${status === filter.value ? "border-primary bg-primary text-white" : "border-line text-ink-muted hover:border-primary hover:text-primary"}`}>{filter.label}</Link>)}
        </div></nav>
      </div>
      {result.data.items.length === 0 ? <FinanceEmptyState title="پرداختی با این وضعیت ثبت نشده است." /> : <>
        <div className="divide-y divide-line lg:hidden">
          {result.data.items.map((payment) => <article key={payment.id} className="p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-ink-muted">کد پرداخت</p><p dir="ltr" className="mt-1 inline-block font-black text-ink">{payment.paymentReference}</p></div><PaymentStatusBadge status={payment.status} /></div>
            <FinanceAmount value={payment.amount} className="mt-4 block text-lg font-black text-ink" />
            <dl className="mt-3 grid grid-cols-2 gap-3 rounded-control bg-surface-subtle p-3 text-xs">
              <PaymentDetail label="شماره سفارش"><span dir="ltr" className="inline-block">{payment.orderNumber}</span></PaymentDetail>
              <PaymentDetail label="کافه">{payment.cafeName}</PaymentDetail>
              <PaymentDetail label="تأمین‌کننده">{payment.supplierName}</PaymentDetail>
              <PaymentDetail label="تاریخ">{formatPersianDateTime(payment.paidAt || payment.createdAt)}</PaymentDetail>
            </dl>
          </article>)}
        </div>
        <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[1050px] text-sm"><thead className="bg-surface-subtle text-xs text-ink-muted"><tr>
          <th scope="col" className="px-5 py-3 text-start font-black">کد پرداخت</th><th scope="col" className="px-4 py-3 text-start font-black">سفارش</th><th scope="col" className="px-4 py-3 text-start font-black">کافه</th><th scope="col" className="px-4 py-3 text-start font-black">تأمین‌کننده</th><th scope="col" className="px-4 py-3 text-start font-black">مبلغ</th><th scope="col" className="px-4 py-3 text-start font-black">وضعیت</th><th scope="col" className="px-4 py-3 text-start font-black">تاریخ ثبت</th><th scope="col" className="px-5 py-3 text-start font-black">تاریخ پرداخت</th>
        </tr></thead><tbody className="divide-y divide-line">{result.data.items.map((payment) => <tr key={payment.id} className="transition hover:bg-surface-subtle">
          <td className="px-5 py-4"><span dir="ltr" className="inline-block font-black text-ink">{payment.paymentReference}</span></td><td className="px-4 py-4"><span dir="ltr" className="inline-block font-bold text-ink">{payment.orderNumber}</span></td><td className="px-4 py-4 text-ink">{payment.cafeName}</td><td className="px-4 py-4 text-ink">{payment.supplierName}</td><td className="px-4 py-4 font-black text-ink"><FinanceAmount value={payment.amount} /></td><td className="px-4 py-4"><PaymentStatusBadge status={payment.status} /></td><td className="px-4 py-4 text-xs text-ink-muted">{formatPersianDateTime(payment.createdAt)}</td><td className="px-5 py-4 text-xs text-ink-muted">{formatPersianDateTime(payment.paidAt)}</td>
        </tr>)}</tbody></table></div>
      </>}
      <FinancePagination page={page} pageSize={PAGE_SIZE} total={result.data.total} entityLabel="پرداخت" previousHref={href(page - 1)} nextHref={href(page + 1)} />
    </section>
  );
}

function PaymentDetail({ label, children }: { label: string; children: React.ReactNode }) { return <div><dt className="text-ink-muted">{label}</dt><dd className="mt-1 break-words font-black leading-6 text-ink">{children}</dd></div>; }

function AdminCandidates({ suppliers, supplierPage, selectedSupplierId, selectedSupplierName, candidatesResult, eligibleTotal }: { suppliers: Awaited<ReturnType<typeof getAdminSupplierList>>; supplierPage: number; selectedSupplierId?: string; selectedSupplierName: string; candidatesResult: Awaited<ReturnType<typeof getAdminSettlementCandidatesAction>> | null; eligibleTotal?: number }) {
  const supplierHref = (supplierId: string) => `/admin/finance?tab=candidates&supplierPage=${supplierPage}&supplierId=${supplierId}`;
  const supplierPageHref = (nextPage: number) => `/admin/finance?tab=candidates&supplierPage=${nextPage}`;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section aria-labelledby="supplier-selection-heading" className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <div className="border-b border-line px-4 py-4 sm:px-6"><div className="flex items-center gap-2"><IconTruckDelivery className="size-5 text-primary" aria-hidden="true" /><h2 id="supplier-selection-heading" className="text-base font-black text-ink">انتخاب تأمین‌کننده</h2></div><p className="mt-1 text-xs leading-6 text-ink-muted">مطالبات آماده تسویه برای هر تأمین‌کننده به‌صورت مستقل نمایش داده می‌شوند.</p></div>
          {suppliers.items.length === 0 ? <FinanceEmptyState title="تأمین‌کننده‌ای ثبت نشده است." /> : <div className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">{suppliers.items.map((supplier) => <Link key={supplier.id} href={supplierHref(supplier.id)} aria-current={selectedSupplierId === supplier.id ? "true" : undefined} className={`rounded-control border p-3 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selectedSupplierId === supplier.id ? "border-primary bg-primary-soft" : "border-line hover:border-primary/50"}`}><p className="truncate text-sm font-black text-ink">{supplier.businessName || "تأمین‌کننده بدون نام"}</p><p className="mt-1 text-xs text-ink-muted">مشاهده مطالبات آماده تسویه</p></Link>)}</div>}
          <FinancePagination page={suppliers.pagination.page} pageSize={suppliers.pagination.pageSize} total={suppliers.pagination.total} entityLabel="تأمین‌کننده" previousHref={supplierPageHref(supplierPage - 1)} nextHref={supplierPageHref(supplierPage + 1)} />
        </section>
        <FinanceSummaryCard title="کل مبلغ آماده تسویه" amount={eligibleTotal ?? 0} tone="warning" icon={<IconCoins className="size-5" />} />
      </div>
      {!selectedSupplierId ? <div className="rounded-card border border-dashed border-line bg-surface"><FinanceEmptyState title="یک تأمین‌کننده را انتخاب کنید." description="پس از انتخاب، اقلام آماده تسویه همان تأمین‌کننده نمایش داده می‌شوند." /></div> : candidatesResult?.ok && candidatesResult.data ? <SettlementCandidateWorkspace key={selectedSupplierId} supplierId={selectedSupplierId} supplierName={selectedSupplierName} candidates={candidatesResult.data} /> : <FinanceErrorState message={candidatesResult?.error} />}
    </div>
  );
}

function AdminSettlements({ result, page }: { result: Awaited<ReturnType<typeof listAdminSettlementsAction>>; page: number }) {
  const href = (nextPage: number) => `/admin/finance?tab=settlements${nextPage > 1 ? `&page=${nextPage}` : ""}`;
  if (!result.ok || !result.data) return <FinanceErrorState message={result.error} />;
  return (
    <section aria-labelledby="admin-settlements-heading" className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="border-b border-line px-4 py-4 sm:px-6"><div className="flex items-center gap-2"><IconBuildingBank className="size-5 text-primary" aria-hidden="true" /><h2 id="admin-settlements-heading" className="text-base font-black text-ink">تاریخچه تسویه‌ها</h2></div><p className="mt-1 text-xs leading-6 text-ink-muted">تسویه‌های ثبت‌شده برای تأمین‌کنندگان پلتفرم</p></div>
      {result.data.items.length === 0 ? <FinanceEmptyState title="هنوز تسویه‌ای ثبت نشده است." /> : <>
        <div className="divide-y divide-line md:hidden">{result.data.items.map((settlement) => <article key={settlement.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-ink-muted">شماره تسویه</p><p dir="ltr" className="mt-1 inline-block font-black text-ink">{settlement.settlementNumber}</p></div><span className="rounded-full border border-success/25 bg-success-soft px-2.5 py-1 text-[11px] font-black text-success">تسویه‌شده</span></div><FinanceAmount value={settlement.totalAmount} className="mt-4 block text-lg font-black text-ink" /><dl className="mt-3 grid grid-cols-2 gap-3 rounded-control bg-surface-subtle p-3 text-xs"><PaymentDetail label="تأمین‌کننده">{settlement.supplierName}</PaymentDetail><PaymentDetail label="تعداد مطالبات">{formatPersianNumber(settlement.payableCount)}</PaymentDetail><PaymentDetail label="زمان ثبت">{formatPersianDateTime(settlement.settledAt)}</PaymentDetail></dl></article>)}</div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-sm"><thead className="bg-surface-subtle text-xs text-ink-muted"><tr><th scope="col" className="px-5 py-3 text-start font-black">شماره تسویه</th><th scope="col" className="px-4 py-3 text-start font-black">تأمین‌کننده</th><th scope="col" className="px-4 py-3 text-start font-black">تعداد مطالبات</th><th scope="col" className="px-4 py-3 text-start font-black">مبلغ کل</th><th scope="col" className="px-5 py-3 text-start font-black">زمان ثبت</th></tr></thead><tbody className="divide-y divide-line">{result.data.items.map((settlement) => <tr key={settlement.id} className="transition hover:bg-surface-subtle"><td className="px-5 py-4"><span dir="ltr" className="inline-block font-black text-ink">{settlement.settlementNumber}</span></td><td className="px-4 py-4 text-ink">{settlement.supplierName}</td><td className="px-4 py-4 text-ink">{formatPersianNumber(settlement.payableCount)}</td><td className="px-4 py-4 font-black text-ink"><FinanceAmount value={settlement.totalAmount} /></td><td className="px-5 py-4 text-xs text-ink-muted">{formatPersianDateTime(settlement.settledAt)}</td></tr>)}</tbody></table></div>
      </>}
      <FinancePagination page={page} pageSize={PAGE_SIZE} total={result.data.total} entityLabel="تسویه" previousHref={href(page - 1)} nextHref={href(page + 1)} />
    </section>
  );
}
