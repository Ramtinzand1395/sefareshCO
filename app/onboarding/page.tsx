import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BrandLogo } from "@/app/components/brand/brand-logo";
import { OnboardingWizard } from "@/app/components/onboarding/onboarding-wizard";
import { requireUser } from "@/src/lib/auth-helpers";
import { getDefaultDestination } from "@/src/services/auth-service";

export const metadata: Metadata = { title: "تکمیل حساب" };

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.onboardingCompleted) {
    redirect(await getDefaultDestination(user.id, user.isAdmin));
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <BrandLogo className="w-36" priority />
        <h1 className="mt-6 text-2xl font-black text-slate-950 sm:text-3xl">
          تکمیل حساب سفارش
        </h1>
        <p className="mt-2 text-sm leading-7 text-slate-500">
          اطلاعات پایه را وارد کنید تا فضای کاری شما آماده شود
        </p>
      </div>
      <OnboardingWizard
        initialValues={{
          firstName: user.firstName ?? "",
          lastName: user.lastName ?? "",
          mobile: user.mobile ?? "",
        }}
      />
    </main>
  );
}
