import { IconArrowRight, IconFileUnknown } from "@tabler/icons-react";
import Link from "next/link";

export default function InternalRequestNotFound() {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-card border border-line bg-surface p-8 text-center shadow-card">
      <span className="grid size-14 place-items-center rounded-full bg-warning-soft text-warning">
        <IconFileUnknown className="size-7" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-lg font-black text-ink">درخواست موردنظر پیدا نشد</h1>
      <p className="mt-2 max-w-md text-sm leading-7 text-ink-muted">
        ممکن است درخواست حذف شده باشد، شناسه آن درست نباشد یا به کافه دیگری تعلق داشته باشد.
      </p>
      <Link href="/cafe/internal-requests" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover">
        <IconArrowRight className="size-4" aria-hidden="true" />
        بازگشت به درخواست‌ها
      </Link>
    </div>
  );
}
