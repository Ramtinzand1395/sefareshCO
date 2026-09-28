import {
  DashboardRoutePage,
  getDashboardRouteMetadata,
} from "@/app/(dashboard)/dashboard-route-page";

type Props = { params: Promise<{ segments: string[] }> };

export function generateMetadata({ params }: Props) {
  return getDashboardRouteMetadata("supplier", params);
}

export default function SupplierRoutePage({ params }: Props) {
  return <DashboardRoutePage portal="supplier" params={params} />;
}
