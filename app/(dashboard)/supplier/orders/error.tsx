"use client";

import { OrderRouteError } from "@/app/(dashboard)/_components/order-route-error";

export default function SupplierOrdersError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="supplier-content-container"><OrderRouteError reset={reset} /></div>;
}
