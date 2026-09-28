import { Reveal } from "@/app/components/reveal";

const faqs = [
  {
    question: "سفارش در کدام مناطق کرمان فعال است؟",
    answer:
      "در حال حاضر شهر کرمان، رفسنجان، سیرجان، بم و جیرفت تحت پوشش هستند و مناطق جدید به‌تدریج اضافه می‌شوند.",
  },
  {
    question: "حداقل مبلغ خرید چقدر است؟",
    answer:
      "حداقل مبلغ سفارش به تأمین‌کننده و نوع کالا بستگی دارد و پیش از ثبت نهایی نمایش داده می‌شود.",
  },
  {
    question: "تأمین‌کنندگان چگونه بررسی می‌شوند؟",
    answer:
      "هویت، مجوز فعالیت، کیفیت پاسخ‌گویی و سابقه تحویل تأمین‌کنندگان پیش از شروع همکاری بررسی می‌شود.",
  },
  {
    question: "هزینه ارسال چگونه محاسبه می‌شود؟",
    answer:
      "هزینه ارسال بر اساس فاصله، وزن سفارش و سیاست تأمین‌کننده محاسبه و در قیمت نهایی شفاف نمایش داده می‌شود.",
  },
  {
    question: "قیمت‌ها هر چند وقت به‌روزرسانی می‌شوند؟",
    answer:
      "تأمین‌کنندگان قیمت و موجودی را به‌صورت روزانه یا هنگام تغییر بازار به‌روزرسانی می‌کنند.",
  },
  {
    question: "اگر کالایی موجود نباشد چه می‌شود؟",
    answer:
      "پیشنهاد تأمین‌کنندگان جایگزین نمایش داده می‌شود و بدون تأیید شما تغییری در سفارش ایجاد نخواهد شد.",
  },
];

export const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
};

export function Faq() {
  const mid = Math.ceil(faqs.length / 2);
  const firstCol = faqs.slice(0, mid);
  const secondCol = faqs.slice(mid);

  const renderFaqItem = (faq: (typeof faqs)[number]) => (
    <details
      key={faq.question}
      className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm open:border-blue-200"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-slate-900">
        {faq.question}
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full bg-blue-50 text-xl text-blue-600 transition group-open:rotate-45"
          aria-hidden="true"
        >
          +
        </span>
      </summary>
      <p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-7 text-slate-600">
        {faq.answer}
      </p>
    </details>
  );

  return (
    <Reveal>
      <section className="pb-16" aria-labelledby="faq-heading">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center">
            <h2 id="faq-heading" className="text-3xl font-black text-slate-950">
              سؤالات متداول
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              پاسخ به سؤالات پرتکرار شما درباره سفارش.
            </p>
          </div>
          <div className="mt-8 grid gap-3 lg:grid-cols-2 lg:items-start">
            <div className="flex flex-col gap-3">{firstCol.map(renderFaqItem)}</div>
            <div className="flex flex-col gap-3">{secondCol.map(renderFaqItem)}</div>
          </div>
        </div>
      </section>
    </Reveal>
  );
}
