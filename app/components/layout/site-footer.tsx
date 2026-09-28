import Link from "next/link";
import {
  IconBrandInstagram,
  IconBrandLinkedin,
  IconBrandTelegram,
} from "@tabler/icons-react";

import Image from "next/image";

const socialLinks = [
  { label: "تلگرام", icon: IconBrandTelegram },
  { label: "اینستاگرام", icon: IconBrandInstagram },
  { label: "لینکدین", icon: IconBrandLinkedin },
];

const mainNavigation = [
  { label: "امکانات", href: "/#features" },
  { label: "چطور کار می‌کند", href: "/#how-it-works" },
  { label: "تأمین‌کنندگان", href: "/#suppliers" },
  { label: "درباره ما", href: "/about" },
] as const;

const coveredCities = ["کرمان", "رفسنجان", "سیرجان", "بم", "جیرفت"] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-brand-border/70 bg-white py-12">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <Image
            src="/brand/logo-sefaresh.png"
            alt="سفارش"
            width={749}
            height={213}
            priority={false}
            className="h-auto w-36"
          />
          <p className="mt-4 max-w-xs text-sm leading-7 text-brand-muted">
            دستیار خرید مواد اولیه کافه و رستوران؛ همراه کسب‌وکارهای خوب کرمان.
          </p>
          <p className="mt-4 text-xs text-slate-400">
            © ۱۴۰۵ سفارش. تمامی حقوق محفوظ است.
          </p>
        </div>

        <div>
          <h2 className="font-black text-brand-navy">دسترسی سریع</h2>
          <nav
            className="mt-4 space-y-3 text-sm text-brand-muted"
            aria-label="دسترسی سریع"
          >
            {mainNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block hover:text-brand-blue"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <h2 className="font-black text-brand-navy">مناطق تحت پوشش</h2>
          <p className="mt-4 text-sm leading-8 text-brand-muted">
            {coveredCities.slice(0, 4).map((city) => (
              <span key={city} className="block">
                {city}
              </span>
            ))}
            <span>و سایر مناطق</span>
          </p>
        </div>

        <div>
          <h2 className="font-black text-brand-navy">ما را دنبال کنید</h2>
          <div className="mt-5 flex gap-3" dir="ltr">
            {socialLinks.map(({ label, icon: Icon }) => (
              <a
                key={label}
                href="#top"
                aria-label={label}
                className="grid size-10 place-items-center rounded-xl bg-brand-neutral text-brand-muted transition hover:bg-brand-sky hover:text-brand-blue"
              >
                <Icon size={20} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
