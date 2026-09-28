import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { loginAction } from "@/app/actions/auth";
import { AuthCard } from "@/app/components/auth/auth-card";
import { AuthForm } from "@/app/components/auth/auth-form";
import { auth } from "@/auth";

export const metadata: Metadata = { title: "ورود" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect(session.user.destination);
  const googleEnabled = Boolean(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
  );

  return (
    <AuthCard title="ورود به سفارش" subtitle="برای ادامه، وارد حساب کاربری خود شوید">
      <AuthForm mode="login" action={loginAction} googleEnabled={googleEnabled} />
    </AuthCard>
  );
}
