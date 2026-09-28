import type { Metadata } from "next";

import { PortalPage } from "@/app/(dashboard)/portal-page";

export const metadata: Metadata = { title: "پنل کافه و رستوران" };

export default function CafePage() {
  return (
    <PortalPage
      portal="cafe"
      title="داشبورد کافه و رستوران"
      description="لیست خرید، درخواست‌های خرید، مقایسه قیمت و سفارش‌های مجموعه را از این فضای مستقل مدیریت کنید."
    />
  );
}
