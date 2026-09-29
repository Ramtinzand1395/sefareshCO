"use client";

import { useActionState, useState } from "react";
import { IconPlus, IconX } from "@tabler/icons-react";

import {
  createProductAction,
  updateProductStatusAction,
  type AdminProductActionState,
} from "@/app/actions/admin-products";
import type { AdminCategorySimpleDTO } from "@/src/repositories/admin-category-repository";
import type { AdminProductListItemDTO } from "@/src/repositories/admin-product-repository";

const initialState: AdminProductActionState = {};

export function ProductCreateForm({
  categories,
}: {
  categories: AdminCategorySimpleDTO[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createProductAction,
    initialState,
  );

  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-ink">افزودن کالای مرجع جدید</h2>
          <p className="mt-1 text-xs text-ink-muted">
            مشخصات مشترک کالا را ثبت کنید. (قیمت و موجودی بعداً توسط تأمین‌کنندگان در
            SupplierOffer تعیین می‌شود).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3.5 py-2 text-xs font-black text-white transition hover:bg-primary-hover"
        >
          {isOpen ? <IconX className="size-4" /> : <IconPlus className="size-4" />}
          {isOpen ? "بستن فرم" : "محصول جدید"}
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
              محصول مرجع با موفقیت به کاتالوگ افزوده شد.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="prod-name"
                className="mb-1.5 block text-xs font-bold text-ink-muted"
              >
                نام کالا *
              </label>
              <input
                id="prod-name"
                name="name"
                required
                placeholder="مثلاً دان قهوه ۱۰۰٪ عربیکا کلمبیا"
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
                htmlFor="prod-slug"
                className="mb-1.5 block text-xs font-bold text-ink-muted"
              >
                نامک انگلیسی (Slug) *
              </label>
              <input
                id="prod-slug"
                name="slug"
                required
                dir="ltr"
                placeholder="مثلاً arabica-colombia-1kg"
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
                htmlFor="prod-cat"
                className="mb-1.5 block text-xs font-bold text-ink-muted"
              >
                دسته‌بندی *
              </label>
              <select
                id="prod-cat"
                name="categoryId"
                required
                className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary"
              >
                <option value="">انتخاب دسته‌بندی...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} {cat.status === "inactive" ? "(غیرفعال)" : ""}
                  </option>
                ))}
              </select>
              {state.fieldErrors?.categoryId && (
                <p className="mt-1 text-[11px] font-bold text-danger">
                  {state.fieldErrors.categoryId[0]}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="prod-brand"
                className="mb-1.5 block text-xs font-bold text-ink-muted"
              >
                برند (اختیاری)
              </label>
              <input
                id="prod-brand"
                name="brand"
                placeholder="مثلاً بن‌مانو، ایلی، کاله"
                className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary"
              />
            </div>

            <div>
              <label
                htmlFor="prod-unit"
                className="mb-1.5 block text-xs font-bold text-ink-muted"
              >
                واحد سنجش *
              </label>
              <input
                id="prod-unit"
                name="unit"
                required
                defaultValue="کیلوگرم"
                placeholder="مثلاً کیلوگرم، بسته، بطری، کارتن"
                className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary"
              />
              {state.fieldErrors?.unit && (
                <p className="mt-1 text-[11px] font-bold text-danger">
                  {state.fieldErrors.unit[0]}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="prod-sku"
                className="mb-1.5 block text-xs font-bold text-ink-muted"
              >
                کد کالا (SKU)
              </label>
              <input
                id="prod-sku"
                name="sku"
                dir="ltr"
                placeholder="مثلاً COF-ARB-001"
                className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary"
              />
              {state.fieldErrors?.sku && (
                <p className="mt-1 text-[11px] font-bold text-danger">
                  {state.fieldErrors.sku[0]}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="prod-barcode"
                className="mb-1.5 block text-xs font-bold text-ink-muted"
              >
                بارکد بین‌المللی
              </label>
              <input
                id="prod-barcode"
                name="barcode"
                dir="ltr"
                placeholder="مثلاً 6260123456789"
                className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary"
              />
              {state.fieldErrors?.barcode && (
                <p className="mt-1 text-[11px] font-bold text-danger">
                  {state.fieldErrors.barcode[0]}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="prod-status"
                className="mb-1.5 block text-xs font-bold text-ink-muted"
              >
                وضعیت انتشار اولیه
              </label>
              <select
                id="prod-status"
                name="status"
                defaultValue="draft"
                className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary"
              >
                <option value="draft">پیش‌نویس</option>
                <option value="active">فعال</option>
                <option value="inactive">غیرفعال</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="prod-desc"
              className="mb-1.5 block text-xs font-bold text-ink-muted"
            >
              مشخصات و توضیحات تکمیلی کالا
            </label>
            <textarea
              id="prod-desc"
              name="description"
              rows={2}
              placeholder="توضیحات استاندارد کالا، ویژگی‌های فنی، نوع فرآوری..."
              className="w-full rounded-control border border-line bg-surface p-3 text-sm text-ink outline-none transition focus:border-primary"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-control bg-primary px-5 py-2 text-xs font-black text-white transition hover:bg-primary-hover disabled:opacity-50"
            >
              {isPending ? "در حال ذخیره..." : "ثبت محصول در کاتالوگ"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function ProductStatusSelector({
  product,
}: {
  product: AdminProductListItemDTO;
}) {
  const [state, formAction, isPending] = useActionState(
    updateProductStatusAction,
    initialState,
  );

  return (
    <form action={formAction} className="inline-flex items-center gap-1.5">
      <input type="hidden" name="productId" value={product.id} />
      <select
        name="status"
        defaultValue={product.status}
        disabled={isPending}
        onChange={(e) => e.target.form?.requestSubmit()}
        className="h-7 rounded-control border border-line bg-surface px-2 text-[11px] font-bold text-ink outline-none transition focus:border-primary disabled:opacity-50"
      >
        <option value="draft">پیش‌نویس</option>
        <option value="active">فعال</option>
        <option value="inactive">غیرفعال</option>
      </select>
      {state.error && (
        <span className="text-[10px] text-danger">{state.error}</span>
      )}
    </form>
  );
}
