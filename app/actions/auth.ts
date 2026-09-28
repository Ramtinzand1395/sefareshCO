"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn, signOut } from "@/auth";
import { loginSchema, registerSchema } from "@/src/domain/schemas/auth";
import {
  EmailAlreadyExistsError,
  registerWithCredentials,
} from "@/src/services/auth-service";

export type AuthActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

function fields(formData: FormData) {
  return {
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  };
}

export async function loginAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse(fields(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/onboarding",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "ایمیل یا رمز عبور نادرست است" };
    }
    throw error;
  }

  return {};
}

export async function registerAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse(fields(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await registerWithCredentials(parsed.data);
  } catch (error) {
    if (error instanceof EmailAlreadyExistsError) {
      return {
        error: "امکان ساخت حساب با این ایمیل وجود ندارد؛ وارد شوید یا از Google استفاده کنید",
      };
    }
    return { error: "ساخت حساب انجام نشد؛ لطفاً دوباره تلاش کنید" };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/onboarding",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?registered=1");
    }
    throw error;
  }

  return {};
}

export async function googleSignInAction() {
  await signIn("google", { redirectTo: "/onboarding" });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
