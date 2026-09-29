import type { Metadata } from "next";
import Link from "next/link";

import { getAdminCafeList } from "@/src/services/admin-cafe-service";
import type { CafeStatus } from "@/src/domain/schemas/admin-cafe";

export const metadata: Metadata = { title: "کافه‌ها — پنل مدیریت" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusLabels: Record<string, string> = {
  pending: "در انتظار",
  active: "فعال",
  suspended: "تعلیق‌شده",
  rejected: "رد‌شده",
};

const statusColors: Record<string, string> = {
  active: "bg-success-soft text-success",
  pending: "bg-warning-soft text-warning",
  suspended: "bg-danger-soft text-danger",
  rejected: "bg-surface-subtle text-ink-muted",
};

const typeLabels: Record<string, string> = {
  cafe: "کافه",
  restaurant: "رستوران",
  fast_food: "فست‌فود",
  bakery: "نانوایی / قنادی",
  catering: "کترینگ",
  other: "سایر",
};

const statusOptions = [
  { value: "", label: "همه وضعیت‌ها" },
  { value: "active", label: "فعال" },
  { value: "pending", label: "در انتظار" },
  { value: "suspended", label: "تعلیق‌شده" },
  { value: "rejected", label: "رد‌شده" },
];

const validStatuses = new Set(["pending", "active", "suspended", "rejected"]);

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fa-IR");
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors = statusColors[status] ?? "bg-surface-subtle text-ink-muted";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-black ${colors}`}
    >
      {statusLabels[status] ?? status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminCafesPage({ searchParams }: Props) {
  const params = await searchParams;

  const page = Math.max(1, Number(params.page) || 1);
  const search =
    typeof params.search === "string" ? params.search.trim() : undefined;
  const statusParam =
    typeof params.status === "string" ? params.status : undefined;
  const status =
    statusParam && validStatuses.has(statusParam)
      ? (statusParam as CafeStatus)
      : undefined;

  const { items, pagination } = await getAdminCafeList({
    page,
    pageSize: 20,
    search: search || undefined,
    status,
  });

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      search: search ?? "",
      status: statusParam ?? "",
      page: String(page),
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v);
    }
    return `/admin/cafes?${p.toString()}`;
  }

  const hasFilters = search || statusParam;

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6">
      {/* Header */}
      <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
        <p className="text-sm font-black text-primary">پنل مدیریت</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          کافه‌ها و رستوران‌ها
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-muted sm:text-base">
          کافه‌ها و رستوران‌های عضو را مدیریت کنید.
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
        <form className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="search"
              className="mb-1 block text-xs font-bold text-ink-muted"
            >
              جستجو
            </label>
            <input
              id="search"
              name="search"
              type="text"
              defaultValue={search ?? ""}
              placeholder="نام، موبایل، تلفن، شهر…"
              className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary"
            />
          </div>

          <div>
            <label
              htmlFor="status"
              className="mb-1 block text-xs font-bold text-ink-muted"
            >
              وضعیت
            </label>
            <select
              id="status"
              name="status"
              defaultValue={statusParam ?? ""}
              className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="h-10 rounded-lg bg-primary px-5 text-sm font-black text-white transition hover:bg-primary/90"
          >
            اعمال
          </button>

          {hasFilters && (
            <Link
              href="/admin/cafes"
              className="flex h-10 items-center rounded-lg border border-line px-4 text-sm font-bold text-ink-muted transition hover:border-primary hover:text-primary"
            >
              پاک‌سازی
            </Link>
          )}
        </form>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-line bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-muted">
                <th className="px-4 py-3 text-start font-bold">نام</th>
                <th className="hidden px-4 py-3 text-start font-bold sm:table-cell">
                  نوع
                </th>
                <th className="hidden px-4 py-3 text-start font-bold md:table-cell">
                  شهر
                </th>
                <th className="hidden px-4 py-3 text-start font-bold sm:table-cell">
                  تماس
                </th>
                <th className="px-4 py-3 text-start font-bold">وضعیت</th>
                <th className="hidden px-4 py-3 text-start font-bold lg:table-cell">
                  عضویت
                </th>
                <th className="px-4 py-3 text-start font-bold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-ink-muted"
                  >
                    کافه‌ای یافت نشد
                  </td>
                </tr>
              ) : (
                items.map((cafe) => (
                  <tr
                    key={cafe.id}
                    className="border-b border-line last:border-0 transition hover:bg-surface-subtle"
                  >
                    <td className="px-4 py-3 font-bold text-ink">
                      {cafe.name}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-ink-muted sm:table-cell">
                      {typeLabels[cafe.type] ?? cafe.type}
                    </td>
                    <td className="hidden px-4 py-3 text-ink-muted md:table-cell">
                      {cafe.city
                        ? `${cafe.city}${cafe.province ? `، ${cafe.province}` : ""}`
                        : "—"}
                    </td>
                    <td
                      className="hidden px-4 py-3 text-xs text-ink-muted sm:table-cell"
                      dir="ltr"
                    >
                      {cafe.mobile || cafe.phone || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={cafe.status} />
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-ink-muted lg:table-cell">
                      {formatDate(cafe.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/cafes/${cafe.id}`}
                        className="text-xs font-black text-primary transition hover:text-primary/80"
                      >
                        جزئیات
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-4 py-3">
            <p className="text-xs text-ink-muted">
              صفحه {pagination.page.toLocaleString("fa-IR")} از{" "}
              {pagination.totalPages.toLocaleString("fa-IR")} — مجموع{" "}
              {pagination.total.toLocaleString("fa-IR")} کافه
            </p>
            <div className="flex gap-2">
              {pagination.hasPreviousPage && (
                <Link
                  href={buildUrl({ page: String(pagination.page - 1) })}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-muted transition hover:border-primary hover:text-primary"
                >
                  قبلی
                </Link>
              )}
              {pagination.hasNextPage && (
                <Link
                  href={buildUrl({ page: String(pagination.page + 1) })}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-muted transition hover:border-primary hover:text-primary"
                >
                  بعدی
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
