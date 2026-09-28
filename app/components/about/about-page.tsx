import Image from "next/image";
import Link from "next/link";
import {
  IconArrowLeft,
  IconBuildingStore,
  IconCheck,
  IconClipboardList,
  IconClockCheck,
  IconEye,
  IconHeartHandshake,
  IconMapPin,
  IconMessageCircle,
  IconRoute,
  IconScale,
  IconSearch,
  IconSparkles,
  IconTargetArrow,
} from "@tabler/icons-react";
import { SiteFooter } from "@/app/components/layout/site-footer";
import { SiteHeader } from "@/app/components/layout/site-header";
import { SectionHeading } from "@/app/components/about/section-heading";

const pillars = [
  {
    title: "راحتی",
    description:
      "نیاز را یک‌بار ثبت می‌کنید و مسیر خرید را بدون تماس‌ها و پیام‌های پراکنده جلو می‌برید.",
    icon: IconSparkles,
  },
  {
    title: "شفافیت",
    description:
      "قیمت، هزینه ارسال، زمان تحویل و شرایط هر پیشنهاد پیش از انتخاب روشن است.",
    icon: IconEye,
  },
  {
    title: "کنترل",
    description:
      "انتخاب نهایی با شماست و وضعیت هر سفارش را از ثبت تا تحویل دنبال می‌کنید.",
    icon: IconTargetArrow,
  },
];

const journey = [
  { label: "ثبت نیاز", icon: IconClipboardList },
  { label: "مقایسه روشن", icon: IconScale },
  { label: "انتخاب آگاهانه", icon: IconCheck },
  { label: "پیگیری تحویل", icon: IconClockCheck },
];

const persianNumbers = ["۱", "۲", "۳", "۴"] as const;

const characterTraits = [
  {
    title: "حرفه‌ای و دقیق",
    text: "جزئیات مهم خرید را کوتاه، روشن و قابل مقایسه نشان می‌دهیم.",
    icon: IconSearch,
  },
  {
    title: "دوستانه و نزدیک",
    text: "با زبان آشنا برای کافه و رستوران حرف می‌زنیم؛ نه با اصطلاحات پیچیده.",
    icon: IconMessageCircle,
  },
  {
    title: "همراه و مسئول",
    text: "در طول خرید کنار کسب‌وکار می‌مانیم و مسیر را قابل پیگیری نگه می‌داریم.",
    icon: IconHeartHandshake,
  },
];

const aboutPageSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "درباره سفارش",
  description:
    "داستان، مأموریت و ارزش‌های سفارش؛ دستیار خرید مواد اولیه کافه‌ها و رستوران‌های کرمان.",
  inLanguage: "fa-IR",
  mainEntity: {
    "@type": "Organization",
    name: "سفارش",
    slogan: "خرید مواد اولیه آسان شد",
    areaServed: "Kerman, Iran",
  },
};

