import { AdminEmptyState, AdminSectionCard } from "@/app/(dashboard)/admin/_components/admin-ui";
import { MembershipStatusBadge } from "@/app/(dashboard)/admin/_components/status-badge";
import { formatPersianDate } from "@/src/lib/persian-format";

const memberRoleLabels: Record<string, string> = {
  owner: "مالک",
  manager: "مدیر",
  purchase_manager: "مدیر خرید",
  chef: "سرآشپز",
  accountant: "حسابدار",
  employee: "کارمند",
  sales: "فروش",
  warehouse: "انبار",
};

type Member = {
  memberId: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  status: string;
  joinedAt: string | null;
};

export function AdminMembersList({ members }: { members: Member[] }) {
  return (
    <AdminSectionCard
      title={`اعضای مجموعه (${members.length.toLocaleString("fa-IR")})`}
      description="اعضای فعال یا دعوت‌شدهٔ ثبت‌شده برای این کسب‌وکار"
    >
      {members.length === 0 ? (
        <AdminEmptyState
          compact
          title="عضوی ثبت نشده است"
          description="برای این کسب‌وکار هنوز عضو فعالی در دسترس نیست."
        />
      ) : (
        <>
          <div className="divide-y divide-line md:hidden">
            {members.map((member) => {
              const name =
                [member.firstName, member.lastName].filter(Boolean).join(" ") ||
                "بدون نام";
              return (
                <article key={member.memberId} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-ink">{name}</p>
                      <p className="mt-1 truncate text-xs text-ink-muted" dir="ltr">
                        {member.email || "—"}
                      </p>
                    </div>
                    <MembershipStatusBadge status={member.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-muted">
                    <span>{memberRoleLabels[member.role] ?? member.role}</span>
                    <span>عضویت: {formatPersianDate(member.joinedAt)}</span>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle text-xs text-ink-muted">
                <tr>
                  <th className="px-5 py-3 text-start font-bold">نام</th>
                  <th className="px-5 py-3 text-start font-bold">ایمیل</th>
                  <th className="px-5 py-3 text-start font-bold">نقش</th>
                  <th className="px-5 py-3 text-start font-bold">وضعیت</th>
                  <th className="px-5 py-3 text-start font-bold">تاریخ عضویت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {members.map((member) => (
                  <tr key={member.memberId} className="transition hover:bg-surface-subtle">
                    <td className="px-5 py-3 font-bold text-ink">
                      {[member.firstName, member.lastName]
                        .filter(Boolean)
                        .join(" ") || "بدون نام"}
                    </td>
                    <td className="px-5 py-3 text-xs text-ink-muted" dir="ltr">
                      {member.email || "—"}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {memberRoleLabels[member.role] ?? member.role}
                    </td>
                    <td className="px-5 py-3">
                      <MembershipStatusBadge status={member.status} />
                    </td>
                    <td className="px-5 py-3 text-xs text-ink-muted">
                      {formatPersianDate(member.joinedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminSectionCard>
  );
}
