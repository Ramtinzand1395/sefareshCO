import type { Metadata } from "next";

import { getAdminDashboardOverview } from "@/src/services/admin-dashboard-service";
import type { AdminDashboardOverviewDTO } from "@/src/services/admin-dashboard-service";

export const metadata: Metadata = { title: "داشبورد مدیریت" };

// ---------------------------------------------------------------------------
// Stat card – reusable presentational component
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-4 shadow-card">
      <p className="text-xs font-bold text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-black text-ink">{value.toLocaleString("fa-IR")}</p>
      {detail && (
        <p className="mt-1 text-xs text-ink-muted">{detail}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent activity table
// ---------------------------------------------------------------------------

function RecentTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="rounded-xl border border-line bg-surface shadow-card">
      <div className="border-b border-line px-4 py-3">
        <h3 className="text-sm font-black text-ink">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-ink-muted">
              {headers.map((h) => (
                <th key={h} className="px-4 py-2 text-start font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-4 py-6 text-center text-xs text-ink-muted"
                >
                  موردی یافت نشد
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-2.5 text-ink">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status label helper
// ---------------------------------------------------------------------------

const statusLabels: Record<string, string> = {
  active: "فعال",
  pending: "در انتظار",
  suspended: "تعلیق‌شده",
  disabled: "غیرفعال",
  rejected: "رد‌شده",
};

function statusLabel(status: string) {
  return statusLabels[status] ?? status;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fa-IR");
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Dashboard content
// ---------------------------------------------------------------------------

function DashboardContent({ data }: { data: AdminDashboardOverviewDTO }) {
  return (
    <section className="mx-auto w-full max-w-7xl space-y-8">
      {/* Header */}
      <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
        <p className="text-sm font-black text-primary">پنل مدیریت Marketplace</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          داشبورد مدیریت Marketplace
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-muted sm:text-base">
          کافه‌ها، تأمین‌کنندگان، کاتالوگ، درخواست‌ها، سفارش‌ها و عملیات مالی پلتفرم
          را پایش کنید.
        </p>
      </div>

      {/* User stats */}
      <div>
        <h2 className="mb-3 text-base font-black text-ink">کاربران</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="کل کاربران" value={data.users.total} />
          <StatCard label="فعال" value={data.users.active} />
          <StatCard label="در انتظار" value={data.users.pending} />
          <StatCard label="تعلیق‌شده" value={data.users.suspended} />
          <StatCard label="غیرفعال" value={data.users.disabled} />
        </div>
      </div>

      {/* Cafe stats */}
      <div>
        <h2 className="mb-3 text-base font-black text-ink">کافه‌ها و رستوران‌ها</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="کل کافه‌ها" value={data.cafes.total} />
          <StatCard label="فعال" value={data.cafes.active} />
          <StatCard label="در انتظار" value={data.cafes.pending} />
          <StatCard
            label="تعلیق / ردشده"
            value={data.cafes.suspended + data.cafes.rejected}
          />
        </div>
      </div>

      {/* Supplier stats */}
      <div>
        <h2 className="mb-3 text-base font-black text-ink">تأمین‌کنندگان</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="کل تأمین‌کنندگان" value={data.suppliers.total} />
          <StatCard label="فعال" value={data.suppliers.active} />
          <StatCard label="در انتظار" value={data.suppliers.pending} />
          <StatCard label="تأییدشده" value={data.suppliers.verified} />
          <StatCard label="تأییدنشده" value={data.suppliers.unverified} />
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        <RecentTable
          title="آخرین کاربران"
          headers={["نام", "ایمیل", "وضعیت", "تاریخ"]}
          rows={data.latestUsers.map((u) => [
            [u.firstName, u.lastName].filter(Boolean).join(" ") || "—",
            u.email,
            statusLabel(u.status),
            formatDate(u.createdAt),
          ])}
        />
        <RecentTable
          title="آخرین کافه‌ها"
          headers={["نام", "شهر", "وضعیت", "تاریخ"]}
          rows={data.latestCafes.map((c) => [
            c.name,
            c.city ?? "—",
            statusLabel(c.status),
            formatDate(c.createdAt),
          ])}
        />
        <RecentTable
          title="آخرین تأمین‌کنندگان"
          headers={["نام", "شهر", "تأیید", "تاریخ"]}
          rows={data.latestSuppliers.map((s) => [
            s.businessName,
            s.city ?? "—",
            s.isVerified ? "تأییدشده" : "تأییدنشده",
            formatDate(s.createdAt),
          ])}
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------

export default async function AdminPage() {
  const data = await getAdminDashboardOverview();
  return <DashboardContent data={data} />;
}
