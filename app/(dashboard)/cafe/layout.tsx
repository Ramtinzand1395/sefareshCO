import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PortalLayout } from "@/app/(dashboard)/portal-layout";

export const metadata: Metadata = { title: "پنل کافه و رستوران" };

export default function CafeLayout({ children }: { children: ReactNode }) {
  return <PortalLayout portal="cafe">{children}</PortalLayout>;
}
