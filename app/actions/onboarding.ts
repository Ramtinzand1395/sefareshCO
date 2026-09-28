"use server";

import { redirect } from "next/navigation";

import { unstable_update } from "@/auth";
import { onboardingSchema } from "@/src/domain/schemas/onboarding";
import { requireUser } from "@/src/lib/auth-helpers";
import {
  completeOnboarding,
  MobileAlreadyExistsError,
  OnboardingAlreadyCompletedError,
  OnboardingInProgressError,
} from "@/src/services/onboarding-service";
import { getDefaultDestination } from "@/src/services/auth-service";

export type OnboardingActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export async function onboardingAction(
  _state: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const user = await requireUser();
  const parsed = onboardingSchema.safeParse({
    accountType: formData.get("accountType"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    mobile: formData.get("mobile"),
    province: formData.get("province"),
    city: formData.get("city"),
    businessName: formData.get("businessName"),
    businessType: formData.get("businessType") || undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let destination: "/cafe" | "/supplier";
  try {
    ({ destination } = await completeOnboarding(user.id, parsed.data));
  } catch (error) {
    if (error instanceof OnboardingInProgressError) {
      return { error: "درخواست قبلی در حال پردازش است؛ چند لحظه دیگر تلاش کنید" };
    }
    if (error instanceof MobileAlreadyExistsError) {
      return { fieldErrors: { mobile: ["این شماره موبایل قبلاً ثبت شده است"] } };
    }
    if (error instanceof OnboardingAlreadyCompletedError) {
      const recoveredDestination = await getDefaultDestination(user.id, user.isAdmin);
      if (
        recoveredDestination === "/onboarding" ||
        recoveredDestination === "/admin"
      ) {
        return { error: "اطلاعات حساب کامل است اما دسترسی کسب‌وکار پیدا نشد" };
      }
      destination = recoveredDestination;
    } else {
      return { error: "تکمیل اطلاعات انجام نشد؛ اطلاعات شما حذف نشده و می‌توانید دوباره تلاش کنید" };
    }
  }

  await unstable_update({
    user: { onboardingCompleted: true, destination },
  });
  redirect(destination);
}
