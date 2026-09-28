import Image from "next/image";
import {
  IconScale,
  IconClipboardList,
  IconBell,
  IconRefresh,
} from "@tabler/icons-react";
import { Reveal } from "@/app/components/reveal";

const features = [
  {
    title: "مقایسه تأمین‌کنندگان",
    description: "قیمت، هزینه ارسال و زمان تحویل را در یک نگاه مقایسه کنید.",
    icon: IconScale,
  },
  {
    title: "مدیریت سفارش‌ها",
    description: "همه سفارش‌ها را از یک مکان مدیریت و پیگیری کنید.",
    icon: IconClipboardList,
  },
  {
    title: "اعلان و پیگیری",
    description: "از وضعیت سفارش‌ها با اعلان‌های دقیق مطلع شوید.",
    icon: IconBell,
  },
  {
    title: "خریدهای تکراری",
    description: "سفارش‌های پرتکرار را سریع و آسان دوباره ثبت کنید.",
    icon: IconRefresh,
  },
];

export function Features() {
  return (
    <Reveal>
      <section
        id="features"
        className="scroll-mt-24 pb-16"
        aria-labelledby="features-heading"
      >
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 lg:grid-cols-[1.08fr_0.92fr] lg:px-8">
          <div className="relative min-h-[360px] overflow-hidden rounded-3xl border border-blue-100 bg-[#f5faff] p-3 shadow-sm sm:min-h-[500px] lg:order-2">
            <Image
              src="/images/dashboard.png"
              alt="داشبورد مدیریت سفارش‌ها و گزارش خرید"
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-contain p-3"
            />
          </div>
          <div className="lg:order-1">
            <h2
              id="features-heading"
              className="text-3xl font-black text-slate-950"
            >
              امکانات سفارش برای مدیریت بهتر خریدها
            </h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {features.map(({ title, description, icon: Icon }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
                    <Icon size={26} stroke={1.8} />
                  </span>
                  <h3 className="mt-4 font-black text-slate-950">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Reveal>
  );
}
