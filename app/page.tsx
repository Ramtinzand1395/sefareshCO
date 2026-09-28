import { SupplierComparison } from "@/app/components/home/supplier-comparison";
import { SiteFooter } from "@/app/components/layout/site-footer";
import { SiteHeader } from "@/app/components/layout/site-header";
import { Reveal } from "@/app/components/reveal";

import { Hero } from "@/app/components/home/hero";
import { Categories } from "@/app/components/home/categories";
import { Features } from "@/app/components/home/features";
import { HowItWorks } from "@/app/components/home/how-it-works";
import { Trust } from "@/app/components/home/trust";
import { Faq, faqSchema } from "@/app/components/home/faq";
import { Cta } from "@/app/components/home/cta";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "سفارش",
  description: "سامانه خرید و مقایسه مواد اولیه کافه‌ها و رستوران‌های کرمان",
  areaServed: "Kerman, Iran",
  sameAs: [],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />

      <SiteHeader />

      <main id="top">
        <Hero />
        <Categories />
        <Features />
        <HowItWorks />

        <Reveal>
          <section
            id="suppliers"
            className="scroll-mt-24 pb-16"
            aria-labelledby="suppliers-heading"
          >
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <div className="text-center">
                <h2
                  id="suppliers-heading"
                  className="text-3xl font-black text-slate-950"
                >
                  مقایسه تأمین‌کنندگان برای یک محصول
                </h2>
                <p className="mx-auto mt-3 max-w-3xl text-sm leading-7 text-slate-500">
                  قیمت، هزینه ارسال و زمان تحویل تأمین‌کنندگان مختلف را مشاهده
                  کنید و بهترین گزینه را انتخاب کنید.
                </p>
              </div>
              <div className="mt-8">
                <SupplierComparison />
              </div>
            </div>
          </section>
        </Reveal>

        <Trust />
        <Faq />
        <Cta />
      </main>

      <SiteFooter />
    </>
  );
}
