"use client";

import {
  IconCheck,
  IconEdit,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useRef,
  useState,
} from "react";

import {
  createInternalPurchaseRequestAction,
  type InternalPurchaseRequestActionState,
} from "@/app/actions/internal-purchase-requests";
import {
  CatalogProductPicker,
  type CatalogProductOption,
} from "@/app/(dashboard)/cafe/_components/catalog-product-picker";
import { InternalRequestDialog } from "@/app/(dashboard)/cafe/internal-requests/_components/internal-request-dialog";

export type InternalRequestCatalogOption = CatalogProductOption;

type RequestDraftItem = {
  clientId: string;
  itemType: "catalog" | "custom";
  productId?: string;
  title: string;
  unit: string;
  requestedQuantity: number;
  note?: string;
};

type ItemComposerState = {
  itemType: "catalog" | "custom";
  productId: string;
  customTitle: string;
  customUnit: string;
  requestedQuantity: string;
  note: string;
};

const initialActionState: InternalPurchaseRequestActionState = {};
const emptyComposer: ItemComposerState = {
  itemType: "catalog",
  productId: "",
  customTitle: "",
  customUnit: "",
  requestedQuantity: "1",
  note: "",
};

function FieldError({
  id,
  errors,
}: {
  id?: string;
  errors?: string[];
}) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-bold text-danger">
      {errors[0]}
    </p>
  );
}

