import { IconShieldCheck, IconMapPin, IconHeadset } from "@tabler/icons-react";
import { Reveal } from "@/app/components/reveal";

export function Trust() {
  return (
    <Reveal>
      <section
        id="about"
        className="scroll-mt-24 pb-16"
        aria-labelledby="trust-heading"
      >
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="rounded-3xl bg-[#eef7ff] p-6 sm:p-9">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.55fr]">
              <div className="lg:order-2">
                <h2
                  id="trust-heading"
                  className="text-3xl font-black text-slate-950"
                >
                  اعتماد شما، اولویت ما
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  با یک اکوسیستم قابل اعتماد، خریدی مطمئن و آسان را تجربه کنید.
                </p>
                <div className="mt-7 grid gap-4 sm:grid-cols-3">
                  {[
                    {
                      title: "تأمین‌کنندگان بررسی‌شده",
                      text: "همکاری با تأمین‌کنندگان تأییدشده و معتبر.",
                      icon: IconShieldCheck,
                    },
                    {
                      title: "محدوده ارسال روشن",
                      text: "پوشش ارسال در کرمان و شهرهای اطراف.",
                      icon: IconMapPin,
                    },
                    {
                      title: "پشتیبانی و پیگیری",
                      text: "پاسخ‌گویی به سؤالات و پیگیری تمام مراحل.",
                      icon: IconHeadset,
                    },
                  ].map(({ title, text, icon: Icon }) => (
                    <article
                      key={title}
                      className="rounded-2xl bg-white p-5 shadow-sm"
                    >
                      <Icon size={29} className="text-blue-600" stroke={1.8} />
                      <h3 className="mt-4 font-black text-slate-950">
                        {title}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-slate-500">
                        {text}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
              <aside
                className="rounded-2xl bg-white p-6 shadow-sm lg:order-1"
                aria-label="مناطق تحت پوشش"
              >
                <div className="flex items-center gap-2 font-black text-slate-950">
                  <IconMapPin className="text-blue-600" />
                  مناطق تحت پوشش
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2 text-center text-sm text-slate-600">
                  {[
                    "کرمان",
                    "رفسنجان",
                    "سیرجان",
                    "بم",
                    "جیرفت",
                    "شهر بابک",
                  ].map((city) => (
                    <span
                      key={city}
                      className="rounded-lg bg-slate-50 px-3 py-2"
                    >
                      {city}
                    </span>
                  ))}
                </div>
                <p className="mt-5 text-sm font-bold text-blue-600">
                  و سایر مناطق اطراف ←
                </p>
              </aside>
            </div>
          </div>
        </div>
      </section>
    </Reveal>
  );
}
