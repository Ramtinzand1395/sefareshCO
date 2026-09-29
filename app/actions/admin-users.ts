"use server";

import { revalidatePath } from "next/cache";

import { updateUserStatusSchema } from "@/src/domain/schemas/admin-user";
import { requireAdmin } from "@/src/lib/admin-helpers";
import {
  updateAdminUserStatus,
  SelfStatusChangeError,
  UserNotFoundError,
} from "@/src/services/admin-user-service";

export type AdminUserActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export async function updateUserStatusAction(
  _state: AdminUserActionState,
  formData: FormData,
): Promise<AdminUserActionState> {
  // 1. Independent admin authorization
  await requireAdmin();

  // 2. Zod validation
  const parsed = updateUserStatusSchema.safeParse({
    userId: formData.get("userId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // 3. Service call
  try {
    await updateAdminUserStatus(parsed.data.userId, parsed.data.status);
  } catch (error) {
    if (error instanceof SelfStatusChangeError) {
      return { error: "امکان تعلیق یا غیرفعال‌سازی حساب خودتان وجود ندارد" };
    }
    if (error instanceof UserNotFoundError) {
      return { error: "کاربر یافت نشد" };
    }
    return { error: "خطای غیرمنتظره؛ لطفاً دوباره تلاش کنید" };
  }

  // 4. Revalidate
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${parsed.data.userId}`);
  revalidatePath("/admin");

  return { ok: true };
}
