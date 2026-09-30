"use client";

import { useActionState, useState } from "react";
import {
  IconCheck,
  IconEdit,
  IconPlus,
  IconX,
} from "@tabler/icons-react";

import {
  createOfferAction,
  toggleOfferStatusAction,
  updateOfferAction,
  type SupplierOfferActionState,
} from "@/app/actions/supplier-offers";
import type { SupplierOfferListItemDTO } from "@/src/repositories/supplier-offer-repository";

const initialState: SupplierOfferActionState = {};

type ProductOption = {
  id: string;
  name: string;
  unit: string;
  categoryName?: string;
};

// ---------------------------------------------------------------------------
// Create Offer Form
// ---------------------------------------------------------------------------

export function OfferCreateForm({
  availableProducts,
}: {
  availableProducts: ProductOption[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [state, formAction, isPending] = useActionState(
    createOfferAction,
    initialState,
  );

  const selectedProduct = availableProducts.find(
    (p) => p.id === selectedProductId,
  );

  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-ink">
            عرضهٔ محصول در Marketplace
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            کالای مرجع مورد نظر را از کاتالوگ پلتفرم انتخاب کرده و قیمت، موجودی و
            شرایط تحویل خود را ثبت کنید.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 rounded-control bg-primary px-4 py-2.5 text-xs font-black text-white transition hover:bg-primary-hover shadow-sm"
        >
          {isOpen ? <IconX className="size-4" /> : <IconPlus className="size-4" />}
          {isOpen ? "بستن فرم" : "ثبت عرضه جدید"}
        </button>
      </div>

      {isOpen && (
        <form
          action={formAction}
          className="mt-5 space-y-4 border-t border-line pt-4"
        >
          {state.error && (
            <div className="rounded-control bg-danger-soft p-3 text-xs font-bold text-danger">
              {state.error}
            </div>
          )}
          {state.ok && (
            <div className="rounded-control bg-success-soft p-3 text-xs font-bold text-success flex items-center gap-2">
              <IconCheck className="size-4 shrink-0" />
              <span>عرضه با موفقیت در کاتالوگ شما ثبت شد.</span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* انتخاب محصول */}
            <div className="sm:col-span-2 lg:col-span-3">
              <label
                htmlFor="offer-product"
                className="mb-1.5 block text-xs font-bold text-ink-muted"
              >
                انتخاب کالای کاتالوگ *
              </label>
              <select
                id="offer-product"
                name="productId"
                required
                disabled={isPending}
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary disabled:opacity-60"
              >
                <option value="">-- برای انتخاب کالا کلیک کنید --</option>
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.unit}) {p.categoryName ? `[${p.categoryName}]` : ""}
                  </option>
                ))}
              </select>
              {state.fieldErrors?.productId && (
                <p className="mt-1 text-[11px] font-bold text-danger">
                  {state.fieldErrors.productId[0]}
                </p>
              )}
            </div>

            {/* قیمت به تومان */}
            <div>
              <label
                htmlFor="offer-price"
                className="mb-1.5 block text-xs font-bold text-ink-muted"
              >
                قیمت واحد فروش (تومان) *
              </label>
              <input
                id="offer-price"
                name="price"
                type="number"
                min="1"
                step="1"
                required
                disabled={isPending}
                placeholder="مثلاً ۲۵۰۰۰۰"
                className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-primary disabled:opacity-60"
              />
              {state.fieldErrors?.price && (
                <p className="mt-1 text-[11px] font-bold text-danger">
                  {state.fieldErrors.price[0]}
                </p>
              )}
            </div>

            {/* موجودی انبار */}
            <div>
              <label
                htmlFor="offer-stock"
                className="mb-1.5 block text-xs font-bold text-ink-muted"
              >
                موجودی انبار
                {selectedProduct ? ` (برحسب ${selectedProduct.unit})` : ""} *
              </label>
              <input
                id="offer-stock"
                name="stock"
                type="number"
                min="0"
                step="1"
                defaultValue="0"
                required
                disabled={isPending}
                className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-primary disabled:opacity-60"
              />
              {state.fieldErrors?.stock && (
                <p className="mt-1 text-[11px] font-bold text-danger">
                  {state.fieldErrors.stock[0]}
                </p>
              )}
            </div>

            {/* حداقل تعداد سفارش */}
            <div>
              <label
                htmlFor="offer-moq"
                className="mb-1.5 block text-xs font-bold text-ink-muted"
              >
                حداقل مقدار سفارش (MOQ)
                {selectedProduct ? ` (${selectedProduct.unit})` : ""} *
              </label>
              <input
                id="offer-moq"
                name="minOrderQuantity"
                type="number"
                min="1"
                step="1"
                defaultValue="1"
                required
                disabled={isPending}
                className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-primary disabled:opacity-60"
              />
              {state.fieldErrors?.minOrderQuantity && (
                <p className="mt-1 text-[11px] font-bold text-danger">
                  {state.fieldErrors.minOrderQuantity[0]}
                </p>
              )}
            </div>

            {/* زمان تحویل (روز) */}
            <div>
              <label
                htmlFor="offer-delivery"
                className="mb-1.5 block text-xs font-bold text-ink-muted"
              >
                زمان آماده‌سازی / تحویل (روز)
              </label>
              <input
                id="offer-delivery"
                name="deliveryDays"
                type="number"
                min="0"
                max="365"
                step="1"
                defaultValue="1"
                disabled={isPending}
                className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-primary disabled:opacity-60"
              />
              {state.fieldErrors?.deliveryDays && (
                <p className="mt-1 text-[11px] font-bold text-danger">
                  {state.fieldErrors.deliveryDays[0]}
                </p>
              )}
            </div>

            {/* وضعیت اولیه عرضه */}
            <div>
              <label
                htmlFor="offer-status"
                className="mb-1.5 block text-xs font-bold text-ink-muted"
              >
                وضعیت انتشار
              </label>
              <select
                id="offer-status"
                name="status"
                defaultValue="inactive"
                disabled={isPending}
                className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary disabled:opacity-60"
              >
                <option value="inactive">غیرفعال (پیش‌فرض)</option>
                <option value="active">فعال</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              disabled={isPending || !selectedProductId}
              className="inline-flex min-h-10 items-center justify-center rounded-control bg-primary px-6 text-xs font-black text-white transition hover:bg-primary-hover disabled:opacity-50"
            >
              {isPending ? "در حال ثبت..." : "ذخیره و ثبت عرضه"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Offer Modal / Inline Form
// ---------------------------------------------------------------------------

export function OfferEditModal({
  offer,
  onClose,
}: {
  offer: SupplierOfferListItemDTO;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    updateOfferAction,
    initialState,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-card border border-line bg-surface p-6 shadow-float">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <IconEdit className="size-5 text-primary" />
            <h3 className="text-sm font-black text-ink">
              ویرایش شرایط عرضه: {offer.productName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-control p-1 text-ink-muted hover:bg-surface-subtle"
          >
            <IconX className="size-4" />
          </button>
        </div>

        <form
          action={async (formData) => {
            await formAction(formData);
            if (!state.error && Object.keys(state.fieldErrors || {}).length === 0) {
              onClose();
            }
          }}
          className="mt-4 space-y-4"
        >
          <input type="hidden" name="offerId" value={offer.id} />

          {state.error && (
            <div className="rounded-control bg-danger-soft p-3 text-xs font-bold text-danger">
              {state.error}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="edit-price"
                className="mb-1 block text-xs font-bold text-ink-muted"
              >
                قیمت واحد (تومان) *
              </label>
              <input
                id="edit-price"
                name="price"
                type="number"
                min="1"
                step="1"
                required
                defaultValue={offer.price}
                disabled={isPending}
                className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-primary disabled:opacity-60"
              />
              {state.fieldErrors?.price && (
                <p className="mt-1 text-[11px] font-bold text-danger">
                  {state.fieldErrors.price[0]}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="edit-stock"
                className="mb-1 block text-xs font-bold text-ink-muted"
              >
                موجودی انبار ({offer.productUnit}) *
              </label>
              <input
                id="edit-stock"
                name="stock"
                type="number"
                min="0"
                step="1"
                required
                defaultValue={offer.stock}
                disabled={isPending}
                className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-primary disabled:opacity-60"
              />
              {state.fieldErrors?.stock && (
                <p className="mt-1 text-[11px] font-bold text-danger">
                  {state.fieldErrors.stock[0]}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="edit-moq"
                className="mb-1 block text-xs font-bold text-ink-muted"
              >
                حداقل سفارش ({offer.productUnit}) *
              </label>
              <input
                id="edit-moq"
                name="minOrderQuantity"
                type="number"
                min="1"
                step="1"
                required
                defaultValue={offer.minOrderQuantity}
                disabled={isPending}
                className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-primary disabled:opacity-60"
              />
              {state.fieldErrors?.minOrderQuantity && (
                <p className="mt-1 text-[11px] font-bold text-danger">
                  {state.fieldErrors.minOrderQuantity[0]}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="edit-delivery"
                className="mb-1 block text-xs font-bold text-ink-muted"
              >
                زمان تحویل (روز)
              </label>
              <input
                id="edit-delivery"
                name="deliveryDays"
                type="number"
                min="0"
                max="365"
                step="1"
                defaultValue={offer.deliveryDays}
                disabled={isPending}
                className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-primary disabled:opacity-60"
              />
              {state.fieldErrors?.deliveryDays && (
                <p className="mt-1 text-[11px] font-bold text-danger">
                  {state.fieldErrors.deliveryDays[0]}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-control border border-line px-4 py-2 text-xs font-bold text-ink-muted transition hover:bg-surface-subtle"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-control bg-primary px-5 py-2 text-xs font-black text-white transition hover:bg-primary-hover disabled:opacity-50"
            >
              {isPending ? "در حال ذخیره..." : "ذخیره تغییرات"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Status Toggle Button
// ---------------------------------------------------------------------------

export function OfferStatusToggle({
  offer,
}: {
  offer: SupplierOfferListItemDTO;
}) {
  const [state, formAction, isPending] = useActionState(
    toggleOfferStatusAction,
    initialState,
  );

  const nextStatus = offer.status === "active" ? "inactive" : "active";

  return (
    <div className="inline-flex flex-col items-center">
      <form action={formAction} className="inline-block">
        <input type="hidden" name="offerId" value={offer.id} />
        <input type="hidden" name="status" value={nextStatus} />
        <button
          type="submit"
          disabled={isPending}
          className={`rounded-control px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50 ${
            offer.status === "active"
              ? "bg-danger-soft text-danger hover:bg-danger hover:text-white"
              : "bg-success-soft text-success hover:bg-success hover:text-white"
          }`}
          title={
            offer.status === "active"
              ? "غیرفعال‌سازی عرضه"
              : "فعال‌سازی عرضه در Marketplace"
          }
        >
          {isPending
            ? "..."
            : offer.status === "active"
              ? "غیرفعال کن"
              : "فعال کن"}
        </button>
      </form>
      {state.error && (
        <span className="mt-1 max-w-[120px] text-[10px] font-bold text-danger text-center">
          {state.error}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action Buttons Wrapper (Edit + Toggle)
// ---------------------------------------------------------------------------

export function OfferRowActions({
  offer,
}: {
  offer: SupplierOfferListItemDTO;
}) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <>
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="inline-flex items-center gap-1 rounded-control border border-line px-2.5 py-1 text-[11px] font-bold text-ink-muted transition hover:border-primary hover:text-primary"
        >
          <IconEdit className="size-3.5" />
          ویرایش
        </button>
        <OfferStatusToggle offer={offer} />
      </div>

      {isEditing && (
        <OfferEditModal offer={offer} onClose={() => setIsEditing(false)} />
      )}
    </>
  );
}
