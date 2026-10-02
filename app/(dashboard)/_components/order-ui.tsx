import {
  IconAlertCircle,
  IconBox,
  IconCheck,
  IconClock,
  IconPackage,
  IconReceipt,
  IconTruckDelivery,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";

import type {
  OrderFinancialSummaryDTO,
  OrderItemSnapshotDTO,
  OrderTimelineDTO,
} from "@/src/domain/order";
import type { OrderStatus } from "@/model/order";
import {
  formatPersianDateTime,
  formatPersianNumber,
  formatToman,
} from "@/src/lib/persian-format";

export const orderStatuses: OrderStatus[] = [
  "placed",
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
  "rejected",
  "cancelled",
];

const cafeStatusLabels: Record<OrderStatus, string> = {
  placed: "در انتظار تأیید تأمین‌کننده",
  confirmed: "تأییدشده",
  preparing: "در حال آماده‌سازی",
  shipped: "ارسال‌شده",
  delivered: "تحویل‌شده",
  rejected: "ردشده",
  cancelled: "لغوشده",
};

const supplierStatusLabels: Record<OrderStatus, string> = {
  ...cafeStatusLabels,
  placed: "جدید",
};

const statusClasses: Record<OrderStatus, string> = {
  placed: "border-warning/25 bg-warning-soft text-warning",
  confirmed: "border-primary/20 bg-primary-soft text-primary",
  preparing: "border-violet/20 bg-violet-soft text-violet",
  shipped: "border-primary/20 bg-primary-soft text-primary",
  delivered: "border-success/25 bg-success-soft text-success",
  rejected: "border-danger/25 bg-danger-soft text-danger",
  cancelled: "border-line bg-surface-subtle text-ink-muted",
};

export function getOrderStatusLabel(
  status: OrderStatus,
  audience: "cafe" | "supplier" = "cafe",
) {
  return audience === "supplier"
    ? supplierStatusLabels[status]
    : cafeStatusLabels[status];
}

export function OrderStatusBadge({
  status,
  audience = "cafe",
}: {
  status: OrderStatus;
  audience?: "cafe" | "supplier";
}) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black ${statusClasses[status]}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {getOrderStatusLabel(status, audience)}
    </span>
  );
}

export function orderListHref(
  basePath: string,
  status?: OrderStatus,
  page = 1,
) {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return suffix ? `${basePath}?${suffix}` : basePath;
}

