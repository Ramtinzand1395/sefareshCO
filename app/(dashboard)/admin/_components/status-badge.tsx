import type { UserStatus } from "@/model/user";

const userStatusConfig: Record<
  UserStatus,
  { label: string; className: string }
> = {
  active: { label: "فعال", className: "bg-success-soft text-success" },
  pending: { label: "در انتظار", className: "bg-warning-soft text-warning" },
  suspended: { label: "تعلیق‌شده", className: "bg-danger-soft text-danger" },
  disabled: { label: "غیرفعال", className: "bg-surface-subtle text-ink-muted" },
};

const membershipStatusLabels: Record<string, string> = {
  invited: "دعوت‌شده",
  active: "فعال",
  suspended: "تعلیق‌شده",
  removed: "حذف‌شده",
};

const businessStatusLabels: Record<string, string> = {
  pending: "در انتظار بررسی",
  active: "فعال",
  suspended: "تعلیق‌شده",
  rejected: "ردشده",
  deleted: "حذف‌شده",
};

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const config = userStatusConfig[status];
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${config.className}`}
    >
      {config.label}
    </span>
  );
}

export function MembershipStatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${
        active ? "bg-success-soft text-success" : "bg-surface-subtle text-ink-muted"
      }`}
    >
      {membershipStatusLabels[status] ?? status}
    </span>
  );
}

export function businessStatusLabel(status: string) {
  return businessStatusLabels[status] ?? status;
}
