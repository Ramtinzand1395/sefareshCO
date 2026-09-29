import {
  IconBuildingStore,
  IconClock,
  IconTruckDelivery,
  IconUserCheck,
  IconUsers,
} from "@tabler/icons-react";
import type { Metadata } from "next";

import { PortalPage } from "@/app/(dashboard)/portal-page";

export const metadata: Metadata = { title: "پنل مدیریت" };

export default function AdminPage() {
  return (
    <PortalPage
      portal="admin"
      title="داشبورد مدیریت Marketplace"
      description="کافه‌ها، تأمین‌کنندگان، کاتالوگ، درخواست‌ها، سفارش‌ها و عملیات مالی پلتفرم را پایش کنید."
    />
  );
}
