import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PortalLayout } from "@/app/(dashboard)/portal-layout";

export const metadata: Metadata = { title: "پنل تأمین‌کننده" };

export default function SupplierLayout({ children }: { children: ReactNode }) {
  return <PortalLayout portal="supplier">{children}</PortalLayout>;
}
