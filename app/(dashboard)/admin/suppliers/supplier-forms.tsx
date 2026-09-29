"use client";

import { useActionState } from "react";

import { AdminActionFeedback } from "@/app/(dashboard)/admin/_components/admin-action-feedback";
import {
  updateSupplierStatusAction,
  updateSupplierVerificationAction,
  type AdminSupplierActionState,
} from "@/app/actions/admin-suppliers";

const statusOptions = [
  { value: "pending", label: "در انتظار" },
  { value: "active", label: "فعال" },
  { value: "suspended", label: "تعلیق‌شده" },
  { value: "rejected", label: "ردشده" },
] as const;

export function SupplierStatusForm({
  supplierId,
  currentStatus,
}: {
  supplierId: string;
  currentStatus: string;
}) {
  const [state, action, isPending] = useActionState<AdminSupplierActionState, FormData>(
    updateSupplierStatusAction,
    {},
  );

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="text-base font-black text-ink">تغییر وضعیت فعالیت</h2>
      <p className="mt-1 text-xs leading-6 text-ink-muted">
        وضعیت جدید بر دسترسی عملیاتی تأمین‌کننده اثر می‌گذارد.
      </p>
      <form action={action} aria-busy={isPending} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="supplierId" value={supplierId} />
        <div className="flex-1">
          <label htmlFor="supplier-status" className="mb-1.5 block text-xs font-bold text-ink-muted">وضعیت جدید</label>
          <select
            key={currentStatus}
            id="supplier-status"
            name="status"
            defaultValue={currentStatus}
            disabled={isPending}
            className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary disabled:cursor-wait disabled:opacity-60"
          >
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <button type="submit" disabled={isPending} className="h-11 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-50">
          {isPending ? "در حال ذخیره…" : "ذخیره وضعیت"}
        </button>
      </form>
      <AdminActionFeedback state={state} isPending={isPending} successMessage="وضعیت تأمین‌کننده با موفقیت تغییر کرد." fieldName="status" />
    </section>
  );
}

export function SupplierVerificationForm({
  supplierId,
  isVerified,
}: {
  supplierId: string;
  isVerified: boolean;
}) {
  const [state, action, isPending] = useActionState<AdminSupplierActionState, FormData>(
    updateSupplierVerificationAction,
    {},
  );

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="text-base font-black text-ink">تأیید تأمین‌کننده</h2>
      <p className="mt-1 text-xs leading-6 text-ink-muted">
        وضعیت فعلی: <span className={`font-black ${isVerified ? "text-success" : "text-warning"}`}>{isVerified ? "تأییدشده" : "تأییدنشده"}</span>
      </p>
      <form action={action} aria-busy={isPending} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="supplierId" value={supplierId} />
        <button
          type="submit"
          name="action"
          value="verified"
          disabled={isPending || isVerified}
          className="min-h-11 rounded-control bg-success px-4 text-xs font-black text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? "در حال ثبت…" : "تأیید تأمین‌کننده"}
        </button>
        <button
          type="submit"
          name="action"
          value="unverified"
          disabled={isPending || !isVerified}
          className="min-h-11 rounded-control border border-danger px-4 text-xs font-black text-danger transition hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? "در حال ثبت…" : "لغو تأیید"}
        </button>
      </form>
      <AdminActionFeedback state={state} isPending={isPending} successMessage="وضعیت تأیید با موفقیت تغییر کرد." fieldName="action" />
    </section>
  );
}
