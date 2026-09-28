import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  dashboardPortals,
  resolveDashboardRoute,
  type DashboardPortal,
} from "@/app/(dashboard)/dashboard-config";
import { DashboardPlaceholder } from "@/app/(dashboard)/dashboard-placeholder";

type DashboardRouteParams = Promise<{ segments: string[] }>;

function getPathname(portal: DashboardPortal, segments: string[]) {
  return `${dashboardPortals[portal].basePath}/${segments.join("/")}`;
}

export async function getDashboardRouteMetadata(
  portal: DashboardPortal,
  params: DashboardRouteParams,
): Promise<Metadata> {
  const { segments } = await params;
  const route = resolveDashboardRoute(portal, getPathname(portal, segments));
  return { title: route?.title ?? "صفحه یافت نشد" };
}

export async function DashboardRoutePage({
  portal,
  params,
}: {
  portal: DashboardPortal;
  params: DashboardRouteParams;
}) {
  const { segments } = await params;
  const route = resolveDashboardRoute(portal, getPathname(portal, segments));
  if (!route) notFound();

  return <DashboardPlaceholder route={route} />;
}
