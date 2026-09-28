import {
  DashboardRoutePage,
  getDashboardRouteMetadata,
} from "@/app/(dashboard)/dashboard-route-page";

type Props = { params: Promise<{ segments: string[] }> };

export function generateMetadata({ params }: Props) {
  return getDashboardRouteMetadata("cafe", params);
}

export default function CafeRoutePage({ params }: Props) {
  return <DashboardRoutePage portal="cafe" params={params} />;
}
