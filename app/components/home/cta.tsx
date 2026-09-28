import Image from "next/image";
import Link from "next/link";

export function Cta() {
  return (
    <section className="pb-8" aria-labelledby="cta-heading">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="relative min-h-[300px] overflow-hidden rounded-3xl bg-blue-700 px-6 py-10 text-white shadow-2xl shadow-blue-200 sm:px-12">
          <Image src="/images/cta-kerman.webp" alt="" fill sizes="(max-width: 1280px) 100vw, 1280px" className="object-cover" />
          <div className="relative z-10 mr-auto max-w-2xl text-center lg:mr-[32%]">
            <h2 id="cta-heading" className="text-3xl font-black sm:text-4xl">خرید مواد اولیه را یکجا مدیریت کنید</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-blue-50">قیمت‌ها را مقایسه کنید، از تأمین‌کنندگان معتبر خرید کنید و همه سفارش‌ها را در یک مسیر دنبال کنید.</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register" className="rounded-xl bg-amber-400 px-10 py-3.5 font-black text-slate-950 transition hover:bg-amber-300">شروع خرید</Link>
              <Link href="#features" className="rounded-xl bg-white px-10 py-3.5 font-black text-blue-700 transition hover:bg-blue-50">مشاهده امکانات</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
