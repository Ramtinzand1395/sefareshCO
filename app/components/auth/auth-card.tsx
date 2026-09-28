import Link from "next/link";
import type { ReactNode } from "react";

import { BrandLogo } from "@/app/components/brand/brand-logo";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto block w-fit" aria-label="صفحه اصلی سفارش">
          <BrandLogo className="w-36" priority />
        </Link>
        <section className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <header className="mb-7 text-center">
            <h1 className="text-2xl font-black text-slate-950">{title}</h1>
            <p className="mt-2 text-sm leading-7 text-slate-500">{subtitle}</p>
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
