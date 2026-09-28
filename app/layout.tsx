import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "سفارش | خرید مواد اولیه کافه و رستوران در کرمان",
    template: "%s | سفارش",
  },
  description:
    "قیمت و زمان تحویل مواد اولیه کافه‌ها و رستوران‌های کرمان را از تأمین‌کنندگان معتبر مقایسه کنید و سفارش خود را آنلاین پیگیری کنید.",
  keywords: [
    "خرید مواد اولیه رستوران",
    "خرید عمده مواد غذایی کرمان",
    "تأمین‌کننده کافه",
    "تأمین‌کننده رستوران کرمان",
    "مقایسه قیمت مواد اولیه",
  ],
  authors: [{ name: "سفارش" }],
  creator: "سفارش",
  publisher: "سفارش",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fa_IR",
    url: "/",
    siteName: "سفارش",
    title: "سفارش | خرید هوشمند مواد اولیه در کرمان",
    description:
      "تأمین‌کنندگان مواد اولیه کافه و رستوران را مقایسه کنید و خریدتان را یکجا مدیریت کنید.",
    images: [
      {
        url: "/images/hero-ordering.webp",
        width: 1200,
        height: 850,
        alt: "سامانه سفارش مواد اولیه کافه و رستوران",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "سفارش | خرید هوشمند مواد اولیه در کرمان",
    description: "مقایسه قیمت، هزینه ارسال و زمان تحویل تأمین‌کنندگان کرمان.",
    images: ["/images/hero-ordering.webp"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2457D6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fa"
      dir="rtl"
      data-scroll-behavior="smooth"
      className={`${vazirmatn.variable} h-full scroll-smooth`}
    >
      <body className="min-h-full bg-white text-slate-800 antialiased">
        {children}
      </body>
    </html>
  );
}
