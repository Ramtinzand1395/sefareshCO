import { IconUserOff } from "@tabler/icons-react";
import Link from "next/link";

export default function AdminNotFound() {
  return (
    <section className="mx-auto flex min-h-[55vh] w-full max-w-3xl items-center justify-center">
      <div className="w-full rounded-card border border-line bg-surface p-6 text-center shadow-card sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
          <IconUserOff className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-black text-ink">کاربر پیدا نشد</h1>
        <p className="mt-3 text-sm leading-7 text-ink-muted">
          این حساب وجود ندارد یا قبلاً حذف شده است.
        </p>
        <Link
          href="/admin/users"
          className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover"
        >
          بازگشت به کاربران
        </Link>
      </div>
    </section>
  );
}
