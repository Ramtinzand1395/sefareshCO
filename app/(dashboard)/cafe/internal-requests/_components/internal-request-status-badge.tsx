import {
  IconBan,
  IconCircleCheck,
  IconClockHour4,
  IconMinus,
  IconX,
  type Icon,
} from "@tabler/icons-react";

import type {
  InternalRequestItemStatus,
  InternalRequestStatus,
} from "@/src/domain/internal-purchase-request";

type Status = InternalRequestStatus | InternalRequestItemStatus;

const statusConfig: Record<
  Status,
  { label: string; className: string; icon: Icon }
> = {
  pending: {
    label: "در انتظار بررسی",
    className: "bg-warning-soft text-warning",
    icon: IconClockHour4,
  },
  approved: {
    label: "تأیید شده",
    className: "bg-success-soft text-success",
    icon: IconCircleCheck,
  },
  partially_approved: {
    label: "تأیید جزئی",
    className: "bg-violet-soft text-violet",
    icon: IconMinus,
  },
  rejected: {
    label: "رد شده",
    className: "bg-danger-soft text-danger",
    icon: IconX,
  },
  cancelled: {
    label: "لغو شده",
    className: "bg-surface-subtle text-ink-muted",
    icon: IconBan,
  },
};

export function internalRequestStatusLabel(status: Status) {
  return statusConfig[status].label;
}

export function InternalRequestStatusBadge({ status }: { status: Status }) {
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
