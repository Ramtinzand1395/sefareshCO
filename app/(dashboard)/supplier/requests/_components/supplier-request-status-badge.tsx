import {
  IconBan,
  IconCircleCheck,
  IconClock,
  IconX,
} from "@tabler/icons-react";

import type { SupplierRequestStatus } from "@/src/domain/supplier-request";

const statusConfig = {
  pending: {
    label: "در انتظار پاسخ",
    className: "bg-warning-soft text-warning",
    icon: IconClock,
  },
  responded: {
    label: "پاسخ داده‌شده",
    className: "bg-success-soft text-success",
    icon: IconCircleCheck,
  },
  declined: {
    label: "ردشده",
    className: "bg-danger-soft text-danger",
    icon: IconX,
  },
  cancelled: {
    label: "لغوشده",
    className: "bg-surface-subtle text-ink-muted",
    icon: IconBan,
  },
} satisfies Record<
  SupplierRequestStatus,
  { label: string; className: string; icon: typeof IconClock }
>;

export function SupplierRequestStatusBadge({
  status,
}: {
  status: SupplierRequestStatus;
}) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-black ${config.className}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {config.label}
    </span>
  );
}

export function supplierRequestStatusLabel(status: SupplierRequestStatus) {
  return statusConfig[status].label;
}
