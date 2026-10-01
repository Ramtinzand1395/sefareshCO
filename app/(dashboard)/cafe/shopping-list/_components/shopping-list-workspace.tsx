"use client";

import {
  IconArrowLeft,
  IconClipboardList,
  IconEdit,
  IconInfoCircle,
  IconListDetails,
  IconPackage,
  IconPlus,
  IconScale,
  IconSend,
  IconShoppingBag,
  IconTrash,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import {
  addCatalogItemToShoppingListAction,
  addCustomItemToShoppingListAction,
  removeShoppingListItemAction,
  type ShoppingListActionState,
  updateShoppingListItemQuantityAction,
} from "@/app/actions/shopping-list";
import {
  CatalogProductPicker,
  type CatalogProductOption,
} from "@/app/(dashboard)/cafe/_components/catalog-product-picker";
import { InternalRequestDialog } from "@/app/(dashboard)/cafe/internal-requests/_components/internal-request-dialog";
import type {
  AggregatedShoppingListItemDTO,
  ShoppingListDetailDTO,
  ShoppingListItemDTO,
} from "@/src/domain/shopping-list";
import {
  formatPersianDateTime,
  formatPersianNumber,
} from "@/src/lib/persian-format";

type WorkspaceDialog =
  | { kind: "add" }
  | { kind: "sources"; aggregate: AggregatedShoppingListItemDTO }
  | { kind: "edit"; item: ShoppingListItemDTO }
  | { kind: "remove"; item: ShoppingListItemDTO }
  | null;

type FieldErrors = Partial<
  Record<"productId" | "customTitle" | "customUnit" | "quantity" | "note", string>
>;

function itemTitle(item: {
  itemType: "catalog" | "custom";
  productName?: string;
  customTitle?: string;
}) {
  return item.itemType === "catalog"
    ? item.productName || "کالای کاتالوگ"
    : item.customTitle || "کالای سفارشی";
}

function itemUnit(item: {
  itemType: "catalog" | "custom";
  productUnit?: string;
  customUnit?: string;
}) {
  return item.itemType === "catalog"
    ? item.productUnit || "واحد"
    : item.customUnit || "واحد";
}

function latestUpdatedAt(aggregate: AggregatedShoppingListItemDTO) {
  return aggregate.items.reduce((latest, item) => {
    if (!item.updatedAt) return latest;
    if (!latest) return item.updatedAt;
    return new Date(item.updatedAt).getTime() > new Date(latest).getTime()
      ? item.updatedAt
      : latest;
  }, "");
}

function sourceLabel(item: ShoppingListItemDTO) {
  return item.sourceType === "internal_request"
    ? "درخواست داخلی"
    : "افزوده‌شده مستقیم";
}

function safeActionError(message?: string) {
  if (
    !message ||
    /mongo|mongoose|validation failed|cast to|stack|\bat\s+\w+/i.test(message)
  ) {
    return "عملیات انجام نشد. لطفاً دوباره تلاش کنید.";
  }
  return message.slice(0, 240);
}

function TypeBadge({ type }: { type: "catalog" | "custom" }) {
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full px-2 text-[10px] font-black ${
        type === "catalog"
          ? "bg-primary-soft text-primary"
          : "bg-violet-soft text-violet"
      }`}
    >
      {type === "catalog" ? "کاتالوگ" : "سفارشی"}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  caption,
  tone = "primary",
}: {
  label: string;
  value: number;
  caption: string;
  tone?: "primary" | "success" | "violet" | "accent";
}) {
  const toneClasses = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    violet: "bg-violet-soft text-violet",
    accent: "bg-accent-soft text-warning",
  }[tone];

  return (
    <article className="min-w-0 rounded-card border border-line bg-surface p-4 shadow-card">
      <div className={`grid size-9 place-items-center rounded-control ${toneClasses}`}>
        <IconScale className="size-4" aria-hidden="true" />
      </div>
      <p className="mt-3 text-xs font-bold text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-black tabular-nums text-ink">
        {formatPersianNumber(value)}
      </p>
      <p className="mt-1 truncate text-[11px] text-ink-muted">{caption}</p>
    </article>
  );
}

export function ShoppingListWorkspace({
  list,
  canManage,
  canCreateRfq,
  products,
}: {
  list: ShoppingListDetailDTO;
  canManage: boolean;
  canCreateRfq: boolean;
  products: CatalogProductOption[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<WorkspaceDialog>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const mutationLockRef = useRef(false);

  const directCount = list.items.filter(
    (item) => item.sourceType === "direct",
  ).length;
  const internalCount = list.items.length - directCount;

  function openDialog(nextDialog: NonNullable<WorkspaceDialog>) {
    setOperationError(null);
    setDialog(nextDialog);
  }

  function runMutation(
    task: () => Promise<ShoppingListActionState>,
    successMessage: string,
  ) {
    if (isPending || mutationLockRef.current) return;
    mutationLockRef.current = true;
    setOperationError(null);
    setFeedback(null);

    startTransition(async () => {
      try {
        const result = await task();
        if (!result.ok) {
          setOperationError(safeActionError(result.error));
          return;
        }

        setDialog(null);
        setFeedback(successMessage);
        router.refresh();
      } catch {
        setOperationError("ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.");
      } finally {
        mutationLockRef.current = false;
      }
    });
  }

  function editAggregate(aggregate: AggregatedShoppingListItemDTO) {
    if (aggregate.items.length === 1) {
      openDialog({ kind: "edit", item: aggregate.items[0] });
    } else {
      openDialog({ kind: "sources", aggregate });
    }
  }

  function removeAggregate(aggregate: AggregatedShoppingListItemDTO) {
    if (aggregate.items.length === 1) {
      openDialog({ kind: "remove", item: aggregate.items[0] });
    } else {
      openDialog({ kind: "sources", aggregate });
    }
  }

  return (
    <div className="cafe-content-container space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black tracking-wide text-primary">
            آماده‌سازی خرید کافه
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">
            لیست خرید
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-muted">
            کالاهای موردنیاز کافه را قبل از استعلام قیمت مدیریت کنید.
          </p>
        </div>
        {canManage || canCreateRfq ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {canCreateRfq && list.aggregatedItems.length > 0 ? (
              <Link
                href="/cafe/purchase-requests?new=1"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control border border-primary bg-surface px-5 text-sm font-black text-primary transition hover:bg-primary-soft sm:min-h-11 sm:w-auto"
              >
                <IconSend className="size-5" aria-hidden="true" />
                ایجاد استعلام
              </Link>
            ) : null}
            {canManage ? (
              <button
                type="button"
                onClick={() => openDialog({ kind: "add" })}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-black text-white shadow-sm transition hover:bg-primary-hover sm:min-h-11 sm:w-auto"
              >
                <IconPlus className="size-5" aria-hidden="true" />
                افزودن کالا
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      <div aria-live="polite" aria-atomic="true">
        {feedback ? (
          <div className="flex items-start gap-2 rounded-control border border-success/25 bg-success-soft px-4 py-3 text-xs font-bold leading-6 text-success">
            <IconInfoCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {feedback}
          </div>
        ) : null}
      </div>

      <section aria-label="خلاصه لیست خرید" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard
          label="کالاهای یکتا"
          value={list.aggregatedItems.length}
          caption={`${formatPersianNumber(list.itemCount)} منبع ثبت‌شده`}
        />
        <SummaryCard
          label="مجموع مقدار نیاز"
          value={list.totalQuantity}
          caption="در همه واحدهای ثبت‌شده"
          tone="success"
        />
        <SummaryCard
          label="اقلام مستقیم"
          value={directCount}
          caption="ثبت‌شده در همین لیست"
          tone="violet"
        />
        <SummaryCard
          label="از درخواست داخلی"
          value={internalCount}
          caption="اقلام تأیید و منتقل‌شده"
          tone="accent"
        />
      </section>

      {list.aggregatedItems.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-card border border-line bg-surface p-7 text-center shadow-card sm:p-12">
          <div className="grid size-16 place-items-center rounded-full bg-primary-soft text-primary">
            <IconShoppingBag className="size-8" aria-hidden="true" />
          </div>
          <h2 className="mt-5 text-lg font-black text-ink">
            لیست خرید شما هنوز خالی است.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-7 text-ink-muted">
            کالاهای موردنیاز را مستقیماً اضافه کنید یا اقلام تأییدشده
            درخواست‌های داخلی را به این لیست منتقل کنید.
          </p>
          {canManage ? (
            <button
              type="button"
              onClick={() => openDialog({ kind: "add" })}
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover sm:w-auto"
            >
              <IconPlus className="size-5" aria-hidden="true" />
              افزودن اولین کالا
            </button>
          ) : null}
        </section>
      ) : (
        <section aria-labelledby="shopping-list-items-title">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="shopping-list-items-title" className="text-base font-black text-ink">
                کالاهای موردنیاز
              </h2>
              <p className="mt-1 text-xs leading-6 text-ink-muted">
                هر کالا یک‌بار نمایش داده می‌شود؛ جزئیات منابع مقدار را جداگانه ببینید.
              </p>
            </div>
            <p className="text-xs font-bold text-ink-muted">
              آخرین تغییر: {formatPersianDateTime(list.updatedAt)}
            </p>
          </div>

          <div className="shopping-list-table overflow-hidden rounded-card border border-line bg-surface shadow-card">
            <table className="w-full table-fixed text-start text-xs">
              <thead className="bg-surface-subtle text-ink-muted">
                <tr>
                  <th className="w-[28%] px-4 py-3 text-start font-black">کالا</th>
                  <th className="w-[12%] px-3 py-3 text-start font-black">واحد</th>
                  <th className="w-[13%] px-3 py-3 text-start font-black">مقدار کل</th>
                  <th className="w-[18%] px-3 py-3 text-start font-black">منابع</th>
                  <th className="w-[16%] px-3 py-3 text-start font-black">آخرین تغییر</th>
                  <th className="w-[13%] px-4 py-3 text-end font-black">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.aggregatedItems.map((aggregate) => (
                  <tr key={aggregate.key} className="transition hover:bg-surface-subtle/60">
                    <td className="px-4 py-4 align-middle">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-control bg-primary-soft text-primary">
                          {aggregate.itemType === "catalog" ? (
                            <IconPackage className="size-4" aria-hidden="true" />
                          ) : (
                            <IconClipboardList className="size-4" aria-hidden="true" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-ink" title={itemTitle(aggregate)}>
                            {itemTitle(aggregate)}
                          </p>
                          <div className="mt-1"><TypeBadge type={aggregate.itemType} /></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 font-bold text-ink">{itemUnit(aggregate)}</td>
                    <td className="px-3 py-4 text-base font-black tabular-nums text-primary">
                      {formatPersianNumber(aggregate.totalQuantity)}
                    </td>
                    <td className="px-3 py-4">
                      <button
                        type="button"
                        onClick={() => openDialog({ kind: "sources", aggregate })}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-control px-2 font-black text-primary transition hover:bg-primary-soft"
                      >
                        <IconListDetails className="size-4" aria-hidden="true" />
                        {formatPersianNumber(aggregate.itemCount)} منبع
                      </button>
                    </td>
                    <td className="px-3 py-4 leading-6 text-ink-muted">
                      {formatPersianDateTime(latestUpdatedAt(aggregate))}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-1">
                        {canManage ? (
                          <>
                            <button
                              type="button"
                              onClick={() => editAggregate(aggregate)}
                              aria-label={`ویرایش مقدار ${itemTitle(aggregate)}`}
                              className="grid size-10 place-items-center rounded-control text-ink-muted transition hover:bg-primary-soft hover:text-primary"
                            >
                              <IconEdit className="size-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeAggregate(aggregate)}
                              aria-label={`حذف منبع ${itemTitle(aggregate)}`}
                              className="grid size-10 place-items-center rounded-control text-ink-muted transition hover:bg-danger-soft hover:text-danger"
                            >
                              <IconTrash className="size-4" aria-hidden="true" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="shopping-list-cards grid gap-3">
            {list.aggregatedItems.map((aggregate) => (
              <article key={aggregate.key} className="min-w-0 rounded-card border border-line bg-surface p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-black leading-6 text-ink">
                      {itemTitle(aggregate)}
                    </h3>
                    <div className="mt-2"><TypeBadge type={aggregate.itemType} /></div>
                  </div>
                  <div className="shrink-0 rounded-control bg-primary-soft px-3 py-2 text-center text-primary">
                    <p className="text-[10px] font-bold">مقدار کل</p>
                    <p className="mt-0.5 text-lg font-black tabular-nums">
                      {formatPersianNumber(aggregate.totalQuantity)}
                    </p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 border-y border-line/70 py-3 text-xs">
                  <div>
                    <dt className="text-[11px] font-bold text-ink-muted">واحد</dt>
                    <dd className="mt-1 font-black text-ink">{itemUnit(aggregate)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold text-ink-muted">منشأ مقدار</dt>
                    <dd className="mt-1 font-black text-ink">
                      {formatPersianNumber(aggregate.itemCount)} منبع
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openDialog({ kind: "sources", aggregate })}
                    className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control border border-line px-3 text-xs font-black text-ink-muted transition hover:border-primary hover:text-primary ${canManage ? "" : "col-span-2"}`}
                  >
                    <IconListDetails className="size-4" aria-hidden="true" />
                    جزئیات منابع
                  </button>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => editAggregate(aggregate)}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control bg-primary-soft px-3 text-xs font-black text-primary transition hover:bg-primary/15"
                    >
                      <IconEdit className="size-4" aria-hidden="true" />
                      {aggregate.itemCount === 1 ? "ویرایش مقدار" : "انتخاب برای ویرایش"}
                    </button>
                  ) : null}
                </div>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => removeAggregate(aggregate)}
                    className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-control border border-danger/20 text-xs font-black text-danger transition hover:bg-danger-soft"
                  >
                    <IconTrash className="size-4" aria-hidden="true" />
                    {aggregate.itemCount === 1 ? "حذف از لیست" : "انتخاب منبع برای حذف"}
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      )}

      {dialog?.kind === "add" ? (
        <AddItemDialog
          products={products}
          busy={isPending}
          operationError={operationError}
          onClose={() => !isPending && setDialog(null)}
          onSubmit={(kind, payload) =>
            runMutation(
              () =>
                kind === "catalog"
                  ? addCatalogItemToShoppingListAction({}, payload)
                  : addCustomItemToShoppingListAction({}, payload),
              "کالا با موفقیت به لیست خرید اضافه شد.",
            )
          }
        />
      ) : null}

      {dialog?.kind === "sources" ? (
        <SourcesDialog
          aggregate={dialog.aggregate}
          canManage={canManage}
          onClose={() => setDialog(null)}
          onEdit={(item) => openDialog({ kind: "edit", item })}
          onRemove={(item) => openDialog({ kind: "remove", item })}
        />
      ) : null}

      {dialog?.kind === "edit" ? (
        <EditQuantityDialog
          item={dialog.item}
          busy={isPending}
          operationError={operationError}
          onClose={() => !isPending && setDialog(null)}
          onSubmit={(payload) =>
            runMutation(
              () => updateShoppingListItemQuantityAction({}, payload),
              "مقدار فعلی با موفقیت به‌روزرسانی شد.",
            )
          }
        />
      ) : null}

      {dialog?.kind === "remove" ? (
        <RemoveItemDialog
          item={dialog.item}
          busy={isPending}
          operationError={operationError}
          onClose={() => !isPending && setDialog(null)}
          onConfirm={() =>
            runMutation(
              () =>
                removeShoppingListItemAction(
                  {},
                  { itemId: dialog.item.id },
                ),
              "منبع انتخاب‌شده از لیست خرید حذف شد.",
            )
          }
        />
      ) : null}
    </div>
  );
}

