"use client";

import { useActionState } from "react";

import {
  updateSupplierStatusAction,
  updateSupplierVerificationAction,
  type AdminSupplierActionState,
} from "@/app/actions/admin-suppliers";

// ---------------------------------------------------------------------------
// Status form
// ---------------------------------------------------------------------------

const statusOptions = [
  { value: "pending", label: "در انتظار" },
  { value: "active", label: "فعال" },
  { value: "suspended", label: "تعلیق‌شده" },
  { value: "rejected", label: "رد‌شده" },
] as const;

export function SupplierStatusForm({
  supplierId,
  currentStatus,
}: {
  supplierId: string;
  currentStatus: string;
}) {
  const [state, action, isPending] = useActionState<
    AdminSupplierActionState,
    FormData
  >(updateSupplierStatusAction, {});

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <h3 className="text-sm font-black text-ink">تغییر وضعیت فعالیت</h3>

      <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="supplierId" value={supplierId} />

        <div>
          <label
            htmlFor="supplier-status"
            className="mb-1 block text-xs font-bold text-ink-muted"
          >
            وضعیت جدید
          </label>
          <select
            id="supplier-status"
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Verification form
// ---------------------------------------------------------------------------

export function SupplierVerificationForm({
  supplierId,
  isVerified,
}: {
  supplierId: string;
  isVerified: boolean;
}) {
  const [state, action, isPending] = useActionState<
    AdminSupplierActionState,
    FormData
  >(updateSupplierVerificationAction, {});

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <h3 className="text-sm font-black text-ink">وضعیت تأیید</h3>
      <p className="mt-1 text-xs text-ink-muted">
        وضعیت فعلی:{" "}
        <span
          className={`font-black ${isVerified ? "text-success" : "text-warning"}`}
        >
          {isVerified ? "تأییدشده" : "تأییدنشده"}
        </span>
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {/* Verify */}
        <form action={action}>
          <input type="hidden" name="supplierId" value={supplierId} />
          <input type="hidden" name="action" value="verified" />
          <button
            type="submit"
            disabled={isPending || isVerified}
            className="h-9 rounded-lg bg-success px-4 text-xs font-black text-white transition hover:bg-success/90 disabled:opacity-40"
          >
            {isPending ? "در حال ذخیره…" : "تأیید تأمین‌کننده"}
          </button>
        </form>

        {/* Unverify */}
        <form action={action}>
          <input type="hidden" name="supplierId" value={supplierId} />
          <input type="hidden" name="action" value="unverified" />
          <button
            type="submit"
            disabled={isPending || !isVerified}
            className="h-9 rounded-lg border border-danger px-4 text-xs font-black text-danger transition hover:bg-danger-soft disabled:opacity-40"
          >
            لغو تأیید
          </button>
        </form>
      </div>

      {state.ok && (
        <p className="mt-3 text-xs font-bold text-success">
          وضعیت تأیید با موفقیت تغییر کرد
        </p>
      )}
      {state.error && (
        <p className="mt-3 text-xs font-bold text-danger">{state.error}</p>
      )}
    </div>
  );
}
