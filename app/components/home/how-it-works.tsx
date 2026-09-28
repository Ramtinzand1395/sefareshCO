import {
  IconClipboardList,
  IconSearch,
  IconShoppingCart,
  IconChevronLeft,
} from "@tabler/icons-react";
import { Reveal } from "@/app/components/reveal";

const steps = [
  {
    number: "۱",
    title: "مواد موردنیاز را ثبت کنید",
    description: "محصولات و مقدار موردنیاز را در سیستم ثبت کنید.",
    icon: IconClipboardList,
  },
  {
    number: "۲",
    title: "پیشنهادها را مقایسه کنید",
    description: "قیمت، هزینه ارسال و زمان تحویل را بررسی کنید.",
    icon: IconSearch,
  },
  {
    number: "۳",
    title: "سفارش دهید و پیگیری کنید",
    description: "سفارش خود را ثبت و وضعیت آن را آنلاین دنبال کنید.",
    icon: IconShoppingCart,
  },
];

export function HowItWorks() {
  return (
    <Reveal>
      <section
        id="how-it-works"
        className="scroll-mt-24 pb-16"
        aria-labelledby="steps-heading"
      >
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="rounded-3xl bg-[#eef7ff] px-5 py-10 sm:px-8">
            <div className="text-center">
              <h2
                id="steps-heading"
                className="text-3xl font-black text-slate-950"
              >
                چطور در سفارش خرید کنیم؟
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                در سه مرحله ساده، مواد اولیه کسب‌وکار خود را تهیه کنید.
              </p>
            </div>
            <ol className="mt-9 grid gap-5 lg:grid-cols-3">
              {steps.map(
                ({ number, title, description, icon: Icon }, index) => (
                  <li
                    key={number}
                    className="relative rounded-2xl bg-white p-6 shadow-sm"
                  >
                    <span className="absolute -top-4 right-5 grid size-9 place-items-center rounded-full bg-amber-400 font-black text-slate-950">
                      {number}
                    </span>
                    <div className="flex items-start gap-4">
                      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                        <Icon size={28} stroke={1.8} />
                      </span>
                      <div>
                        <h3 className="font-black text-slate-950">{title}</h3>
                        <p className="mt-2 text-sm leading-7 text-slate-500">
                          {description}
                        </p>
                      </div>
                    </div>
                    {index < steps.length - 1 && (
                      <IconChevronLeft
                        className="absolute -left-5 top-1/2 hidden -translate-y-1/2 text-blue-500 lg:block"
                        aria-hidden="true"
                      />
                    )}
                  </li>
                ),
              )}
            </ol>
          </div>
        </div>
      </section>
    </Reveal>
  );
}
