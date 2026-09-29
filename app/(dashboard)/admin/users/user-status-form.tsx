"use client";

import { useActionState } from "react";

import {
  updateUserStatusAction,
  type AdminUserActionState,
} from "@/app/actions/admin-users";

const statusOptions = [
  { value: "active", label: "فعال" },
  { value: "pending", label: "در انتظار" },
  { value: "suspended", label: "تعلیق‌شده" },
  { value: "disabled", label: "غیرفعال" },
] as const;

export function UserStatusForm({
  userId,
  currentStatus,
}: {
  userId: string;
  currentStatus: string;
}) {
  const [state, action, isPending] = useActionState<
    AdminUserActionState,
    FormData
  >(updateUserStatusAction, {});

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <h3 className="text-sm font-black text-ink">تغییر وضعیت</h3>

      <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="userId" value={userId} />

        <div>
          <label
            htmlFor="status"
            className="mb-1 block text-xs font-bold text-ink-muted"
          >
            وضعیت جدید
          </label>
          <select
            id="status"
            name="status"
            defaultValue={currentStatus}
            className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="h-10 rounded-lg bg-primary px-5 text-sm font-black text-white transition hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "در حال ذخیره…" : "ذخیره"}
        </button>
      </form>

      {state.ok && (
        <p className="mt-3 text-xs font-bold text-success">
          وضعیت با موفقیت تغییر کرد
        </p>
      )}

      {state.error && (
        <p className="mt-3 text-xs font-bold text-danger">{state.error}</p>
      )}

      {state.fieldErrors?.status && (
        <p className="mt-3 text-xs font-bold text-danger">
          {state.fieldErrors.status[0]}
        </p>
      )}
    </div>
  );
}