export function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageSchema) }}
      />
      <SiteHeader />

      <main id="top">
        <section
          className="overflow-hidden bg-brand-sky"
          aria-labelledby="about-hero-heading"
        >
          <div className="mx-auto grid min-h-[610px] max-w-7xl items-center gap-10 px-5 py-16 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-20">
            <div className="lg:order-2">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-blue shadow-sm">
                <IconBuildingStore size={19} stroke={1.8} />
                از دل تجربه روزمره کافه و رستوران
              </div>
              <h1
                id="about-hero-heading"
                className="text-4xl font-black leading-[1.45] tracking-tight text-brand-navy sm:text-5xl lg:text-[3.45rem]"
              >
                خرید روشن‌تر،
                <span className="block text-brand-blue">
                  کار روزانه ساده‌تر
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-9 text-brand-muted sm:text-lg">
                سفارش ساخته شد تا خرید مواد اولیه از یک کار پراکنده و زمان‌بر،
                به مسیری ساده، شفاف و قابل پیگیری تبدیل شود؛ مسیری که انتخاب را
                برای مدیران کافه و رستوران آسان‌تر می‌کند.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/#suppliers"
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-brand-blue px-8 font-black text-white shadow-xl shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-[#1d49b5]"
                >
                  شروع خرید
                  <IconArrowLeft size={20} />
                </Link>
                <Link
                  href="/#how-it-works"
                  className="inline-flex min-h-13 items-center justify-center rounded-xl border-2 border-brand-blue bg-white px-8 font-black text-brand-blue transition hover:bg-brand-neutral"
                >
                  سفارش چطور کار می‌کند؟
                </Link>
              </div>
            </div>

            <div className="relative lg:order-1">
              <div className="rounded-[2rem] border border-white bg-white p-6 shadow-xl shadow-blue-100/70 sm:p-8">
                <div className="flex items-center justify-between gap-4 border-b border-brand-border pb-6">
                  <Image
                    src="/brand/logo-sefaresh.png"
                    alt="نشان رسمی سفارش"
                    width={749}
                    height={213}
                    className="h-auto w-40"
                  />
                  <span className="grid size-14 place-items-center rounded-2xl bg-brand-sky">
                    <Image
                      src="/brand/mark-sefaresh.png"
                      alt=""
                      width={512}
                      height={512}
                      className="size-10 object-contain"
                    />
                  </span>
                </div>

                <p className="py-7 text-2xl font-black leading-[1.7] text-brand-navy sm:text-3xl">
                  «خرید مواد اولیه آسان شد»
                </p>

                <ol
                  className="grid gap-3 sm:grid-cols-2"
                  aria-label="مسیر خرید در سفارش"
                >
                  {journey.map(({ label, icon: Icon }, index) => (
                    <li
                      key={label}
                      className="flex items-center gap-3 rounded-xl bg-brand-neutral p-4"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-brand-blue shadow-sm">
                        <Icon size={21} stroke={1.9} />
                      </span>
                      <span className="font-bold text-brand-navy">{label}</span>
                      <span className="mr-auto text-xs font-black text-brand-orange">
                        {persianNumbers[index]}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <span className="absolute -bottom-4 -right-4 hidden rounded-2xl bg-brand-orange px-5 py-3 text-sm font-black text-brand-navy shadow-lg sm:block">
                ساخته‌شده برای کار واقعی
              </span>
            </div>
          </div>
        </section>

        <section className="py-20" aria-labelledby="story-heading">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div>
              <SectionHeading
                id="story-heading"
                eyebrow="داستان شکل‌گیری"
                title="مسئله‌ای که هر روز پشت پیشخوان تکرار می‌شد"
                description="تجربه کار در کافه نشان داد که بخش مهمی از وقت مدیران نه صرف مشتری، محصول و تیم، بلکه صرف پیدا کردن قیمت، تماس با چند فروشنده، هماهنگی ارسال و دنبال کردن سفارش می‌شود."
              />
              <p className="mt-5 text-base leading-8 text-brand-muted">
                سفارش از همین مسئله واقعی شروع شد: جمع کردن نیاز، پیشنهادها و
                وضعیت سفارش در یک مسیر مشخص؛ تا تصمیم‌گیری سریع‌تر شود و هیچ
                هزینه یا شرط مهمی پشت گفت‌وگوهای پراکنده گم نشود.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-3xl bg-brand-navy p-7 text-white sm:row-span-2 sm:flex sm:flex-col sm:justify-between">
                <span className="grid size-12 place-items-center rounded-2xl bg-white/10 text-brand-orange">
                  <IconRoute size={29} stroke={1.7} />
                </span>
                <div className="mt-14">
                  <p className="text-sm font-bold text-blue-200">جوهره برند</p>
                  <h3 className="mt-3 text-3xl font-black leading-[1.55]">
                    خرید روشن، کنترل ساده
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-slate-300">
                    هر تصمیم طراحی و محصول باید این تجربه را برای کاربر ملموس‌تر
                    کند.
                  </p>
                </div>
              </article>

              <article className="rounded-3xl border border-brand-border bg-brand-neutral p-7">
                <IconTargetArrow
                  size={31}
                  className="text-brand-blue"
                  stroke={1.7}
                />
                <h3 className="mt-5 text-xl font-black text-brand-navy">
                  مأموریت ما
                </h3>
                <p className="mt-3 text-sm leading-7 text-brand-muted">
                  ساده کردن ثبت نیاز، مقایسه تأمین‌کننده، خرید و پیگیری هزینه‌ها
                  در یک مسیر منظم.
                </p>
              </article>

              <article className="rounded-3xl border border-brand-border bg-white p-7 shadow-sm">
                <IconMapPin
                  size={31}
                  className="text-brand-blue"
                  stroke={1.7}
                />
                <h3 className="mt-5 text-xl font-black text-brand-navy">
                  چشم‌انداز ما
                </h3>
                <p className="mt-3 text-sm leading-7 text-brand-muted">
                  از کرمان شروع کرده‌ایم تا به انتخاب قابل اعتماد کافه‌ها و
                  رستوران‌ها تبدیل شویم و قدم‌به‌قدم گسترش پیدا کنیم.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section
          className="bg-brand-neutral py-20"
          aria-labelledby="pillars-heading"
        >
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <SectionHeading
              id="pillars-heading"
              eyebrow="قول سفارش"
              title="سه اصل برای هر خرید بهتر"
              description="سفارش قرار نیست فقط یک فهرست تأمین‌کننده باشد؛ هر بخش آن باید انتخاب را ساده‌تر و نتیجه را قابل پیش‌بینی‌تر کند."
              centered
            />
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {pillars.map(({ title, description, icon: Icon }, index) => (
                <article
                  key={title}
                  className="relative rounded-3xl border border-brand-border bg-white p-7 shadow-sm"
                >
                  <span className="absolute left-6 top-6 text-sm font-black text-brand-orange">
                    {persianNumbers[index]}
                  </span>
                  <span className="grid size-13 place-items-center rounded-2xl bg-brand-sky text-brand-blue">
                    <Icon size={30} stroke={1.8} />
                  </span>
                  <h3 className="mt-6 text-2xl font-black text-brand-navy">
                    {title}
                  </h3>
                  <p className="mt-3 text-sm leading-8 text-brand-muted">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20" aria-labelledby="personality-heading">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid items-end gap-6 lg:grid-cols-2">
              <SectionHeading
                id="personality-heading"
                eyebrow="شخصیت و رفتار"
                title="حرفه‌ای، اما همیشه نزدیک به آدم‌های کار"
              />
              <p className="text-base leading-8 text-brand-muted lg:pb-1">
                لحن سفارش مستقیم و محترمانه است. اطلاعات را کامل می‌گوییم، برای
                تصمیم‌گیری فشار نمی‌آوریم و با وعده‌های بزرگ جای شفافیت را
                نمی‌گیریم.
              </p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {characterTraits.map(({ title, text, icon: Icon }) => (
                <article
                  key={title}
                  className="rounded-3xl border border-brand-border bg-white p-7"
                >
                  <Icon size={32} className="text-brand-blue" stroke={1.7} />
                  <h3 className="mt-5 text-xl font-black text-brand-navy">
                    {title}
                  </h3>
                  <p className="mt-3 text-sm leading-8 text-brand-muted">
                    {text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="pb-10" aria-labelledby="local-heading">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid overflow-hidden rounded-[2rem] bg-brand-sky lg:grid-cols-[1.05fr_0.95fr]">
              <div className="p-8 sm:p-12">
                <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-brand-blue">
                  <IconMapPin size={19} />
                  شروع از کرمان
                </div>
                <h2
                  id="local-heading"
                  className="mt-6 text-3xl font-black leading-[1.5] text-brand-navy sm:text-4xl"
                >
                  نزدیک به بازار، نزدیک به مسئله
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-9 text-brand-muted">
                  شناخت بازار محلی، شیوه کار تأمین‌کنندگان و نیاز روزانه کافه‌ها
                  و رستوران‌ها کمک می‌کند راه‌حل را از واقعیت کار بسازیم؛ نه از
                  فرضیات پشت میز.
                </p>
              </div>
              <div className="flex min-h-64 items-center justify-center bg-brand-blue p-8 text-center text-white">
                <div>
                  <Image
                    src="/brand/mark-sefaresh.png"
                    alt="نشان سفارش"
                    width={512}
                    height={512}
                    className="mx-auto size-28 rounded-3xl bg-white p-4"
                  />
                  <p className="mt-6 text-2xl font-black">
                    از کرمان، برای کار حرفه‌ای‌تر
                  </p>
                  <p className="mt-2 text-sm leading-7 text-blue-100">
                    مسیر رشد ما با اعتماد کسب‌وکارهای محلی ساخته می‌شود.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-8 pt-10" aria-labelledby="about-cta-heading">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="rounded-[2rem] bg-brand-navy px-6 py-12 text-center text-white sm:px-12 sm:py-16">
              <h2
                id="about-cta-heading"
                className="text-3xl font-black leading-[1.5] sm:text-4xl"
              >
                خرید مواد اولیه را روشن‌تر شروع کنید
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-slate-300 sm:text-base">
                پیشنهادها را کنار هم ببینید، با اطلاعات کامل انتخاب کنید و وضعیت
                سفارش را در یک مسیر دنبال کنید.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/#suppliers"
                  className="rounded-xl bg-brand-orange px-10 py-3.5 font-black text-brand-navy transition hover:bg-[#f59b14]"
                >
                  شروع خرید
                </Link>
                <Link
                  href="/#features"
                  className="rounded-xl border border-white/30 px-10 py-3.5 font-black text-white transition hover:bg-white/10"
                >
                  مشاهده امکانات
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
