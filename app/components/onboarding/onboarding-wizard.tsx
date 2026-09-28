"use client";

import {
  IconBuildingStore,
  IconLoader2,
  IconTruckDelivery,
} from "@tabler/icons-react";
import { useActionState, useState } from "react";

import { onboardingAction } from "@/app/actions/onboarding";

type AccountType = "buyer" | "supplier";

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1.5 text-xs text-red-600">{errors[0]}</p>;
}

const inputClass =
  "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

export function OnboardingWizard({
  initialValues,
}: {
  initialValues: { firstName: string; lastName: string; mobile: string };
}) {
  const [state, formAction, pending] = useActionState(onboardingAction, {});
  const [accountType, setAccountType] = useState<AccountType>("buyer");
  const isBuyer = accountType === "buyer";

  return (
    <form
      action={formAction}
      className="mx-auto w-full max-w-3xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
    >
      <input type="hidden" name="accountType" value={accountType} />

      {state.error && (
        <p
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
        >
          {state.error}
        </p>
      )}

      <fieldset>
        <legend className="text-base font-black text-slate-950">نوع حساب</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setAccountType("buyer")}
            aria-pressed={isBuyer}
            className={`flex min-h-20 items-center gap-3 rounded-lg border p-4 text-start transition ${
              isBuyer
                ? "border-blue-600 bg-blue-50 text-blue-950 ring-1 ring-blue-600"
                : "border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            <IconBuildingStore className="size-7 shrink-0" aria-hidden="true" />
            <span>
              <span className="block text-sm font-black">کافه یا رستوران</span>
              <span className="mt-1 block text-xs text-slate-500">خرید مواد اولیه</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setAccountType("supplier")}
            aria-pressed={!isBuyer}
            className={`flex min-h-20 items-center gap-3 rounded-lg border p-4 text-start transition ${
              !isBuyer
                ? "border-blue-600 bg-blue-50 text-blue-950 ring-1 ring-blue-600"
                : "border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            <IconTruckDelivery className="size-7 shrink-0" aria-hidden="true" />
            <span>
              <span className="block text-sm font-black">تأمین‌کننده</span>
              <span className="mt-1 block text-xs text-slate-500">فروش و ارسال کالا</span>
            </span>
          </button>
        </div>
        <FieldError errors={state.fieldErrors?.accountType} />
      </fieldset>

      <div className="my-7 h-px bg-slate-200" />

      <fieldset>
        <legend className="text-base font-black text-slate-950">اطلاعات شما</legend>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="mb-2 block text-sm font-bold text-slate-700">نام</label>
            <input id="firstName" name="firstName" defaultValue={initialValues.firstName} autoComplete="given-name" required className={inputClass} />
            <FieldError errors={state.fieldErrors?.firstName} />
          </div>
          <div>
            <label htmlFor="lastName" className="mb-2 block text-sm font-bold text-slate-700">نام خانوادگی</label>
            <input id="lastName" name="lastName" defaultValue={initialValues.lastName} autoComplete="family-name" required className={inputClass} />
            <FieldError errors={state.fieldErrors?.lastName} />
          </div>
          <div>
            <label htmlFor="mobile" className="mb-2 block text-sm font-bold text-slate-700">شماره موبایل</label>
            <input id="mobile" name="mobile" defaultValue={initialValues.mobile} type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="09123456789" required className={`${inputClass} text-left`} />
            <FieldError errors={state.fieldErrors?.mobile} />
          </div>
          <div>
            <label htmlFor="province" className="mb-2 block text-sm font-bold text-slate-700">استان</label>
            <input id="province" name="province" defaultValue="کرمان" autoComplete="address-level1" required className={inputClass} />
            <FieldError errors={state.fieldErrors?.province} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="city" className="mb-2 block text-sm font-bold text-slate-700">شهر</label>
            <input id="city" name="city" defaultValue="کرمان" autoComplete="address-level2" required className={inputClass} />
            <FieldError errors={state.fieldErrors?.city} />
          </div>
        </div>
      </fieldset>

      <div className="my-7 h-px bg-slate-200" />

      <fieldset>
        <legend className="text-base font-black text-slate-950">اطلاعات کسب‌وکار</legend>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div className={isBuyer ? "" : "sm:col-span-2"}>
            <label htmlFor="businessName" className="mb-2 block text-sm font-bold text-slate-700">
              {isBuyer ? "نام کافه یا رستوران" : "نام فروشگاه یا شرکت"}
            </label>
            <input id="businessName" name="businessName" autoComplete="organization" required className={inputClass} />
            <FieldError errors={state.fieldErrors?.businessName} />
          </div>
          {isBuyer && (
            <div>
              <label htmlFor="businessType" className="mb-2 block text-sm font-bold text-slate-700">نوع کسب‌وکار</label>
              <select id="businessType" name="businessType" required defaultValue="" className={inputClass}>
                <option value="" disabled>انتخاب کنید</option>
                <option value="cafe">کافه</option>
                <option value="restaurant">رستوران</option>
                <option value="fast_food">فست‌فود</option>
                <option value="bakery">نانوایی و قنادی</option>
                <option value="catering">کترینگ</option>
                <option value="other">سایر</option>
              </select>
              <FieldError errors={state.fieldErrors?.businessType} />
            </div>
          )}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 text-sm font-black text-white transition hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60"
      >
        {pending && <IconLoader2 className="size-5 animate-spin" aria-hidden="true" />}
        تکمیل حساب و ورود
      </button>
    </form>
  );
}
