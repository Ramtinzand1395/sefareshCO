import type { Metadata } from "next";
import { AboutPage } from "@/app/components/about/about-page";

export const metadata: Metadata = {
  title: "درباره ما",
  description:
    "با داستان شکل‌گیری، مأموریت و ارزش‌های سفارش؛ دستیار خرید مواد اولیه کافه‌ها و رستوران‌های کرمان آشنا شوید.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "درباره سفارش | خرید روشن، کنترل ساده",
    description:
      "سفارش خرید مواد اولیه را برای کافه‌ها و رستوران‌ها ساده، شفاف و قابل پیگیری می‌کند.",
    url: "/about",
  },
};

export default function AboutRoute() {
  return <AboutPage />;
}