function DialogError({ message }: { message: string | null }) {
  return message ? (
    <div role="alert" className="rounded-control border border-danger/25 bg-danger-soft px-4 py-3 text-xs font-bold leading-6 text-danger">
      {message}
    </div>
  ) : null;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="mt-1.5 text-xs font-bold text-danger">
      {message}
    </p>
  ) : null;
}

function AddItemDialog({
  products,
  busy,
  operationError,
  onClose,
  onSubmit,
}: {
  products: CatalogProductOption[];
  busy: boolean;
  operationError: string | null;
  onClose: () => void;
  onSubmit: (kind: "catalog" | "custom", payload: FormData) => void;
}) {
  const [kind, setKind] = useState<"catalog" | "custom">("catalog");
  const [productId, setProductId] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const quantityRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = new FormData(event.currentTarget);
    const nextErrors: FieldErrors = {};
    const quantity = Number(payload.get("quantity"));
    const note = String(payload.get("note") || "").trim();

    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      nextErrors.quantity = "مقدار باید یک عدد صحیح و حداقل ۱ باشد.";
    }
    if (note.length > 300) {
      nextErrors.note = "یادداشت نمی‌تواند بیش از ۳۰۰ کاراکتر باشد.";
    }
    if (kind === "catalog" && !productId) {
      nextErrors.productId = "یک کالا از کاتالوگ انتخاب کنید.";
    }
    if (kind === "custom") {
      const title = String(payload.get("customTitle") || "").trim();
      const unit = String(payload.get("customUnit") || "").trim();
      if (!title) nextErrors.customTitle = "نام کالا الزامی است.";
      if (title.length > 150) nextErrors.customTitle = "نام کالا حداکثر ۱۵۰ کاراکتر است.";
      if (!unit) nextErrors.customUnit = "واحد کالا الزامی است.";
      if (unit.length > 50) nextErrors.customUnit = "واحد کالا حداکثر ۵۰ کاراکتر است.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(kind, payload);
  }

  return (
    <InternalRequestDialog
      open
      title="افزودن کالا به لیست خرید"
      description="کالای کاتالوگ را انتخاب کنید یا یک کالای سفارشی بسازید."
      onClose={onClose}
      busy={busy}
      initialFocusRef={quantityRef}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="itemType" value={kind} />
        {kind === "catalog" ? <input type="hidden" name="productId" value={productId} /> : null}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          <DialogError message={operationError} />
          <div className="grid grid-cols-2 gap-2 rounded-control bg-surface-subtle p-1.5">
            <button
              type="button"
              aria-pressed={kind === "catalog"}
              disabled={busy}
              onClick={() => {
                setKind("catalog");
                setErrors({});
              }}
              className={`min-h-11 rounded-control px-3 text-xs font-black transition ${kind === "catalog" ? "bg-surface text-primary shadow-sm" : "text-ink-muted"}`}
            >
              کالای کاتالوگ
            </button>
            <button
              type="button"
              aria-pressed={kind === "custom"}
              disabled={busy}
              onClick={() => {
                setKind("custom");
                setErrors({});
              }}
              className={`min-h-11 rounded-control px-3 text-xs font-black transition ${kind === "custom" ? "bg-surface text-violet shadow-sm" : "text-ink-muted"}`}
            >
              کالای سفارشی
            </button>
          </div>

          {kind === "catalog" ? (
            <div>
              <CatalogProductPicker
                products={products}
                value={productId}
                disabled={busy}
                onChange={(id) => {
                  setProductId(id);
                  setErrors((current) => ({ ...current, productId: undefined }));
                }}
              />
              <FieldError id="shopping-product-error" message={errors.productId} />
              {productId ? (
                <p className="mt-2 text-xs font-bold text-ink-muted">
                  واحد این کالا: <span className="text-ink">{products.find((product) => product.id === productId)?.unit}</span>
                </p>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="shopping-custom-title" className="mb-1.5 block text-xs font-bold text-ink-muted">نام کالا</label>
                <input
                  id="shopping-custom-title"
                  name="customTitle"
                  maxLength={150}
                  disabled={busy}
                  aria-invalid={Boolean(errors.customTitle)}
                  aria-describedby={errors.customTitle ? "shopping-custom-title-error" : undefined}
                  className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary disabled:opacity-60"
                />
                <FieldError id="shopping-custom-title-error" message={errors.customTitle} />
              </div>
              <div>
                <label htmlFor="shopping-custom-unit" className="mb-1.5 block text-xs font-bold text-ink-muted">واحد</label>
                <input
                  id="shopping-custom-unit"
                  name="customUnit"
                  maxLength={50}
                  disabled={busy}
                  aria-invalid={Boolean(errors.customUnit)}
                  aria-describedby={errors.customUnit ? "shopping-custom-unit-error" : undefined}
                  placeholder="عدد، کیلوگرم، بسته و…"
                  className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary disabled:opacity-60"
                />
                <FieldError id="shopping-custom-unit-error" message={errors.customUnit} />
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <div>
              <label htmlFor="shopping-quantity" className="mb-1.5 block text-xs font-bold text-ink-muted">مقدار</label>
              <input
                ref={quantityRef}
                id="shopping-quantity"
                name="quantity"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                defaultValue="1"
                disabled={busy}
                aria-invalid={Boolean(errors.quantity)}
                aria-describedby={errors.quantity ? "shopping-quantity-error" : undefined}
                className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-primary disabled:opacity-60"
              />
              <FieldError id="shopping-quantity-error" message={errors.quantity} />
            </div>
            <div>
              <label htmlFor="shopping-note" className="mb-1.5 block text-xs font-bold text-ink-muted">یادداشت اختیاری</label>
              <input
                id="shopping-note"
                name="note"
                maxLength={300}
                disabled={busy}
                aria-invalid={Boolean(errors.note)}
                aria-describedby={errors.note ? "shopping-note-error" : undefined}
                placeholder="برند ترجیحی یا توضیح کوتاه"
                className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary disabled:opacity-60"
              />
              <FieldError id="shopping-note-error" message={errors.note} />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-control border border-line px-4 text-sm font-bold text-ink-muted transition hover:bg-surface-subtle disabled:opacity-50">انصراف</button>
          <button type="submit" disabled={busy} className="min-h-11 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-50">
            {busy ? "در حال افزودن…" : "افزودن به لیست خرید"}
          </button>
        </div>
      </form>
    </InternalRequestDialog>
  );
}

function SourcesDialog({
  aggregate,
  canManage,
  onClose,
  onEdit,
  onRemove,
}: {
  aggregate: AggregatedShoppingListItemDTO;
  canManage: boolean;
  onClose: () => void;
  onEdit: (item: ShoppingListItemDTO) => void;
  onRemove: (item: ShoppingListItemDTO) => void;
}) {
  return (
    <InternalRequestDialog
      open
      title={`منابع ${itemTitle(aggregate)}`}
      description={`مقدار کل ${formatPersianNumber(aggregate.totalQuantity)} ${itemUnit(aggregate)} از ${formatPersianNumber(aggregate.itemCount)} منبع تشکیل شده است.`}
      onClose={onClose}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="space-y-3">
          {aggregate.items.map((item, index) => {
            const quantityChanged = item.quantity !== item.sourceQuantity;
            return (
              <article key={item.id} className="rounded-card border border-line bg-surface-subtle/65 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="grid size-7 place-items-center rounded-full bg-surface text-xs font-black text-primary shadow-xs">
                        {formatPersianNumber(index + 1)}
                      </span>
                      <h3 className="text-sm font-black text-ink">{sourceLabel(item)}</h3>
                    </div>
                    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
                      {quantityChanged ? (
                        <>
                          <div><dt className="text-ink-muted">مقدار اولیه</dt><dd className="mt-1 font-black text-ink">{formatPersianNumber(item.sourceQuantity)} {itemUnit(item)}</dd></div>
                          <div><dt className="text-ink-muted">مقدار فعلی</dt><dd className="mt-1 font-black text-primary">{formatPersianNumber(item.quantity)} {itemUnit(item)}</dd></div>
                        </>
                      ) : (
                        <div><dt className="text-ink-muted">مقدار</dt><dd className="mt-1 font-black text-ink">{formatPersianNumber(item.quantity)} {itemUnit(item)}</dd></div>
                      )}
                      <div><dt className="text-ink-muted">آخرین تغییر</dt><dd className="mt-1 font-bold text-ink">{formatPersianDateTime(item.updatedAt)}</dd></div>
                    </dl>
                    {item.note ? <p className="mt-3 break-words text-xs leading-6 text-ink-muted"><strong className="text-ink">یادداشت:</strong> {item.note}</p> : null}
                    {item.sourceType === "internal_request" && item.internalPurchaseRequestId ? (
                      <Link href={`/cafe/internal-requests/${item.internalPurchaseRequestId}`} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-control text-xs font-black text-primary transition hover:bg-primary-soft">
                        مشاهده درخواست مبدا
                        <IconArrowLeft className="size-3.5" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                  {canManage ? (
                    <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
                      <button type="button" onClick={() => onEdit(item)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-control border border-line bg-surface px-3 text-xs font-black text-ink-muted transition hover:border-primary hover:text-primary">
                        <IconEdit className="size-4" aria-hidden="true" /> ویرایش
                      </button>
                      <button type="button" onClick={() => onRemove(item)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-control border border-danger/20 bg-surface px-3 text-xs font-black text-danger transition hover:bg-danger-soft">
                        <IconTrash className="size-4" aria-hidden="true" /> حذف
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <div className="flex shrink-0 justify-end border-t border-line px-4 py-3 sm:px-6">
        <button type="button" onClick={onClose} className="min-h-11 rounded-control border border-line px-5 text-sm font-bold text-ink-muted transition hover:bg-surface-subtle">بستن</button>
      </div>
    </InternalRequestDialog>
  );
}

function EditQuantityDialog({
  item,
  busy,
  operationError,
  onClose,
  onSubmit,
}: {
  item: ShoppingListItemDTO;
  busy: boolean;
  operationError: string | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [quantityError, setQuantityError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const quantity = Number(formData.get("quantity"));
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      setQuantityError("مقدار باید یک عدد صحیح و حداقل ۱ باشد.");
      return;
    }
    setQuantityError(undefined);
    onSubmit({ itemId: item.id, quantity });
  }

  return (
    <InternalRequestDialog
      open
      size="sm"
      title={`ویرایش مقدار ${itemTitle(item)}`}
      description={`این تغییر فقط روی منبع «${sourceLabel(item)}» اعمال می‌شود.`}
      onClose={onClose}
      busy={busy}
      initialFocusRef={inputRef}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-4 px-4 py-5 sm:px-6">
          <DialogError message={operationError} />
          {item.quantity !== item.sourceQuantity ? (
            <div className="rounded-control bg-primary-soft px-4 py-3 text-xs leading-6 text-primary">
              مقدار اولیه این منبع {formatPersianNumber(item.sourceQuantity)} {itemUnit(item)} بوده و مقدار فعلی {formatPersianNumber(item.quantity)} است.
            </div>
          ) : null}
          <div>
            <label htmlFor="edit-shopping-quantity" className="mb-1.5 block text-xs font-bold text-ink-muted">مقدار فعلی ({itemUnit(item)})</label>
            <input
              ref={inputRef}
              id="edit-shopping-quantity"
              name="quantity"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              defaultValue={item.quantity}
              disabled={busy}
              aria-invalid={Boolean(quantityError)}
              aria-describedby={quantityError ? "edit-shopping-quantity-error" : undefined}
              className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm font-black text-ink outline-none transition focus:border-primary disabled:opacity-60"
            />
            <FieldError id="edit-shopping-quantity-error" message={quantityError} />
          </div>
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-control border border-line px-4 text-sm font-bold text-ink-muted transition hover:bg-surface-subtle disabled:opacity-50">انصراف</button>
          <button type="submit" disabled={busy} className="min-h-11 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-50">{busy ? "در حال ذخیره…" : "ذخیره مقدار"}</button>
        </div>
      </form>
    </InternalRequestDialog>
  );
}

function RemoveItemDialog({
  item,
  busy,
  operationError,
  onClose,
  onConfirm,
}: {
  item: ShoppingListItemDTO;
  busy: boolean;
  operationError: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <InternalRequestDialog
      open
      size="sm"
      title="حذف منبع از لیست خرید"
      description="این عملیات فقط منبع انتخاب‌شده را حذف می‌کند و سایر منابع همان کالا باقی می‌مانند."
      onClose={onClose}
      busy={busy}
    >
      <div className="space-y-4 px-4 py-5 sm:px-6">
        <DialogError message={operationError} />
        <div className="rounded-control border border-danger/20 bg-danger-soft px-4 py-4 text-sm leading-7 text-danger">
          منبع «{sourceLabel(item)}» با مقدار {formatPersianNumber(item.quantity)} {itemUnit(item)} از «{itemTitle(item)}» حذف شود؟
        </div>
      </div>
      <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
        <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-control border border-line px-4 text-sm font-bold text-ink-muted transition hover:bg-surface-subtle disabled:opacity-50">انصراف</button>
        <button type="button" onClick={onConfirm} disabled={busy} className="min-h-11 rounded-control bg-danger px-5 text-sm font-black text-white transition disabled:cursor-wait disabled:opacity-50">{busy ? "در حال حذف…" : "حذف این منبع"}</button>
      </div>
    </InternalRequestDialog>
  );
}
