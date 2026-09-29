"use server";

import { revalidatePath } from "next/cache";

import {
  updateSupplierStatusSchema,
  updateSupplierVerificationSchema,
} from "@/src/domain/schemas/admin-supplier";
import { requireAdmin } from "@/src/lib/admin-helpers";
import {
  updateAdminSupplierStatus,
  updateAdminSupplierVerification,
  SupplierNotFoundError,
} from "@/src/services/admin-supplier-service";

export type AdminSupplierActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

// ---------------------------------------------------------------------------
// Update status
// ---------------------------------------------------------------------------

export async function updateSupplierStatusAction(
  _state: AdminSupplierActionState,
  formData: FormData,
): Promise<AdminSupplierActionState> {
  // 1. Independent admin authorization
  await requireAdmin();

  // 2. Zod validation
  const parsed = updateSupplierStatusSchema.safeParse({
    supplierId: formData.get("supplierId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // 3. Service call
  try {
    await updateAdminSupplierStatus(parsed.data.supplierId, parsed.data.status);
  } catch (error) {
    if (error instanceof SupplierNotFoundError) {
      return { error: "تأمین‌کننده یافت نشد" };
    }
    return { error: "خطای غیرمنتظره؛ لطفاً دوباره تلاش کنید" };
  }

  // 4. Revalidate
  revalidatePath("/admin/suppliers");
  revalidatePath(`/admin/suppliers/${parsed.data.supplierId}`);
  revalidatePath("/admin");

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Update verification
// ---------------------------------------------------------------------------

export async function updateSupplierVerificationAction(
  _state: AdminSupplierActionState,
  formData: FormData,
): Promise<AdminSupplierActionState> {
  // 1. Independent admin authorization
  await requireAdmin();

  // 2. Zod validation
  const parsed = updateSupplierVerificationSchema.safeParse({
    supplierId: formData.get("supplierId"),
    action: formData.get("action"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // 3. Service call
  try {
    await updateAdminSupplierVerification(
      parsed.data.supplierId,
      parsed.data.action,
    );
  } catch (error) {
    if (error instanceof SupplierNotFoundError) {
      return { error: "تأمین‌کننده یافت نشد" };
    }
    return { error: "خطای غیرمنتظره؛ لطفاً دوباره تلاش کنید" };
  }

  // 4. Revalidate
  revalidatePath("/admin/suppliers");
  revalidatePath(`/admin/suppliers/${parsed.data.supplierId}`);
  revalidatePath("/admin");

  return { ok: true };
}
