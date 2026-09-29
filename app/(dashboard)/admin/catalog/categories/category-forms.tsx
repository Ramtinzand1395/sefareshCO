"use client";

import { useActionState, useState } from "react";
import { IconPlus, IconX } from "@tabler/icons-react";

import {
  createCategoryAction,
  updateCategoryStatusAction,
  type AdminCategoryActionState,
} from "@/app/actions/admin-categories";
import type {
  AdminCategoryListItemDTO,
  AdminCategorySimpleDTO,
} from "@/src/repositories/admin-category-repository";

const initialState: AdminCategoryActionState = {};

export function CategoryCreateForm({
  parentCategories,
}: {
  parentCategories: AdminCategorySimpleDTO[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createCategoryAction,
    initialState,
  );

  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-ink">افزودن دسته‌بندی جدید</h2>
          <p className="mt-1 text-xs text-ink-muted">
            دسته‌بندی‌های کاتالوگ را برای دسته‌بندی کالاهای Marketplace ایجاد کنید.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3.5 py-2 text-xs font-black text-white transition hover:bg-primary-hover"
        >
          {isOpen ? <IconX className="size-4" /> : <IconPlus className="size-4" />}
          {isOpen ? "بستن فرم" : "دسته‌بندی جدید"}
        </button>
      </div>

      {isOpen && (
        <form action={formAction} className="mt-5 space-y-4 border-t border-line pt-4">
          {state.error && (
            <div className="rounded-control bg-danger-soft p-3 text-xs font-bold text-danger">
              {state.error}
            </div>
          )}
          {state.ok && (
            <div className="rounded-control bg-success-soft p-3 text-xs font-bold text-success">
              دسته‌بندی با موفقیت ایجاد شد.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="cat-name"
                className="mb-1.5 block text-xs font-bold text-ink-muted"
              >
                نام دسته‌بندی *
              </label>
              <input
                id="cat-name"
                name="name"
                required
                placeholder="مثلاً دان قهوه، سیروپ و طعم‌دهنده‌ها"
                className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary"
              />
              {state.fieldErrors?.name && (
                <p className="mt-1 text-[11px] font-bold text-danger">
                  {state.fieldErrors.name[0]}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="cat-slug"
                className="mb-1.5 block text-xs font-bold text-ink-muted"
              >
                نامک انگلیسی (Slug) *
              </label>
              <input
                id="cat-slug"
                name="slug"
                required
                dir="ltr"
                placeholder="مثلاً coffee-beans"
                className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary"
              />
              {state.fieldErrors?.slug && (
                <p className="mt-1 text-[11px] font-bold text-danger">
                  {state.fieldErrors.slug[0]}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="cat-parent"
                className="mb-1.5 block text-xs font-bold text-ink-muted"
              >
                دسته‌بندی والد (اختیاری)
              </label>
              <select
                id="cat-parent"
                name="parentId"
                defaultValue=""
                className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary"
              >
                <option value="">(بدون والد — دسته‌بندی اصلی)</option>
                {parentCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.slug})
                  </option>
                ))}
              </select>
              {state.fieldErrors?.parentId && (
                <p className="mt-1 text-[11px] font-bold text-danger">
                  {state.fieldErrors.parentId[0]}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="cat-order"
                className="mb-1.5 block text-xs font-bold text-ink-muted"
              >
                ترتیب نمایش
              </label>
              <input
                id="cat-order"
                name="displayOrder"
                type="number"
                min="0"
                defaultValue="0"
                className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="cat-desc"
              className="mb-1.5 block text-xs font-bold text-ink-muted"
            >
              توضیحات (اختیاری)
            </label>
            <textarea
              id="cat-desc"
              name="description"
              rows={2}
              placeholder="توضیح کوتاه درباره اقلام موجود در این دسته..."
              className="w-full rounded-control border border-line bg-surface p-3 text-sm text-ink outline-none transition focus:border-primary"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-control bg-primary px-5 py-2 text-xs font-black text-white transition hover:bg-primary-hover disabled:opacity-50"
            >
              {isPending ? "در حال ذخیره..." : "ایجاد دسته‌بندی"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function CategoryStatusToggle({
  category,
}: {
  category: AdminCategoryListItemDTO;
}) {
  const [state, formAction, isPending] = useActionState(
    updateCategoryStatusAction,
    initialState,
  );

  const nextStatus = category.status === "active" ? "inactive" : "active";

  return (
    <form action={formAction} className="inline-block">
      <input type="hidden" name="categoryId" value={category.id} />
      <input type="hidden" name="status" value={nextStatus} />
      <button
        type="submit"
        disabled={isPending}
        className={`rounded-control px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50 ${
          category.status === "active"
            ? "bg-danger-soft text-danger hover:bg-danger hover:text-white"
            : "bg-success-soft text-success hover:bg-success hover:text-white"
        }`}
        title={
          category.status === "active"
            ? "غیرفعال‌سازی دسته‌بندی"
            : "فعال‌سازی دسته‌بندی"
        }
      >
        {isPending
          ? "..."
          : category.status === "active"
            ? "غیرفعال کن"
            : "فعال کن"}
      </button>
      {state.error && (
        <span className="ms-1 text-[10px] text-danger">{state.error}</span>
      )}
    </form>
  );
}
