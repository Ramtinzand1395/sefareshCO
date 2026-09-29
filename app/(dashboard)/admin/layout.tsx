import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DashboardShell } from "@/app/(dashboard)/dashboard-shell";
import { requireAdmin } from "@/src/lib/admin-helpers";

export const metadata: Metadata = { title: "پنل مدیریت" };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();

  const displayName =
    [admin.firstName, admin.lastName].filter(Boolean).join(" ") || admin.email;

  return (
    <DashboardShell portal="admin" user={{ displayName, email: admin.email }}>
      {children}
    </DashboardShell>
  );
}
