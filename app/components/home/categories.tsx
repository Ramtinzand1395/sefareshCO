import Link from "next/link";
import { IconCoffee, IconToolsKitchen2, IconBurger } from "@tabler/icons-react";
import { Reveal } from "@/app/components/reveal";

const categories = [
  { title: "کافه", icon: IconCoffee },
  { title: "رستوران", icon: IconToolsKitchen2 },
  { title: "کافی‌شاپ", icon: IconCoffee },
  { title: "فست‌فود", icon: IconBurger },
];

export function Categories() {
  return (
    <Reveal>
      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8" aria-labelledby="categories-heading">
        <div className="rounded-3xl bg-[#f3f9ff] px-5 py-9 sm:px-8">
          <div className="text-center">
            <h2 id="categories-heading" className="text-2xl font-black text-slate-950">دسته‌بندی مواد اولیه بر اساس نوع کسب‌وکار شما</h2>
            <p className="mt-2 text-sm leading-7 text-slate-500">به‌راحتی مواد اولیه موردنیاز کسب‌وکارتان را در دسته‌بندی‌های زیر پیدا کنید.</p>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {categories.map(({ title, icon: Icon }) => (
              <Link key={title} href="#suppliers" className="group flex min-h-28 items-center justify-center gap-4 rounded-2xl border border-blue-50 bg-white px-4 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-md">
                <Icon size={42} className="text-blue-600 transition group-hover:scale-110" stroke={1.8} />
                <span className="text-lg font-black text-slate-900">{title}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </Reveal>
  );
}
