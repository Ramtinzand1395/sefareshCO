import {
  IconAlertCircle,
  IconArrowRight,
  IconBuildingStore,
  IconCalendar,
  IconClock,
  IconHash,
} from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  deliveryLabel,
  OrderFinancialSummary,
  OrderItems,
  OrderStateNotice,
  OrderStatusBadge,
  OrderTimeline,
  safeOrderError,
} from "@/app/(dashboard)/_components/order-ui";
import { SupplierOrderActions } from "@/app/(dashboard)/supplier/orders/[id]/supplier-order-actions";
import { getSupplierOrderDetailAction } from "@/app/actions/orders";
import { formatPersianDateTime } from "@/src/lib/persian-format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "جزئیات سفارش دریافتی | پنل تأمین‌کننده",
};

type Props = { params: Promise<{ id: string }> };

export default async function SupplierOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const result = await getSupplierOrderDetailAction(id);
  if (!result.ok || !result.data) {
    if (result.error?.includes("یافت نشد") || result.error?.includes("شناسه سفارش معتبر نیست")) notFound();
    return <OrderDetailLoadError message={result.error} />;
  }

  const order = result.data;
  const noticeReason = order.status === "rejected"
    ? order.rejection?.rejectReason
    : order.status === "cancelled"
      ? order.cancellation?.cancelReason
      : order.status === "shipped"
        ? order.delivery.shippingNote
        : null;

  return (
    <div className="supplier-content-container space-y-6 pb-8">
      <Link href="/supplier/orders" className="inline-flex min-h-10 items-center gap-2 rounded-control text-xs font-black text-ink-muted transition hover:text-primary">
        <IconArrowRight className="size-4" aria-hidden="true" />
        بازگشت به سفارش‌های دریافتی
      </Link>

      <header className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <OrderStatusBadge status={order.status} audience="supplier" />
            <h1 className="mt-3 text-2xl font-black tracking-tight text-ink sm:text-3xl">
              سفارش <span dir="ltr" className="inline-block">{order.orderNumber}</span>
            </h1>
            <p className="mt-2 text-sm leading-7 text-ink-muted">اقلام سفارش کافه و روند آماده‌سازی و ارسال را مدیریت کنید.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-black text-primary" dir="ltr">
            <IconHash className="size-4" aria-hidden="true" />
            {order.orderNumber}
          </span>
        </div>
        <dl className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-3">
          <HeaderMeta icon={<IconBuildingStore className="size-4" />} label="کافه" value={order.cafe.businessName} />
          <HeaderMeta icon={<IconCalendar className="size-4" />} label="تاریخ ثبت" value={formatPersianDateTime(order.createdAt)} />
          <HeaderMeta icon={<IconClock className="size-4" />} label="زمان تحویل تعهدشده" value={deliveryLabel(order.delivery.deliveryDays)} />
        </dl>
      </header>

      <OrderStateNotice status={order.status} reason={noticeReason} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <main className="space-y-6">
          <OrderItems items={order.items} />
          <OrderTimeline timeline={order.timeline} />
        </main>
        <aside className="space-y-4 xl:sticky xl:top-24" aria-label="خلاصه و عملیات سفارش">
          <section className="rounded-card border border-line bg-surface p-5 shadow-card">
            <p className="text-xs font-black text-ink-muted">وضعیت فعلی</p>
            <div className="mt-3"><OrderStatusBadge status={order.status} audience="supplier" /></div>
          </section>
          <OrderFinancialSummary financials={order.financials} />
          <SupplierOrderActions orderId={order.id} allowedActions={order.allowedActions} />
        </aside>
      </div>
    </div>
  );
}

function HeaderMeta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-control bg-surface-subtle p-3">
      <dt className="flex items-center gap-1.5 text-[11px] font-bold text-ink-muted"><span className="text-primary" aria-hidden="true">{icon}</span>{label}</dt>
      <dd className="mt-1 break-words text-sm font-black text-ink">{value}</dd>
    </div>
  );
}

function OrderDetailLoadError({ message }: { message?: string }) {
  return (
    <div className="supplier-content-container">
      <section className="flex min-h-80 flex-col items-center justify-center rounded-card border border-danger/25 bg-surface p-8 text-center shadow-card">
        <IconAlertCircle className="size-11 text-danger" aria-hidden="true" />
        <h1 className="mt-4 text-lg font-black text-ink">جزئیات سفارش دریافت نشد</h1>
        <p className="mt-2 max-w-lg text-sm leading-7 text-ink-muted">{safeOrderError(message)}</p>
        <Link href="/supplier/orders" className="mt-5 inline-flex min-h-11 items-center rounded-control bg-primary px-5 text-sm font-black text-white">بازگشت به سفارش‌ها</Link>
      </section>
    </div>
  );
}
