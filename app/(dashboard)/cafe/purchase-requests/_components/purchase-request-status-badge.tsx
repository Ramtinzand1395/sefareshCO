import {
  IconBan,
  IconCircleCheck,
  IconFilePencil,
  type Icon,
} from "@tabler/icons-react";

import type { PurchaseRequestStatus } from "@/src/domain/purchase-request";

const statusConfig: Record<
  PurchaseRequestStatus,
  { label: string; className: string; icon: Icon }
> = {
  draft: {
    label: "پیش‌نویس",
    className: "bg-warning-soft text-warning",
    icon: IconFilePencil,
  },
  submitted: {
    label: "ارسال‌شده",
    className: "bg-success-soft text-success",
    icon: IconCircleCheck,
  },
  cancelled: {
    label: "لغوشده",
    className: "bg-surface-subtle text-ink-muted",
    icon: IconBan,
  },
};

export function purchaseRequestStatusLabel(status: PurchaseRequestStatus) {
  return statusConfig[status].label;
}

export function PurchaseRequestStatusBadge({
  status,
}: {
  status: PurchaseRequestStatus;
}) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${config.className}`}
    >
      <StatusIcon className="size-3.5" aria-hidden="true" />
      {config.label}
    </span>
  );
}
