import Image from "next/image";
import Link from "next/link";
import {
  IconMapPin,
  IconPlayerPlay,
  IconChartBar,
  IconClock,
  IconTruckDelivery,
} from "@tabler/icons-react";

const benefits = [
  {
    title: "مقایسه قیمت نهایی",
    description: "قیمت کالا به‌همراه هزینه ارسال را ببینید.",
    icon: IconChartBar,
  },
  {
    title: "زمان تحویل مشخص",
    description: "بازه تحویل هر سفارش از ابتدا مشخص است.",
    icon: IconClock,
  },
  {
    title: "پیگیری وضعیت سفارش",
    description: "از ثبت تا تحویل، آنلاین پیگیری کنید.",
    icon: IconTruckDelivery,
  },
];

export function Hero() {
  return (
    <section
      className="overflow-hidden bg-[#eef7ff]"
      aria-labelledby="hero-heading"
    >
      <div className="mx-auto grid min-h-[610px] max-w-7xl items-center gap-8 px-5 py-12 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:py-10">
        <div className="relative z-10 lg:order-1">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
            <IconMapPin size={18} />
            ویژه کافه‌ها و رستوران‌های کرمان
          </div>
          <h1
            id="hero-heading"
            className="text-4xl font-black leading-[1.35] tracking-tight text-slate-950 sm:text-5xl lg:text-5xl"
          >
            <span className="block">خرید مواد اولیه</span>
            <span className="block text-blue-600">کافه و رستوران در کرمان</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
            قیمت، هزینه ارسال و زمان تحویل تأمین‌کنندگان را مقایسه کنید و
            خریدتان را یکجا پیگیری کنید.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="#suppliers"
              className="inline-flex min-h-13 items-center justify-center rounded-xl bg-blue-600 px-8 font-bold text-white shadow-xl shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700"
            >
              شروع خرید
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border-2 border-blue-500 bg-white px-7 font-bold text-blue-600 transition hover:bg-blue-50"
            >
              <IconPlayerPlay size={21} />
              نحوه کار سفارش
            </Link>
          </div>
        </div>

        <div className="relative h-[380px] sm:h-[470px] lg:order-2 lg:h-[540px]">
          <Image
            src="/images/hero-ordering.webp"
            alt="خرید و مقایسه مواد اولیه با اپلیکیشن سفارش"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 55vw"
            className="scale-[1.12] object-contain object-center"
          />
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-3 px-5 pb-8 md:grid-cols-3 lg:px-8">
        {benefits.map(({ title, description, icon: Icon }) => (
          <article
            key={title}
            className="flex items-center gap-4 rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-sm"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600">
              <Icon size={27} stroke={1.8} />
            </span>
            <div>
              <h2 className="font-bold text-slate-950">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {description}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
