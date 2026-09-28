"use client";

import {
  IconBrandGoogle,
  IconEye,
  IconEyeOff,
  IconLoader2,
} from "@tabler/icons-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  googleSignInAction,
  type AuthActionState,
} from "@/app/actions/auth";

type AuthAction = (
  state: AuthActionState,
  formData: FormData,
) => Promise<AuthActionState>;

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1.5 text-xs text-red-600">{errors[0]}</p>;
}

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? (
        <IconLoader2 className="size-5 animate-spin" aria-hidden="true" />
      ) : (
        <IconBrandGoogle className="size-5" aria-hidden="true" />
      )}
      ادامه با Google
    </button>
  );
}

export function AuthForm({
  mode,
  action,
  googleEnabled,
}: {
  mode: "login" | "register";
  action: AuthAction;
  googleEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [showPassword, setShowPassword] = useState(false);
  const isRegister = mode === "register";

  return (
    <div>
      <form action={formAction} className="space-y-5" noValidate>
        {state.error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-6 text-red-700"
          >
            {state.error}
          </p>
        )}

        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-bold text-slate-800">
            ایمیل
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            required
            aria-invalid={Boolean(state.fieldErrors?.email)}
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-left text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            placeholder="name@example.com"
          />
          <FieldError errors={state.fieldErrors?.email} />
        </div>

        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-bold text-slate-800">
            رمز عبور
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isRegister ? "new-password" : "current-password"}
              dir="ltr"
              required
              aria-invalid={Boolean(state.fieldErrors?.password)}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 pe-11 text-left text-sm text-slate-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-800"
              aria-label={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
            >
              {showPassword ? <IconEyeOff className="size-5" /> : <IconEye className="size-5" />}
            </button>
          </div>
          <FieldError errors={state.fieldErrors?.password} />
        </div>

        {isRegister && (
          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-sm font-bold text-slate-800"
            >
              تکرار رمز عبور
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              dir="ltr"
              required
              aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-left text-sm text-slate-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
            <FieldError errors={state.fieldErrors?.confirmPassword} />
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-black text-white transition hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60"
        >
          {pending && <IconLoader2 className="size-5 animate-spin" aria-hidden="true" />}
          {isRegister ? "ساخت حساب" : "ورود"}
        </button>
      </form>

      {googleEnabled && (
        <>
          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            یا
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form action={googleSignInAction}>
            <GoogleButton />
          </form>
        </>
      )}

      <p className={`${googleEnabled ? "mt-6" : "mt-5"} text-center text-sm text-slate-600`}>
        {isRegister ? "قبلاً حساب ساخته‌اید؟" : "حساب کاربری ندارید؟"}{" "}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="font-black text-blue-700 hover:text-blue-800"
        >
          {isRegister ? "وارد شوید" : "ثبت‌نام کنید"}
        </Link>
      </p>
    </div>
  );
}