export function NewInternalRequest({
  products,
}: {
  products: InternalRequestCatalogOption[];
}) {
  const [open, setOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  return (
    <div className="w-full sm:w-auto">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setSuccessMessage(null);
          setOpen(true);
        }}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-black text-white shadow-sm transition hover:bg-primary-hover sm:w-auto"
      >
        <IconPlus className="size-5" aria-hidden="true" />
        درخواست جدید
      </button>
      <span aria-live="polite">
        {successMessage ? (
          <span className="mt-2 block text-center text-xs font-bold text-success sm:text-start">
            {successMessage}
          </span>
        ) : null}
      </span>

      {open ? (
        <NewInternalRequestForm
          products={products}
          onClose={() => setOpen(false)}
          onSuccess={() => {
            setOpen(false);
            setSuccessMessage("درخواست داخلی با موفقیت ثبت شد.");
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function NewInternalRequestForm({
  products,
  onClose,
  onSuccess,
}: {
  products: InternalRequestCatalogOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const submitAction = useCallback(
    async (
      previousState: InternalPurchaseRequestActionState,
      payload: FormData,
    ) => {
      const result = await createInternalPurchaseRequestAction(
        previousState,
        payload,
      );
      if (result.ok) onSuccess();
      return result;
    },
    [onSuccess],
  );
  const [state, formAction, isPending] = useActionState(
    submitAction,
    initialActionState,
  );
  const [items, setItems] = useState<RequestDraftItem[]>([]);
  const [requestFields, setRequestFields] = useState({
    title: "",
    description: "",
  });
  const [composer, setComposer] = useState<ItemComposerState>(emptyComposer);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const selectedProduct = products.find(
    (product) => product.id === composer.productId,
  );

  const resetComposer = () => {
    setComposer((current) => ({
      ...emptyComposer,
      itemType: current.itemType,
    }));
    setEditingId(null);
    setComposerError(null);
  };

  const saveComposerItem = () => {
    const quantity = Number(composer.requestedQuantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      setComposerError("تعداد موردنیاز باید یک عدد صحیح و حداقل ۱ باشد.");
      return;
    }

    if (composer.itemType === "catalog" && !selectedProduct) {
      setComposerError("یک کالا از کاتالوگ انتخاب کنید.");
      return;
    }

    if (
      composer.itemType === "custom" &&
      (!composer.customTitle.trim() || !composer.customUnit.trim())
    ) {
      setComposerError("نام و واحد کالای خارج از کاتالوگ را وارد کنید.");
      return;
    }

    const nextItem: RequestDraftItem = {
      clientId: editingId ?? crypto.randomUUID(),
      itemType: composer.itemType,
      productId:
        composer.itemType === "catalog" ? selectedProduct!.id : undefined,
      title:
        composer.itemType === "catalog"
          ? selectedProduct!.name
          : composer.customTitle.trim(),
      unit:
        composer.itemType === "catalog"
          ? selectedProduct!.unit
          : composer.customUnit.trim(),
      requestedQuantity: quantity,
      note: composer.note.trim() || undefined,
    };

    setItems((current) =>
      editingId
        ? current.map((item) =>
            item.clientId === editingId ? nextItem : item,
          )
        : [...current, nextItem],
    );
    resetComposer();
  };

  const editItem = (item: RequestDraftItem) => {
    setEditingId(item.clientId);
    setComposer({
      itemType: item.itemType,
      productId: item.productId ?? "",
      customTitle: item.itemType === "custom" ? item.title : "",
      customUnit: item.itemType === "custom" ? item.unit : "",
      requestedQuantity: String(item.requestedQuantity),
      note: item.note ?? "",
    });
    setComposerError(null);
  };

  const serializedItems = JSON.stringify(
    items.map((item) =>
      item.itemType === "catalog"
        ? {
            itemType: "catalog",
            productId: item.productId,
            requestedQuantity: item.requestedQuantity,
            note: item.note,
          }
        : {
            itemType: "custom",
            customTitle: item.title,
            customUnit: item.unit,
            requestedQuantity: item.requestedQuantity,
            note: item.note,
          },
    ),
  );

  return (
    <InternalRequestDialog
      open
      title="ثبت درخواست خرید داخلی"
      description="اطلاعات درخواست را وارد کنید و اقلام موردنیاز را یکی‌یکی به فهرست بیفزایید."
      onClose={onClose}
      busy={isPending}
      initialFocusRef={titleRef}
    >
      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="items" value={serializedItems} />

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          {state.error ? (
            <div
              role="alert"
              className="rounded-control border border-danger/25 bg-danger-soft px-4 py-3 text-xs font-bold leading-6 text-danger"
            >
              {state.error}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="internal-request-title" className="mb-1.5 block text-xs font-bold text-ink-muted">
                عنوان درخواست
              </label>
              <input
                ref={titleRef}
                id="internal-request-title"
                name="title"
                type="text"
                maxLength={150}
                value={requestFields.title}
                onChange={(event) =>
                  setRequestFields((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                disabled={isPending}
                aria-invalid={Boolean(state.fieldErrors?.title)}
                aria-describedby={state.fieldErrors?.title ? "internal-request-title-error" : undefined}
                placeholder="مثلاً خرید مواد اولیه شیفت صبح"
                className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition placeholder:text-ink-muted/60 focus:border-primary disabled:opacity-60"
              />
              <FieldError id="internal-request-title-error" errors={state.fieldErrors?.title} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="internal-request-description" className="mb-1.5 block text-xs font-bold text-ink-muted">
                توضیحات
              </label>
              <textarea
                id="internal-request-description"
                name="description"
                maxLength={1000}
                rows={3}
                value={requestFields.description}
                onChange={(event) =>
                  setRequestFields((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                disabled={isPending}
                aria-invalid={Boolean(state.fieldErrors?.description)}
                aria-describedby={state.fieldErrors?.description ? "internal-request-description-error" : undefined}
                placeholder="جزئیات تکمیلی، زمان موردنیاز یا نکته‌ای برای مسئول خرید"
                className="w-full resize-y rounded-control border border-line bg-surface px-3 py-2.5 text-sm leading-7 text-ink outline-none transition placeholder:text-ink-muted/60 focus:border-primary disabled:opacity-60"
              />
              <FieldError id="internal-request-description-error" errors={state.fieldErrors?.description} />
            </div>
          </div>

          <section aria-labelledby="request-items-heading" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 id="request-items-heading" className="text-sm font-black text-ink">
                  اقلام درخواست
                </h3>
                <p className="mt-1 text-xs text-ink-muted">
                  {items.length === 0
                    ? "هنوز قلمی اضافه نشده است."
                    : `${items.length.toLocaleString("fa-IR")} قلم آماده ثبت است.`}
                </p>
              </div>
            </div>

            {items.length > 0 ? (
              <div className="space-y-2">
                {items.map((item) => (
                  <article
                    key={item.clientId}
                    className={`flex flex-col gap-3 rounded-control border p-3 sm:flex-row sm:items-center sm:justify-between ${
                      editingId === item.clientId
                        ? "border-primary bg-primary-soft/45"
                        : "border-line bg-surface-subtle/70"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words text-sm font-black text-ink">{item.title}</p>
                        <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-black text-ink-muted">
                          {item.itemType === "catalog" ? "کاتالوگ" : "خارج از کاتالوگ"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">
                        {item.requestedQuantity.toLocaleString("fa-IR")} {item.unit}
                        {item.note ? ` — ${item.note}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => editItem(item)}
                        disabled={isPending}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-control border border-line bg-surface px-3 text-xs font-bold text-ink-muted transition hover:border-primary hover:text-primary disabled:opacity-50"
                      >
                        <IconEdit className="size-4" aria-hidden="true" />
                        ویرایش
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setItems((current) =>
                            current.filter((currentItem) => currentItem.clientId !== item.clientId),
                          );
                          if (editingId === item.clientId) resetComposer();
                        }}
                        disabled={isPending}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-control border border-danger/25 bg-surface px-3 text-xs font-bold text-danger transition hover:bg-danger-soft disabled:opacity-50"
                      >
                        <IconTrash className="size-4" aria-hidden="true" />
                        حذف
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            <FieldError errors={state.fieldErrors?.items} />

            <div className="rounded-card border border-line bg-surface-subtle/60 p-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setComposer({ ...emptyComposer, itemType: "catalog" });
                    setEditingId(null);
                    setComposerError(null);
                  }}
                  aria-pressed={composer.itemType === "catalog"}
                  className={`min-h-10 flex-1 rounded-control border px-3 text-xs font-black transition ${
                    composer.itemType === "catalog"
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-line bg-surface text-ink-muted hover:border-primary/50"
                  }`}
                >
                  کالای کاتالوگ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setComposer({ ...emptyComposer, itemType: "custom" });
                    setEditingId(null);
                    setComposerError(null);
                  }}
                  aria-pressed={composer.itemType === "custom"}
                  className={`min-h-10 flex-1 rounded-control border px-3 text-xs font-black transition ${
                    composer.itemType === "custom"
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-line bg-surface text-ink-muted hover:border-primary/50"
                  }`}
                >
                  کالا در کاتالوگ نیست
                </button>
              </div>

              {composer.itemType === "catalog" ? (
                <div className="mt-4">
                  <CatalogProductPicker
                    products={products}
                    value={composer.productId}
                    disabled={isPending}
                    emptyMessage="در حال حاضر کالای قابل انتخابی در کاتالوگ نیست؛ از گزینه خارج از کاتالوگ استفاده کنید."
                    onChange={(productId) => {
                      setComposer((current) => ({ ...current, productId }));
                      setComposerError(null);
                    }}
                  />
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="custom-item-title" className="mb-1.5 block text-xs font-bold text-ink-muted">
                      نام کالا <span aria-hidden="true">*</span>
                    </label>
                    <input
                      id="custom-item-title"
                      type="text"
                      maxLength={150}
                      value={composer.customTitle}
                      onChange={(event) => setComposer((current) => ({ ...current, customTitle: event.target.value }))}
                      disabled={isPending}
                      className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label htmlFor="custom-item-unit" className="mb-1.5 block text-xs font-bold text-ink-muted">
                      واحد <span aria-hidden="true">*</span>
                    </label>
                    <input
                      id="custom-item-unit"
                      type="text"
                      maxLength={50}
                      value={composer.customUnit}
                      onChange={(event) => setComposer((current) => ({ ...current, customUnit: event.target.value }))}
                      disabled={isPending}
                      placeholder="عدد، کیلوگرم، بسته و…"
                      className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary disabled:opacity-60"
                    />
                  </div>
                </div>
              )}

              <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <div>
                  <label htmlFor="request-item-quantity" className="mb-1.5 block text-xs font-bold text-ink-muted">
                    تعداد موردنیاز <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="request-item-quantity"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={composer.requestedQuantity}
                    onChange={(event) => setComposer((current) => ({ ...current, requestedQuantity: event.target.value }))}
                    disabled={isPending}
                    className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-primary disabled:opacity-60"
                  />
                </div>
                <div>
                  <label htmlFor="request-item-note" className="mb-1.5 block text-xs font-bold text-ink-muted">
                    یادداشت قلم
                  </label>
                  <input
                    id="request-item-note"
                    type="text"
                    maxLength={300}
                    value={composer.note}
                    onChange={(event) => setComposer((current) => ({ ...current, note: event.target.value }))}
                    disabled={isPending}
                    placeholder="برند ترجیحی یا توضیح کوتاه"
                    className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary disabled:opacity-60"
                  />
                </div>
              </div>

              {composerError ? <p role="alert" className="mt-3 text-xs font-bold text-danger">{composerError}</p> : null}

              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {editingId ? (
                  <button type="button" onClick={resetComposer} disabled={isPending} className="min-h-10 rounded-control border border-line bg-surface px-4 text-xs font-bold text-ink-muted transition hover:bg-surface-subtle disabled:opacity-50">
                    انصراف از ویرایش
                  </button>
                ) : null}
                <button type="button" onClick={saveComposerItem} disabled={isPending} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-control border border-primary bg-surface px-4 text-xs font-black text-primary transition hover:bg-primary-soft disabled:opacity-50">
                  {editingId ? <IconCheck className="size-4" aria-hidden="true" /> : <IconPlus className="size-4" aria-hidden="true" />}
                  {editingId ? "ذخیره تغییر قلم" : "افزودن این قلم"}
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line bg-surface px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
          <button type="button" onClick={onClose} disabled={isPending} className="min-h-11 rounded-control border border-line px-4 text-sm font-bold text-ink-muted transition hover:bg-surface-subtle disabled:opacity-50">
            انصراف
          </button>
          <button
            type="submit"
            disabled={isPending || items.length === 0 || Boolean(editingId)}
            className="min-h-11 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "در حال ثبت درخواست…" : "ثبت درخواست"}
          </button>
        </div>
      </form>
    </InternalRequestDialog>
  );
}
