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

const businessStatusClasses: Record<string, string> = {
  active: "bg-success-soft text-success",
  pending: "bg-warning-soft text-warning",
  suspended: "bg-danger-soft text-danger",
  rejected: "bg-surface-subtle text-ink-muted",
  deleted: "bg-surface-subtle text-ink-muted",
};

const verificationConfig = {
  verified: {
    label: "تأییدشده",
    className: "bg-success-soft text-success",
  },
  unverified: {
    label: "تأییدنشده",
    className: "bg-warning-soft text-warning",
  },
} as const;

const badgeClassName =
  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black";

export function UserStatusBadge({ status }: { status: string }) {
  const config = userStatusConfig[status as UserStatus] ?? {
    label: status,
    className: "bg-surface-subtle text-ink-muted",
  };
  return (
    <span
      className={`${badgeClassName} ${config.className}`}
    >
      {config.label}
    </span>
  );
}

export function MembershipStatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={`${badgeClassName} ${
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

export function BusinessStatusBadge({ status }: { status: string }) {
  const className =
    businessStatusClasses[status] ?? "bg-surface-subtle text-ink-muted";
  return (
    <span
      className={`${badgeClassName} ${className}`}
    >
      {businessStatusLabel(status)}
    </span>
  );
}

export function VerificationBadge({ isVerified }: { isVerified: boolean }) {
  const config = isVerified
    ? verificationConfig.verified
    : verificationConfig.unverified;

  return (
    <span className={`${badgeClassName} ${config.className}`}>
      {config.label}
    </span>
  );
}
