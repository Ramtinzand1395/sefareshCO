import type { Metadata } from "next";

import { PortalPage } from "@/app/(dashboard)/portal-page";

export const metadata: Metadata = { title: "پنل تأمین‌کننده" };

export default function SupplierPage() {
  return (
    <PortalPage
      portal="supplier"
      title="داشبورد تأمین‌کننده"
      description="درخواست‌های تخصیص‌یافته، پیشنهادها، محصولات، سفارش‌ها و وضعیت مالی کسب‌وکار خود را مدیریت کنید."
    />
  );
}
