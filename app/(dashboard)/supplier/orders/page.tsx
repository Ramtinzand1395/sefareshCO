import { IconAlertCircle, IconShoppingBag } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  orderListHref,
  orderStatuses,
  OrderStatusFilters,
  safeOrderError,
} from "@/app/(dashboard)/_components/order-ui";
import { OrdersListView } from "@/app/(dashboard)/_components/orders-list-view";
import { listSupplierOrdersAction } from "@/app/actions/orders";
import type { OrderStatus } from "@/model/order";
import { createPaginationMeta } from "@/src/lib/admin-query";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "سفارش‌های دریافتی | پنل تأمین‌کننده",
};

const PAGE_SIZE = 20;
type QueryParam = string | string[] | undefined;
type Props = { searchParams: Promise<Record<string, QueryParam>> };

function singleParam(value: QueryParam) {
  return Array.isArray(value) ? value[0] : value;
}

function safePage(value: QueryParam) {
  const page = Number(singleParam(value));
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function safeStatus(value: QueryParam): OrderStatus | undefined {
  const status = singleParam(value);
  return orderStatuses.includes(status as OrderStatus) ? (status as OrderStatus) : undefined;
}

export default async function SupplierOrdersPage({ searchParams }: Props) {
  const query = await searchParams;
  const page = safePage(query.page);
  const status = safeStatus(query.status);
  const result = await listSupplierOrdersAction({ page, pageSize: PAGE_SIZE, status });

  return (
    <div className="supplier-content-container space-y-6">
      <header>
        <p className="text-xs font-black tracking-wide text-primary">مدیریت چرخه تأمین</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">سفارش‌های دریافتی</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-muted">
          سفارش‌های ثبت‌شده را بررسی و وضعیت آماده‌سازی و ارسال آن‌ها را مدیریت کنید.
        </p>
      </header>

      <OrderStatusFilters basePath="/supplier/orders" currentStatus={status} audience="supplier" />

      {!result.ok || !result.data ? (
        <section className="flex min-h-72 flex-col items-center justify-center rounded-card border border-danger/25 bg-surface p-8 text-center shadow-card">
          <IconAlertCircle className="size-10 text-danger" aria-hidden="true" />
          <h2 className="mt-4 text-base font-black text-ink">سفارش‌ها دریافت نشدند</h2>
          <p className="mt-2 max-w-lg text-sm leading-7 text-ink-muted">{safeOrderError(result.error)}</p>
          <Link href={orderListHref("/supplier/orders", status)} className="mt-5 inline-flex min-h-11 items-center rounded-control bg-primary px-5 text-sm font-black text-white">تلاش دوباره</Link>
        </section>
      ) : (() => {
          const pagination = createPaginationMeta(page, PAGE_SIZE, result.data.total);
          if (result.data.total > 0 && page > pagination.totalPages) {
            return (
              <section className="flex min-h-72 flex-col items-center justify-center rounded-card border border-dashed border-line bg-surface p-8 text-center shadow-card">
                <IconShoppingBag className="size-10 text-primary" aria-hidden="true" />
                <h2 className="mt-4 text-base font-black text-ink">این صفحه از سفارش‌ها وجود ندارد</h2>
                <Link href={orderListHref("/supplier/orders", status)} className="mt-5 inline-flex min-h-11 items-center rounded-control bg-primary px-5 text-sm font-black text-white">بازگشت به صفحه اول</Link>
              </section>
            );
          }
          return (
            <OrdersListView
              items={result.data.items.map((order) => ({ ...order, partyName: order.cafeName }))}
              pagination={pagination}
              basePath="/supplier/orders"
              audience="supplier"
              currentStatus={status}
            />
          );
        })()}
    </div>
  );
}
