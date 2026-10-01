"use client";

import { IconListCheck } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { transferInternalPurchaseRequestToShoppingListAction } from "@/app/actions/shopping-list";
import { formatPersianNumber } from "@/src/lib/persian-format";

function transferMessage(transferredCount: number, skippedCount: number) {
  if (transferredCount > 0 && skippedCount > 0) {
    return `${formatPersianNumber(transferredCount)} قلم اضافه شد؛ ${formatPersianNumber(skippedCount)} قلم قبلاً در لیست خرید وجود داشت.`;
  }
  if (transferredCount > 0) {
    return `${formatPersianNumber(transferredCount)} قلم به لیست خرید اضافه شد.`;
  }
  return `${formatPersianNumber(skippedCount)} قلم قبلاً در لیست خرید وجود داشت و دوباره اضافه نشد.`;
}

function safeTransferError(message?: string) {
  if (
    !message ||
    /mongo|mongoose|validation failed|cast to|stack|\bat\s+\w+/i.test(message)
  ) {
    return "انتقال اقلام انجام نشد. لطفاً دوباره تلاش کنید.";
  }
  return message.slice(0, 240);
}

export function TransferToShoppingList({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const transferLockRef = useRef(false);

  function transfer() {
    if (isPending || transferLockRef.current) return;
    transferLockRef.current = true;
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        const result = await transferInternalPurchaseRequestToShoppingListAction(
          {},
          { requestId },
        );
        if (!result.ok) {
          setError(safeTransferError(result.error));
          return;
        }

        setMessage(
          transferMessage(
            result.transferredCount ?? 0,
            result.skippedCount ?? 0,
          ),
        );
        router.refresh();
      } catch {
        setError("ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.");
      } finally {
        transferLockRef.current = false;
      }
    });
  }

  return (
    <div className="w-full sm:w-auto">
      <button
        type="button"
        onClick={transfer}
        disabled={isPending}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-primary px-4 text-xs font-black text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60 sm:w-auto"
      >
        <IconListCheck className="size-4" aria-hidden="true" />
        {isPending
          ? "در حال افزودن اقلام…"
          : "افزودن اقلام تأییدشده به لیست خرید"}
      </button>
      <div aria-live="polite" aria-atomic="true">
        {message ? (
          <p className="mt-2 max-w-sm text-xs font-bold leading-6 text-success">
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-2 max-w-sm text-xs font-bold leading-6 text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
