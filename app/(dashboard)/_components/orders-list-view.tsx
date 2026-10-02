import {
  IconArrowLeft,
  IconCalendar,
  IconClock,
  IconPackage,
  IconShoppingBag,
} from "@tabler/icons-react";
import Link from "next/link";

import { AdminPagination } from "@/app/(dashboard)/admin/_components/admin-pagination";
import {
  deliveryLabel,
  getOrderStatusLabel,
  orderListHref,
  OrderStatusBadge,
} from "@/app/(dashboard)/_components/order-ui";
import type { OrderStatus } from "@/model/order";
import type { AdminPaginationMeta } from "@/src/lib/admin-query";
import {
  formatPersianDateTime,
  formatPersianNumber,
  formatToman,
} from "@/src/lib/persian-format";

export type OrderListRow = {
  id: string;
  orderNumber: string;
  partyName: string;
  status: OrderStatus;
  itemCount: number;
  totalAmount: number;
  deliveryDays: number;
  createdAt: string;
};

export function OrdersListView({
  items,
  pagination,
  basePath,
  audience,
  currentStatus,
}: {
  items: OrderListRow[];
  pagination: AdminPaginationMeta;
  basePath: string;
  audience: "cafe" | "supplier";
  currentStatus?: OrderStatus;
}) {
  if (items.length === 0) {
    const emptyText = currentStatus
      ? `سفارش ${getOrderStatusLabel(currentStatus, audience)}‌ای وجود ندارد.`
      : audience === "cafe"
        ? "هنوز سفارشی ثبت نکرده‌اید."
        : "هنوز سفارش جدیدی دریافت نکرده‌اید.";
    return (
      <section className="flex min-h-72 flex-col items-center justify-center rounded-card border border-dashed border-line bg-surface p-8 text-center shadow-card">
        <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
          <IconShoppingBag className="size-7" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-base font-black text-ink">{emptyText}</h2>
        <p className="mt-2 max-w-md text-xs leading-6 text-ink-muted">
          {currentStatus
            ? "برای دیدن وضعیت‌های دیگر، فیلتر سفارش‌ها را تغییر دهید."
            : audience === "cafe"
              ? "پس از تأیید خرید در مقایسه پیشنهادها، سفارش‌ها اینجا نمایش داده می‌شوند."
              : "سفارش‌های کافه‌ها پس از ثبت، در این فهرست قرار می‌گیرند."}
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-surface-subtle text-xs text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-3 text-start font-black">شماره سفارش</th>
              <th scope="col" className="px-4 py-3 text-start font-black">{audience === "cafe" ? "تأمین‌کننده" : "کافه"}</th>
              <th scope="col" className="px-4 py-3 text-start font-black">اقلام</th>
              <th scope="col" className="px-4 py-3 text-start font-black">مبلغ کل</th>
              <th scope="col" className="px-4 py-3 text-start font-black">وضعیت</th>
              <th scope="col" className="px-4 py-3 text-start font-black">زمان تحویل</th>
              <th scope="col" className="px-4 py-3 text-start font-black">تاریخ ثبت</th>
              <th scope="col" className="px-4 py-3 text-end font-black">مشاهده</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((order) => (
              <tr key={order.id} className="transition hover:bg-surface-subtle/60">
                <td className="px-4 py-4">
                  <span dir="ltr" className="inline-block font-black text-ink">{order.orderNumber}</span>
                </td>
                <td className="px-4 py-4 font-bold text-ink">{order.partyName}</td>
                <td className="px-4 py-4 text-ink-muted">{formatPersianNumber(order.itemCount)} قلم</td>
                <td className="px-4 py-4 font-black text-ink">{formatToman(order.totalAmount)}</td>
                <td className="px-4 py-4"><OrderStatusBadge status={order.status} audience={audience} /></td>
                <td className="px-4 py-4 text-ink-muted">{deliveryLabel(order.deliveryDays)}</td>
                <td className="px-4 py-4 text-xs text-ink-muted">{formatPersianDateTime(order.createdAt)}</td>
                <td className="px-4 py-4 text-end">
                  <Link
                    href={`${basePath}/${order.id}`}
                    aria-label={`مشاهده سفارش ${order.orderNumber}`}
                    className="inline-flex min-h-10 items-center gap-1 rounded-control px-3 text-xs font-black text-primary transition hover:bg-primary-soft"
                  >
                    مشاهده
                    <IconArrowLeft className="size-4" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-line md:hidden">
        {items.map((order) => (
          <article key={order.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-ink-muted">شماره سفارش</p>
                <h2 dir="ltr" className="mt-1 text-start text-sm font-black text-ink">{order.orderNumber}</h2>
              </div>
              <OrderStatusBadge status={order.status} audience={audience} />
            </div>
            <p className="mt-4 text-sm font-black text-ink">{order.partyName}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 rounded-control bg-surface-subtle p-3 text-xs">
              <MobileMeta icon={<IconPackage className="size-4" />} label="اقلام" value={`${formatPersianNumber(order.itemCount)} قلم`} />
              <MobileMeta icon={<IconClock className="size-4" />} label="تحویل" value={deliveryLabel(order.deliveryDays)} />
              <MobileMeta icon={<IconShoppingBag className="size-4" />} label="مبلغ کل" value={formatToman(order.totalAmount)} />
              <MobileMeta icon={<IconCalendar className="size-4" />} label="تاریخ ثبت" value={formatPersianDateTime(order.createdAt)} />
            </dl>
            <Link
              href={`${basePath}/${order.id}`}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-primary/25 bg-primary-soft px-4 text-sm font-black text-primary"
            >
              مشاهده سفارش
              <IconArrowLeft className="size-4" aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>

      <AdminPagination
        pagination={pagination}
        entityLabel="سفارش"
        previousHref={orderListHref(basePath, currentStatus, pagination.page - 1)}
        nextHref={orderListHref(basePath, currentStatus, pagination.page + 1)}
      />
    </section>
  );
}

function MobileMeta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[10px] font-bold text-ink-muted">
        <span className="text-primary" aria-hidden="true">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 break-words font-black leading-5 text-ink">{value}</dd>
    </div>
  );
}
