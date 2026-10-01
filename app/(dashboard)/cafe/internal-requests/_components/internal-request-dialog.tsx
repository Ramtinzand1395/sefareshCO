"use client";

import { IconX } from "@tabler/icons-react";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
} from "react";

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function InternalRequestDialog({
  open,
  title,
  description,
  onClose,
  children,
  busy = false,
  size = "lg",
  initialFocusRef,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
  size?: "sm" | "lg";
  initialFocusRef?: RefObject<HTMLElement | null>;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const preferredFocus = initialFocusRef?.current;
    const firstFocusable = dialog?.querySelector<HTMLElement>(focusableSelector);
    (preferredFocus ?? firstFocusable ?? dialog)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [busy, initialFocusRef, onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={busy}
        tabIndex={-1}
        className={`flex max-h-[calc(100dvh-0.75rem)] w-full flex-col overflow-hidden rounded-t-card border border-line bg-surface shadow-float sm:max-h-[calc(100dvh-2rem)] sm:rounded-card ${
          size === "sm" ? "sm:max-w-md" : "sm:max-w-3xl"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-black text-ink sm:text-lg">
              {title}
            </h2>
            <p
              id={descriptionId}
              className="mt-1 text-xs leading-6 text-ink-muted sm:text-sm"
            >
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="بستن پنجره"
            className="grid size-10 shrink-0 place-items-center rounded-control text-ink-muted transition hover:bg-surface-subtle disabled:opacity-50"
          >
            <IconX className="size-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
