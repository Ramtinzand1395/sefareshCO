import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PortalLayout } from "@/app/(dashboard)/portal-layout";

export const metadata: Metadata = { title: "پنل مدیریت" };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <PortalLayout portal="admin">{children}</PortalLayout>;
}
