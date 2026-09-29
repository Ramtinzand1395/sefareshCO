"use server";

import { revalidatePath } from "next/cache";

import { updateCafeStatusSchema } from "@/src/domain/schemas/admin-cafe";
import { requireAdmin } from "@/src/lib/admin-helpers";
import {
  updateAdminCafeStatus,
  CafeNotFoundError,
} from "@/src/services/admin-cafe-service";

export type AdminCafeActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export async function updateCafeStatusAction(
  _state: AdminCafeActionState,
  formData: FormData,
): Promise<AdminCafeActionState> {
  // 1. Independent admin authorization
  await requireAdmin();

  // 2. Zod validation — only Zod-valid enum values enter the DB
  const parsed = updateCafeStatusSchema.safeParse({
    cafeId: formData.get("cafeId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // 3. Service call
  try {
    await updateAdminCafeStatus(parsed.data.cafeId, parsed.data.status);
  } catch (error) {
    if (error instanceof CafeNotFoundError) {
      return { error: "کافه یافت نشد" };
    }
    return { error: "خطای غیرمنتظره؛ لطفاً دوباره تلاش کنید" };
  }

  // 4. Revalidate affected paths
  revalidatePath("/admin/cafes");
  revalidatePath(`/admin/cafes/${parsed.data.cafeId}`);

  return { ok: true };
}
