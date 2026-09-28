import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { registerAction } from "@/app/actions/auth";
import { AuthCard } from "@/app/components/auth/auth-card";
import { AuthForm } from "@/app/components/auth/auth-form";
import { auth } from "@/auth";

export const metadata: Metadata = { title: "ساخت حساب" };

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect(session.user.destination);
  const googleEnabled = Boolean(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
  );

  return (
    <AuthCard
      title="ساخت حساب کاربری"
      subtitle="ابتدا حساب را بسازید و سپس اطلاعات کسب‌وکار را تکمیل کنید"
    >
      <AuthForm
        mode="register"
        action={registerAction}
        googleEnabled={googleEnabled}
      />
    </AuthCard>
  );
}
