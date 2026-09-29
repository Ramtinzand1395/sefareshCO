import {
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconUsers,
} from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/app/(dashboard)/admin/_components/admin-page-header";
import { UserStatusBadge } from "@/app/(dashboard)/admin/_components/status-badge";
import {
  ADMIN_USER_PAGE_SIZES,
  parseAdminUserListQuery,
  type AdminUserListQuery,
} from "@/src/domain/admin";
import { requireAdminUser } from "@/src/lib/auth-helpers";
import {
  formatPersianDate,
  formatPersianNumber,
} from "@/src/lib/persian-format";
import { getAdminUsers } from "@/src/services/admin-service";

export const metadata: Metadata = { title: "کاربران" };
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function usersHref(query: AdminUserListQuery, page: number) {
  const params = new URLSearchParams();
  if (query.query) params.set("q", query.query);
  if (query.status !== "all") params.set("status", query.status);
  if (query.kind !== "all") params.set("kind", query.kind);
  if (query.onboarding !== "all") params.set("onboarding", query.onboarding);
  if (query.pageSize !== 20) params.set("pageSize", String(query.pageSize));
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/admin/users?${suffix}` : "/admin/users";
}

function userTypes(user: {
  isAdmin: boolean;
  hasCafeMembership: boolean;
  hasSupplierMembership: boolean;
}) {
  const types = [
    user.isAdmin ? "مدیر سیستم" : null,
    user.hasCafeMembership ? "کافه" : null,
    user.hasSupplierMembership ? "تأمین‌کننده" : null,
  ].filter(Boolean);
  return types.length ? types.join("، ") : "بدون کسب‌وکار";
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const query = parseAdminUserListQuery(await searchParams);
  const actor = await requireAdminUser();
  const result = await getAdminUsers(actor.id, query);

  if (result.total > 0 && query.page > result.totalPages) {
    redirect(usersHref(query, result.totalPages));
  }

  const firstItem = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const lastItem = Math.min(result.page * result.pageSize, result.total);
  const hasFilters =
    query.query ||
    query.status !== "all" ||
    query.kind !== "all" ||
    query.onboarding !== "all";

  return (
    <section className="mx-auto w-full max-w-7xl">
      <AdminPageHeader
        title="کاربران"
        description="حساب‌های سامانه را جست‌وجو کنید و ارتباط هر کاربر با کافه یا تأمین‌کننده را ببینید."
        meta={`${formatPersianNumber(result.total)} نتیجه`}
      />

      <form
        method="get"
        className="mt-7 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(16rem,2fr)_repeat(4,minmax(9rem,1fr))_auto]">
          <label className="relative block">
            <span className="sr-only">جست‌وجوی کاربر</span>
            <IconSearch
              className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              name="q"
              defaultValue={query.query}
              placeholder="نام، ایمیل یا موبایل"
              className="min-h-11 w-full rounded-xl border border-line bg-surface pe-3 ps-10 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-primary"
            />
          </label>

          <label>
            <span className="sr-only">وضعیت حساب</span>
            <select
              name="status"
              defaultValue={query.status}
              className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-bold text-ink outline-none focus:border-primary"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="active">فعال</option>
              <option value="pending">در انتظار</option>
              <option value="suspended">تعلیق‌شده</option>
              <option value="disabled">غیرفعال</option>
            </select>
          </label>

          <label>
            <span className="sr-only">نوع ارتباط</span>
            <select
              name="kind"
              defaultValue={query.kind}
              className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-bold text-ink outline-none focus:border-primary"
            >
              <option value="all">همه نقش‌ها</option>
              <option value="admin">مدیر سیستم</option>
              <option value="cafe">عضو کافه</option>
              <option value="supplier">عضو تأمین‌کننده</option>
              <option value="unassigned">بدون کسب‌وکار</option>
            </select>
          </label>

          <label>
            <span className="sr-only">وضعیت تکمیل عضویت</span>
            <select
              name="onboarding"
              defaultValue={query.onboarding}
              className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-bold text-ink outline-none focus:border-primary"
            >
              <option value="all">همه عضویت‌ها</option>
              <option value="complete">عضویت تکمیل‌شده</option>
              <option value="incomplete">عضویت ناقص</option>
            </select>
          </label>

          <label>
            <span className="sr-only">تعداد در صفحه</span>
            <select
              name="pageSize"
              defaultValue={query.pageSize}
              className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-bold text-ink outline-none focus:border-primary"
            >
              {ADMIN_USER_PAGE_SIZES.map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {formatPersianNumber(pageSize)} در صفحه
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="min-h-11 rounded-xl bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover"
          >
            اعمال فیلتر
          </button>
        </div>

        {hasFilters ? (
          <div className="mt-3 flex justify-end">
            <Link
              href="/admin/users"
              className="text-xs font-black text-primary transition hover:text-primary-hover"
            >
              پاک‌کردن فیلترها
            </Link>
          </div>
        ) : null}
      </form>

      <div className="mt-5 overflow-hidden rounded-card border border-line bg-surface shadow-card">
        {result.items.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] border-collapse text-right">
                <thead className="bg-surface-subtle text-xs font-black text-ink-muted">
                  <tr>
                    <th className="px-5 py-3.5">کاربر</th>
                    <th className="px-5 py-3.5">ارتباط</th>
                    <th className="px-5 py-3.5">وضعیت</th>
                    <th className="px-5 py-3.5">تاریخ عضویت</th>
                    <th className="px-5 py-3.5">آخرین ورود</th>
                    <th className="px-5 py-3.5"><span className="sr-only">جزئیات</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {result.items.map((user) => (
                    <tr key={user.id} className="transition hover:bg-surface-subtle/70">
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="font-black text-ink transition hover:text-primary"
                        >
                          {user.displayName}
                        </Link>
                        <p className="mt-1 text-xs text-ink-muted" dir="ltr">
                          {user.email || "ایمیل ثبت نشده"}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-sm text-ink-muted">
                        {userTypes(user)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <UserStatusBadge status={user.status} />
                          {!user.onboardingCompleted ? (
                            <span className="text-[11px] font-bold text-warning">عضویت ناقص</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs font-bold text-ink-muted">
                        {formatPersianDate(user.createdAt)}
                      </td>
                      <td className="px-5 py-4 text-xs font-bold text-ink-muted">
                        {formatPersianDate(user.lastLoginAt)}
                      </td>
                      <td className="px-5 py-4 text-left">
                        <Link
                          href={`/admin/users/${user.id}`}
                          aria-label={`مشاهده جزئیات ${user.displayName}`}
                          className="inline-grid size-9 place-items-center rounded-lg text-primary transition hover:bg-primary-soft"
                        >
                          <IconArrowLeft className="size-4" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-line md:hidden">
              {result.items.map((user) => (
                <li key={user.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="block truncate text-sm font-black text-ink"
                      >
                        {user.displayName}
                      </Link>
                      <p className="mt-1 truncate text-xs text-ink-muted" dir="ltr">
                        {user.email || "ایمیل ثبت نشده"}
                      </p>
                    </div>
                    <UserStatusBadge status={user.status} />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="text-ink-muted">ارتباط</dt>
                      <dd className="mt-1 font-bold text-ink">{userTypes(user)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">تاریخ عضویت</dt>
                      <dd className="mt-1 font-bold text-ink">
                        {formatPersianDate(user.createdAt)}
                      </dd>
                    </div>
                  </dl>
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-black text-primary"
                  >
                    مشاهده جزئیات
                    <IconArrowLeft className="size-4" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="px-5 py-16 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
              <IconUsers className="size-7" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-base font-black text-ink">کاربری پیدا نشد</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">
              {hasFilters
                ? "عبارت جست‌وجو یا فیلترها را تغییر دهید."
                : "هنوز هیچ حساب کاربری در سامانه ثبت نشده است."}
            </p>
            {hasFilters ? (
              <Link
                href="/admin/users"
                className="mt-5 inline-flex min-h-10 items-center rounded-xl border border-line px-4 text-sm font-black text-primary"
              >
                نمایش همه کاربران
              </Link>
            ) : null}
          </div>
        )}

        {result.total > 0 ? (
          <div className="flex flex-col gap-3 border-t border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-xs font-bold text-ink-muted">
              نمایش {formatPersianNumber(firstItem)} تا {formatPersianNumber(lastItem)} از {formatPersianNumber(result.total)}
            </p>
            <nav aria-label="صفحه‌بندی کاربران" className="flex items-center gap-2">
              {result.page > 1 ? (
                <Link
                  href={usersHref(query, result.page - 1)}
                  aria-label="صفحه قبل"
                  className="grid size-10 place-items-center rounded-xl border border-line text-ink transition hover:border-primary hover:text-primary"
                >
                  <IconChevronRight className="size-5" aria-hidden="true" />
                </Link>
              ) : (
                <span className="grid size-10 place-items-center rounded-xl border border-line text-line" aria-hidden="true">
                  <IconChevronRight className="size-5" />
                </span>
              )}
              <span className="min-w-24 text-center text-xs font-black text-ink">
                صفحه {formatPersianNumber(result.page)} از {formatPersianNumber(result.totalPages)}
              </span>
              {result.page < result.totalPages ? (
                <Link
                  href={usersHref(query, result.page + 1)}
                  aria-label="صفحه بعد"
                  className="grid size-10 place-items-center rounded-xl border border-line text-ink transition hover:border-primary hover:text-primary"
                >
                  <IconChevronLeft className="size-5" aria-hidden="true" />
                </Link>
              ) : (
                <span className="grid size-10 place-items-center rounded-xl border border-line text-line" aria-hidden="true">
                  <IconChevronLeft className="size-5" />
                </span>
              )}
            </nav>
          </div>
        ) : null}
      </div>
    </section>
  );
}
