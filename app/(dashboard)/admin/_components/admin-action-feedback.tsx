"use client";

export type AdminActionFeedbackState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export function AdminActionFeedback({
  state,
  isPending,
  successMessage,
  fieldName,
}: {
  state: AdminActionFeedbackState;
  isPending: boolean;
  successMessage: string;
  fieldName: string;
}) {
  const fieldError = state.fieldErrors?.[fieldName]?.[0];
  const message = isPending
    ? "در حال ثبت تغییرات…"
    : state.error ?? fieldError ?? (state.ok ? successMessage : undefined);
  const tone = state.error || fieldError ? "text-danger" : state.ok ? "text-success" : "text-ink-muted";

  return (
    <p className={`mt-3 min-h-5 text-xs font-bold ${tone}`} aria-live="polite" aria-atomic="true">
      {message}
    </p>
  );
}
