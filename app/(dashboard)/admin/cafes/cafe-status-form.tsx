"use client";

import { useActionState } from "react";

import {
  updateCafeStatusAction,
  type AdminCafeActionState,
} from "@/app/actions/admin-cafes";
import { AdminActionFeedback } from "@/app/(dashboard)/admin/_components/admin-action-feedback";

const statusOptions = [
  { value: "pending", label: "در انتظار" },
  { value: "active", label: "فعال" },
  { value: "suspended", label: "تعلیق‌شده" },
  { value: "rejected", label: "رد‌شده" },
] as const;

export function CafeStatusForm({
  cafeId,
  currentStatus,
}: {
  cafeId: string;
  currentStatus: string;
}) {
  const [state, action, isPending] = useActionState<
    AdminCafeActionState,
    FormData
  >(updateCafeStatusAction, {});

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="text-base font-black text-ink">تغییر وضعیت فعالیت</h2>
      <p className="mt-1 text-xs leading-6 text-ink-muted">
        وضعیت جدید بر امکان فعالیت این کسب‌وکار اثر می‌گذارد.
      </p>

      <form action={action} aria-busy={isPending} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="cafeId" value={cafeId} />

        <div>
          <label
            htmlFor="cafe-status"
            className="mb-1 block text-xs font-bold text-ink-muted"
          >
            وضعیت جدید
          </label>
          <select
            key={currentStatus}
            id="cafe-status"
            name="status"
            defaultValue={currentStatus}
            disabled={isPending}
            className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary disabled:cursor-wait disabled:opacity-60 sm:w-52"
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
          className="h-11 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-50"
        >
          {isPending ? "در حال ذخیره…" : "ذخیره"}
        </button>
      </form>

      <AdminActionFeedback state={state} isPending={isPending} successMessage="وضعیت کافه با موفقیت تغییر کرد." fieldName="status" />
    </section>
  );
}
