import {
  DashboardRoutePage,
  getDashboardRouteMetadata,
} from "@/app/(dashboard)/dashboard-route-page";

type Props = { params: Promise<{ segments: string[] }> };

export function generateMetadata({ params }: Props) {
  return getDashboardRouteMetadata("admin", params);
}

export default function AdminRoutePage({ params }: Props) {
  return <DashboardRoutePage portal="admin" params={params} />;
}
