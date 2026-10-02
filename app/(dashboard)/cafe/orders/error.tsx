"use client";

import { OrderRouteError } from "@/app/(dashboard)/_components/order-route-error";

export default function CafeOrdersError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="cafe-content-container"><OrderRouteError reset={reset} /></div>;
}