export function OrderStatusFilters({
  basePath,
  currentStatus,
  audience,
}: {
  basePath: string;
  currentStatus?: OrderStatus;
  audience: "cafe" | "supplier";
}) {
  const options: Array<{ value?: OrderStatus; label: string }> = [
    { label: "همه" },
    ...orderStatuses.map((status) => ({
      value: status,
      label: getOrderStatusLabel(status, audience),
    })),
  ];

  return (
    <nav aria-label="فیلتر وضعیت سفارش" className="overflow-x-auto pb-1">
      <div className="flex min-w-max gap-2">
        {options.map((option) => {
          const active = option.value === currentStatus;
          return (
            <Link
              key={option.value ?? "all"}
              href={orderListHref(basePath, option.value)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-10 items-center rounded-control border px-3 text-xs font-black transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                active
                  ? "border-primary bg-primary text-white"
                  : "border-line bg-surface text-ink-muted hover:border-primary hover:text-primary"
              }`}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function deliveryLabel(days: number) {
  if (days === 0) return "امروز";
  return `${formatPersianNumber(days)} روز`;
}

export function quantityLabel(quantity: number, unit: string) {
  return `${formatPersianNumber(quantity)} ${unit || "واحد"}`;
}

export function OrderItems({ items }: { items: OrderItemSnapshotDTO[] }) {
  return (
    <section
      aria-labelledby="order-items-heading"
      className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
    >
      <header className="border-b border-line px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <IconPackage className="size-5 text-primary" aria-hidden="true" />
          <h2 id="order-items-heading" className="text-base font-black text-ink">
            اقلام سفارش
          </h2>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          {formatPersianNumber(items.length)} قلم بر اساس اطلاعات ثبت‌شده هنگام سفارش
        </p>
      </header>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[680px] text-start text-sm">
          <thead className="bg-surface-subtle text-xs text-ink-muted">
            <tr>
              <th scope="col" className="px-5 py-3 text-start font-black">کالا</th>
              <th scope="col" className="px-4 py-3 text-start font-black">مقدار</th>
              <th scope="col" className="px-4 py-3 text-start font-black">قیمت واحد</th>
              <th scope="col" className="px-5 py-3 text-end font-black">جمع</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-5 py-4">
                  <p className="font-black text-ink">{item.title}</p>
                  {item.brand ? <p className="mt-1 text-xs text-ink-muted">برند: {item.brand}</p> : null}
                </td>
                <td className="px-4 py-4 font-bold text-ink">{quantityLabel(item.quantity, item.unit)}</td>
                <td className="px-4 py-4 font-bold text-ink">{formatToman(item.unitPrice)}</td>
                <td className="px-5 py-4 text-end font-black text-ink">{formatToman(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-line md:hidden">
        {items.map((item) => (
          <article key={item.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words text-sm font-black text-ink">{item.title}</h3>
                {item.brand ? <p className="mt-1 text-xs text-ink-muted">برند: {item.brand}</p> : null}
              </div>
              <p className="shrink-0 text-sm font-black text-primary">{formatToman(item.subtotal)}</p>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 rounded-control bg-surface-subtle p-3 text-xs">
              <div>
                <dt className="text-ink-muted">مقدار</dt>
                <dd className="mt-1 font-black text-ink">{quantityLabel(item.quantity, item.unit)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">قیمت واحد</dt>
                <dd className="mt-1 font-black text-ink">{formatToman(item.unitPrice)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

export function OrderFinancialSummary({
  financials,
}: {
  financials: OrderFinancialSummaryDTO;
}) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card" aria-labelledby="financial-heading">
      <div className="flex items-center gap-2">
        <IconReceipt className="size-5 text-primary" aria-hidden="true" />
        <h2 id="financial-heading" className="text-base font-black text-ink">خلاصه مبلغ سفارش</h2>
      </div>
      <dl className="mt-4 space-y-3 text-sm">
        <SummaryRow label="جمع کالاها" value={formatToman(financials.itemsSubtotal)} />
        <SummaryRow label="هزینه ارسال" value={formatToman(financials.shippingCost)} />
        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <dt className="font-black text-ink">مبلغ کل</dt>
          <dd className="text-base font-black text-primary">{formatToman(financials.totalAmount)}</dd>
        </div>
      </dl>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-black text-ink">{value}</dd>
    </div>
  );
}

type TimelineEvent = {
  key: keyof OrderTimelineDTO;
  label: string;
  icon: typeof IconClock;
  tone: string;
};

const timelineEvents: TimelineEvent[] = [
  { key: "placedAt", label: "ثبت سفارش", icon: IconReceipt, tone: "bg-primary-soft text-primary" },
  { key: "confirmedAt", label: "تأیید تأمین‌کننده", icon: IconCheck, tone: "bg-success-soft text-success" },
  { key: "preparingAt", label: "شروع آماده‌سازی", icon: IconBox, tone: "bg-violet-soft text-violet" },
  { key: "shippedAt", label: "ارسال سفارش", icon: IconTruckDelivery, tone: "bg-primary-soft text-primary" },
  { key: "deliveredAt", label: "تحویل سفارش", icon: IconCheck, tone: "bg-success-soft text-success" },
  { key: "rejectedAt", label: "رد سفارش توسط تأمین‌کننده", icon: IconX, tone: "bg-danger-soft text-danger" },
  { key: "cancelledAt", label: "لغو سفارش", icon: IconX, tone: "bg-surface-subtle text-ink-muted" },
];

export function OrderTimeline({ timeline }: { timeline: OrderTimelineDTO }) {
  const visibleEvents = timelineEvents.filter((event) => timeline[event.key]);
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card" aria-labelledby="timeline-heading">
      <div className="flex items-center gap-2">
        <IconClock className="size-5 text-primary" aria-hidden="true" />
        <h2 id="timeline-heading" className="text-base font-black text-ink">روند سفارش</h2>
      </div>
      <ol className="mt-5 space-y-0">
        {visibleEvents.map((event, index) => {
          const Icon = event.icon;
          const value = timeline[event.key];
          return (
            <li key={event.key} className="relative flex gap-3 pb-5 last:pb-0">
              {index < visibleEvents.length - 1 ? (
                <span className="absolute right-4 top-8 h-[calc(100%-1.5rem)] w-px bg-line" aria-hidden="true" />
              ) : null}
              <span className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full ${event.tone}`}>
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-black text-ink">{event.label}</p>
                <time className="mt-1 block text-xs text-ink-muted" dateTime={value ?? undefined}>
                  {formatPersianDateTime(value)}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function OrderStateNotice({
  status,
  reason,
}: {
  status: OrderStatus;
  reason?: string | null;
}) {
  if (!["rejected", "cancelled", "delivered", "preparing", "shipped"].includes(status)) {
    return null;
  }
  const content = {
    rejected: { title: "این سفارش توسط تأمین‌کننده رد شده است.", label: "دلیل رد", tone: "border-danger/25 bg-danger-soft text-danger" },
    cancelled: { title: "این سفارش لغو شده است.", label: "دلیل لغو", tone: "border-line bg-surface-subtle text-ink-muted" },
    delivered: { title: "سفارش تحویل شده است.", label: "", tone: "border-success/25 bg-success-soft text-success" },
    preparing: { title: "سفارش در حال آماده‌سازی است.", label: "", tone: "border-violet/20 bg-violet-soft text-violet" },
    shipped: { title: "سفارش ارسال شده است.", label: "یادداشت ارسال", tone: "border-primary/20 bg-primary-soft text-primary" },
  }[status as "rejected" | "cancelled" | "delivered" | "preparing" | "shipped"];

  return (
    <section className={`rounded-card border p-4 ${content.tone}`}>
      <div className="flex items-start gap-3">
        <IconAlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-black">{content.title}</h2>
          {reason ? <p className="mt-2 text-xs leading-6"><span className="font-black">{content.label}:</span> {reason}</p> : null}
        </div>
      </div>
    </section>
  );
}

export function safeOrderError(message?: string, fallback = "دریافت اطلاعات سفارش انجام نشد. لطفاً دوباره تلاش کنید.") {
  if (!message || /mongo|mongoose|validation failed|cast to|stack|zod|\bat\s+\w+/i.test(message)) {
    return fallback;
  }
  return message.slice(0, 300);
}
