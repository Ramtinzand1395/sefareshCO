import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { DashboardShell } from "@/app/(dashboard)/dashboard-shell";
import { getAuthRedirect } from "@/src/lib/auth-route-policy";
import { requireUser } from "@/src/lib/auth-helpers";
import { getDefaultDestination } from "@/src/services/auth-service";
import type { DashboardPortal } from "@/app/(dashboard)/dashboard-config";

export async function PortalLayout({
  portal,
  children,
}: {
  portal: DashboardPortal;
  children: ReactNode;
}) {
  const user = await requireUser();
  const destination = await getDefaultDestination(user.id, user.isAdmin);
  const redirectTo = getAuthRedirect(`/${portal}`, {
    onboardingCompleted: user.onboardingCompleted,
    isAdmin: user.isAdmin,
    destination,
  });

  if (redirectTo) redirect(redirectTo);

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  return (
    <DashboardShell portal={portal} user={{ displayName, email: user.email }}>
      {children}
    </DashboardShell>
  );
}
