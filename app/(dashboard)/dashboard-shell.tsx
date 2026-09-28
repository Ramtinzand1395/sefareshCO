"use client";

import {
  IconAdjustments,
  IconArrowsDiff,
  IconBell,
  IconBuildingBank,
  IconBuildingStore,
  IconCash,
  IconCategory,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardList,
  IconCreditCard,
  IconFileInvoice,
  IconLayoutDashboard,
  IconLogout,
  IconMenu2,
  IconPackage,
  IconReportAnalytics,
  IconReceipt,
  IconSettings,
  IconShoppingCart,
  IconShoppingCartCheck,
  IconTruckDelivery,
  IconUserCircle,
  IconUsers,
  IconX,
  type Icon,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";

import { logoutAction } from "@/app/actions/auth";
import { BrandLogo } from "@/app/components/brand/brand-logo";
import {
  dashboardPortals,
  getActiveNavigationHref,
  resolveDashboardRoute,
  type DashboardIconName,
  type DashboardNavigationItem,
  type DashboardPortal,
} from "@/app/(dashboard)/dashboard-config";

const icons: Record<DashboardIconName, Icon> = {
  dashboard: IconLayoutDashboard,
  "shopping-list": IconClipboardList,
  request: IconFileInvoice,
  compare: IconArrowsDiff,
  cart: IconShoppingCart,
  orders: IconShoppingCartCheck,
  suppliers: IconTruckDelivery,
  members: IconUsers,
  "internal-request": IconReceipt,
  payments: IconCreditCard,
  settings: IconSettings,
  offers: IconReceipt,
  products: IconPackage,
  finance: IconCash,
  transactions: IconReceipt,
  settlements: IconBuildingBank,
  business: IconBuildingStore,
  cafes: IconBuildingStore,
  users: IconUsers,
  catalog: IconAdjustments,
  categories: IconCategory,
  reports: IconReportAnalytics,
  notifications: IconBell,
};

function SidebarNavigation({
  items,
  activeHref,
  collapsed,
  onExpand,
  onNavigate,
}: {
  items: DashboardNavigationItem[];
  activeHref?: string;
  collapsed: boolean;
  onExpand: () => void;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="منوی اصلی پنل" className="space-y-1 px-3 py-4">
      {items.map((item) => {
        const ItemIcon = icons[item.icon];

        if (item.type === "link") {
          const active = activeHref === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={`flex min-h-11 items-center rounded-xl text-sm font-bold transition-colors ${
                collapsed ? "justify-center px-2" : "gap-3 px-3"
              } ${
                active
                  ? "bg-primary-soft text-primary"
                  : "text-ink-muted hover:bg-surface-subtle hover:text-ink"
              }`}
            >
              <ItemIcon className="size-5 shrink-0" aria-hidden="true" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        }

        const groupActive = item.children.some(
          (child) => child.href === activeHref,
        );

        if (collapsed) {
          return (
            <button
              key={item.label}
              type="button"
              onClick={onExpand}
              title={item.label}
              aria-label={`باز کردن گروه ${item.label}`}
              className={`flex min-h-11 w-full items-center justify-center rounded-xl px-2 transition-colors ${
                groupActive
                  ? "bg-primary-soft text-primary"
                  : "text-ink-muted hover:bg-surface-subtle hover:text-ink"
              }`}
            >
              <ItemIcon className="size-5" aria-hidden="true" />
            </button>
          );
        }

        return (
          <details key={item.label} className="group" open={groupActive || undefined}>
            <summary
              className={`flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-3 text-sm font-bold transition-colors [&::-webkit-details-marker]:hidden ${
                groupActive
                  ? "text-primary"
                  : "text-ink-muted hover:bg-surface-subtle hover:text-ink"
              }`}
            >
              <ItemIcon className="size-5 shrink-0" aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              <IconChevronDown
                className="size-4 transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="me-3 mt-1 space-y-1 border-r border-line pe-3">
              {item.children.map((child) => {
                const active = activeHref === child.href;
                const ChildIcon = icons[child.icon];
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-[13px] font-bold transition-colors ${
                      active
                        ? "bg-primary-soft text-primary"
                        : "text-ink-muted hover:bg-surface-subtle hover:text-ink"
                    }`}
                  >
                    <ChildIcon className="size-4 shrink-0" aria-hidden="true" />
                    {child.label}
                  </Link>
                );
              })}
            </div>
          </details>
        );
      })}
    </nav>
  );
}

function SidebarHeader({
  label,
  collapsed,
  onToggle,
  mobile = false,
}: {
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  mobile?: boolean;
}) {
  return (
    <div className="flex h-20 items-center border-b border-line px-4">
      {collapsed ? (
        <span className="grid size-10 place-items-center rounded-xl bg-primary text-lg font-black text-white">
          س
        </span>
      ) : (
        <div className="min-w-0 flex-1">
          <BrandLogo className="w-28" priority />
          <p className="mt-1 truncate text-[11px] font-bold text-ink-muted">{label}</p>
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-label={mobile ? "بستن منو" : collapsed ? "باز کردن نوار کناری" : "جمع کردن نوار کناری"}
        className={`${collapsed ? "mt-2" : "ms-2"} grid size-9 shrink-0 place-items-center rounded-lg text-ink-muted transition hover:bg-surface-subtle hover:text-ink`}
      >
        {mobile ? (
          <IconX className="size-5" aria-hidden="true" />
        ) : collapsed ? (
          <IconChevronLeft className="size-5" aria-hidden="true" />
        ) : (
          <IconChevronRight className="size-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export function DashboardShell({
  portal,
  user,
  children,
}: {
  portal: DashboardPortal;
  user: { displayName: string; email: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const config = dashboardPortals[portal];
  const activeHref = getActiveNavigationHref(portal, pathname);
  const currentRoute = resolveDashboardRoute(portal, pathname);
  const activeGroup = config.navigation.find(
    (item) =>
      item.type === "group" &&
      item.children.some((child) => child.href === activeHref),
  );
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const initial = user.displayName.trim().charAt(0) || user.email.charAt(0) || "ک";

  return (
    <div className="min-h-screen bg-surface-subtle text-ink">
      <div className="flex min-h-screen">
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 flex-col border-l border-line bg-surface transition-[width] duration-200 lg:flex ${
            collapsed ? "w-20" : "w-72"
          }`}
        >
          <SidebarHeader
            label={config.label}
            collapsed={collapsed}
            onToggle={() => setCollapsed((value) => !value)}
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SidebarNavigation
              items={config.navigation}
              activeHref={activeHref}
              collapsed={collapsed}
              onExpand={() => setCollapsed(false)}
            />
          </div>
          {!collapsed && (
            <p className="border-t border-line px-5 py-4 text-xs leading-6 text-ink-muted">
              خرید و تأمین هوشمند برای کسب‌وکارها
            </p>
          )}
        </aside>

        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="منوی پنل"
            onKeyDown={(event) => {
              if (event.key === "Escape") setMobileOpen(false);
            }}
          >
            <button
              type="button"
              aria-label="بستن منو"
              className="absolute inset-0 bg-ink/40"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative z-10 flex h-full w-[min(21rem,88vw)] flex-col bg-surface shadow-float">
              <SidebarHeader
                label={config.label}
                collapsed={false}
                mobile
                onToggle={() => setMobileOpen(false)}
              />
              <div className="min-h-0 flex-1 overflow-y-auto">
                <SidebarNavigation
                  items={config.navigation}
                  activeHref={activeHref}
                  collapsed={false}
                  onExpand={() => undefined}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
            </aside>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-20 items-center border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="باز کردن منو"
              aria-expanded={mobileOpen}
              className="me-3 grid size-10 place-items-center rounded-xl border border-line text-ink-muted transition hover:bg-surface-subtle hover:text-ink lg:hidden"
            >
              <IconMenu2 className="size-5" aria-hidden="true" />
            </button>

            <nav aria-label="مسیر صفحه" className="min-w-0 flex-1">
              <ol className="flex items-center gap-2 overflow-hidden text-xs font-bold text-ink-muted sm:text-sm">
                <li className="shrink-0">
                  <Link href={config.basePath} className="transition hover:text-primary">
                    {config.shortLabel}
                  </Link>
                </li>
                {activeGroup?.type === "group" && (
                  <>
                    <li aria-hidden="true">/</li>
                    <li className="hidden shrink-0 sm:block">{activeGroup.label}</li>
                  </>
                )}
                {currentRoute && pathname !== config.basePath && (
                  <>
                    <li aria-hidden="true">/</li>
                    <li className="truncate text-ink" aria-current="page">
                      {currentRoute.title}
                    </li>
                  </>
                )}
              </ol>
            </nav>

            <details className="group relative ms-3">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl p-1.5 pe-2 transition hover:bg-surface-subtle [&::-webkit-details-marker]:hidden">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft font-black text-primary">
                  {initial}
                </span>
                <span className="hidden max-w-40 truncate text-sm font-bold text-ink sm:block">
                  {user.displayName}
                </span>
                <IconChevronDown
                  className="hidden size-4 text-ink-muted transition-transform group-open:rotate-180 sm:block"
                  aria-hidden="true"
                />
              </summary>
              <div className="absolute end-0 top-full mt-2 w-64 rounded-2xl border border-line bg-surface p-2 shadow-float">
                <div className="border-b border-line px-3 py-2.5">
                  <p className="truncate text-sm font-black text-ink">{user.displayName}</p>
                  <p className="mt-1 truncate text-xs text-ink-muted" dir="ltr">
                    {user.email}
                  </p>
                </div>
                <Link
                  href={config.accountHref}
                  className="mt-1 flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold text-ink-muted transition hover:bg-surface-subtle hover:text-ink"
                >
                  <IconUserCircle className="size-5" aria-hidden="true" />
                  حساب کاربری
                </Link>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm font-bold text-danger transition hover:bg-danger-soft"
                  >
                    <IconLogout className="size-5" aria-hidden="true" />
                    خروج از حساب
                  </button>
                </form>
              </div>
            </details>
          </header>

          <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
