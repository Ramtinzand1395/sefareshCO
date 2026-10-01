"use client";

import {
  IconAlertCircle,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconClipboardList,
  IconPackage,
  IconPlus,
  IconRefresh,
  IconScale,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  createPurchaseRequestAction,
  getShoppingListAvailabilityAction,
} from "@/app/actions/purchase-requests";
import { InternalRequestDialog } from "@/app/(dashboard)/cafe/internal-requests/_components/internal-request-dialog";
import type {
  ShoppingListAggregateAvailabilityDTO,
  ShoppingListAvailabilityDTO,
} from "@/src/domain/purchase-request";
import { formatPersianNumber } from "@/src/lib/persian-format";

type Selection = Record<string, number>;
type Step = 1 | 2 | 3;

function itemTitle(item: ShoppingListAggregateAvailabilityDTO) {
  return item.itemType === "catalog"
    ? item.productName || "کالای کاتالوگ"
    : item.customTitle || "کالای سفارشی";
}

function itemUnit(item: ShoppingListAggregateAvailabilityDTO) {
  return item.itemType === "catalog"
    ? item.productUnit || "واحد"
    : item.customUnit || "واحد";
}

function safeActionError(message?: string) {
  if (
    !message ||
    /mongo|mongoose|validation failed|cast to|stack|\bat\s+\w+/i.test(message)
  ) {
    return "عملیات انجام نشد. لطفاً دوباره تلاش کنید.";
  }
  return message.slice(0, 300);
}

function isAvailabilityError(message?: string) {
  return Boolean(
    message &&
      /تخصیص|قابل تخصیص|استعلام‌های دیگر|در حال پردازش روی لیست خرید/.test(
        message,
      ),
  );
}

function todayInputValue() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function NewPurchaseRequest({ autoOpen = false }: { autoOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [availability, setAvailability] =
    useState<ShoppingListAvailabilityDTO | null>(null);
  const [selections, setSelections] = useState<Selection>({});
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [neededByDate, setNeededByDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const stepContentRef = useRef<HTMLDivElement>(null);
  const hasAutoOpened = useRef(false);
  const router = useRouter();

  const loadAvailability = useCallback(async () => {
    setError(null);
    const result = await getShoppingListAvailabilityAction();
    if (!result.ok || !result.data) {
      setError(safeActionError(result.error));
      return;
    }
    setAvailability(result.data);
  }, []);

  const begin = useCallback(() => {
    setStep(1);
    setSelections({});
    setTitle("");
    setNote("");
    setNeededByDate("");
    setAvailability(null);
    setError(null);
    setIdempotencyKey(crypto.randomUUID());
    setOpen(true);
    startTransition(loadAvailability);
  }, [loadAvailability]);

  useEffect(() => {
    if (autoOpen && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      begin();
    }
  }, [autoOpen, begin]);

  useEffect(() => {
    if (open) stepContentRef.current?.focus();
  }, [open, step]);

  const items = useMemo(
    () => availability?.aggregatedItems ?? [],
    [availability],
  );
  const selectedItems = useMemo(
    () =>
      items
        .filter((item) => selections[item.key] !== undefined)
        .map((item) => ({ item, quantity: selections[item.key] })),
    [items, selections],
  );
  const hasInvalidQuantity = selectedItems.some(
    ({ item, quantity }) =>
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > item.availableQuantity,
  );
  const canContinue = selectedItems.length > 0 && !hasInvalidQuantity;

  function toggleItem(item: ShoppingListAggregateAvailabilityDTO) {
    if (isPending || item.availableQuantity === 0) return;
    setSelections((current) => {
      const next = { ...current };
      if (next[item.key] !== undefined) delete next[item.key];
      else next[item.key] = item.availableQuantity;
      return next;
    });
    setError(null);
  }

  function updateQuantity(key: string, value: string) {
    const quantity = Number(value);
    setSelections((current) => ({
      ...current,
      [key]: Number.isNaN(quantity) ? 0 : quantity,
    }));
    setError(null);
  }

  function submit(submitImmediately: boolean) {
    if (!canContinue || isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await createPurchaseRequestAction(
          {},
          {
            title: title.trim() || undefined,
            note: note.trim() || undefined,
            neededByDate: neededByDate || undefined,
            idempotencyKey,
            submitImmediately,
            items: selectedItems.map(({ item, quantity }) => ({
              aggregateKey: item.key,
              quantity,
            })),
          },
        );

        if (!result.ok || !result.data) {
          const message = safeActionError(result.error);
          setError(message);
          if (isAvailabilityError(result.error)) {
            await loadAvailability();
            setError(message);
            setStep(1);
          }
          return;
        }

        const outcome = submitImmediately ? "submitted" : "draft";
        router.push(
          `/cafe/purchase-requests/${result.data.id}?created=${outcome}`,
        );
      } catch {
        setError("ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={begin}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-black text-white shadow-sm transition hover:bg-primary-hover sm:min-h-11 sm:w-auto"
      >
        <IconPlus className="size-5" aria-hidden="true" />
        استعلام جدید
      </button>

      <InternalRequestDialog
        open={open}
        title="ایجاد استعلام قیمت"
        description="کالاهای قابل استعلام را انتخاب کنید، مقدارها را بسنجید و پیش از ثبت مرور نهایی انجام دهید."
        onClose={() => !isPending && setOpen(false)}
        busy={isPending}
        initialFocusRef={stepContentRef}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <ol
            aria-label="مراحل ایجاد استعلام"
            className="grid shrink-0 grid-cols-3 border-b border-line bg-surface-subtle px-3 py-3 sm:px-6"
          >
            {([
              [1, "انتخاب کالا"],
              [2, "اطلاعات استعلام"],
              [3, "مرور و تأیید"],
            ] as const).map(([number, label]) => {
              const current = step === number;
              const completed = step > number;
              return (
                <li
                  key={number}
                  aria-current={current ? "step" : undefined}
                  className={`flex min-w-0 items-center gap-2 text-[10px] font-black sm:text-xs ${
                    current
                      ? "text-primary"
                      : completed
                        ? "text-success"
                        : "text-ink-muted"
                  }`}
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full ${
                      current
                        ? "bg-primary text-white"
                        : completed
                          ? "bg-success-soft text-success"
                          : "bg-line/60"
                    }`}
                  >
                    {completed ? (
                      <IconCheck className="size-4" aria-hidden="true" />
                    ) : (
                      formatPersianNumber(number as number)
                    )}
                  </span>
                  <span className="truncate">{label}</span>
                </li>
              );
            })}
          </ol>

          <div
            ref={stepContentRef}
            tabIndex={-1}
            aria-label={`مرحله ${formatPersianNumber(step)} از ۳`}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-5 outline-none sm:px-6"
          >
            <div aria-live="assertive" aria-atomic="true">
              {error ? (
                <div
                  role="alert"
                  className="mb-4 flex items-start gap-2 rounded-control border border-danger/25 bg-danger-soft px-4 py-3 text-xs font-bold leading-6 text-danger"
                >
                  <IconAlertCircle
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{error}</span>
                </div>
              ) : null}
            </div>

            {step === 1 ? (
              <SelectionStep
                items={items}
                selections={selections}
                loading={isPending && !availability}
                loaded={availability !== null}
                onToggle={toggleItem}
                onQuantityChange={updateQuantity}
                onRetry={() => startTransition(loadAvailability)}
              />
            ) : null}

            {step === 2 ? (
              <MetadataStep
                title={title}
                note={note}
                neededByDate={neededByDate}
                disabled={isPending}
                onTitleChange={setTitle}
                onNoteChange={setNote}
                onNeededByDateChange={setNeededByDate}
              />
            ) : null}

            {step === 3 ? (
              <ReviewStep
                title={title}
                note={note}
                neededByDate={neededByDate}
                selectedItems={selectedItems}
              />
            ) : null}
          </div>

          <div className="sticky bottom-0 flex shrink-0 flex-col-reverse gap-2 border-t border-line bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
            <button
              type="button"
              onClick={() => (step === 1 ? setOpen(false) : setStep((step - 1) as Step))}
              disabled={isPending}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-line px-4 text-sm font-bold text-ink-muted transition hover:bg-surface-subtle disabled:opacity-50"
            >
              {step === 1 ? null : (
                <IconArrowRight className="size-4" aria-hidden="true" />
              )}
              {step === 1 ? "انصراف" : "مرحله قبل"}
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((step + 1) as Step)}
                disabled={isPending || (step === 1 && !canContinue)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                مرحله بعد
                <IconArrowLeft className="size-4" aria-hidden="true" />
              </button>
            ) : (
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => submit(false)}
                  disabled={isPending || !canContinue}
                  className="min-h-11 rounded-control border border-primary px-4 text-sm font-black text-primary transition hover:bg-primary-soft disabled:opacity-50"
                >
                  {isPending ? "در حال ذخیره…" : "ذخیره پیش‌نویس"}
                </button>
                <button
                  type="button"
                  onClick={() => submit(true)}
                  disabled={isPending || !canContinue}
                  className="min-h-11 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover disabled:opacity-50"
                >
                  {isPending ? "در حال ثبت…" : "ثبت و ارسال استعلام"}
                </button>
              </div>
            )}
          </div>
        </div>
      </InternalRequestDialog>
    </>
  );
}

function SelectionStep({
  items,
  selections,
  loading,
  loaded,
  onToggle,
  onQuantityChange,
  onRetry,
}: {
  items: ShoppingListAggregateAvailabilityDTO[];
  selections: Selection;
  loading: boolean;
  loaded: boolean;
  onToggle: (item: ShoppingListAggregateAvailabilityDTO) => void;
  onQuantityChange: (key: string, value: string) => void;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div role="status" aria-label="در حال دریافت کالاهای قابل استعلام" className="animate-pulse space-y-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-36 rounded-card bg-line/35" aria-hidden="true" />
        ))}
        <span className="sr-only">در حال دریافت کالاها…</span>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-danger-soft text-danger">
          <IconAlertCircle className="size-7" aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-base font-black text-ink">
          دریافت کالاهای قابل استعلام انجام نشد.
        </h3>
        <p className="mt-2 max-w-md text-xs leading-6 text-ink-muted">
          اتصال را بررسی کنید و بدون بستن فرم دوباره تلاش کنید.
        </p>
        <button type="button" onClick={onRetry} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-control border border-line px-4 text-xs font-black text-primary">
          <IconRefresh className="size-4" aria-hidden="true" />
          تلاش دوباره
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
          <IconClipboardList className="size-7" aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-base font-black text-ink">
          لیست خرید فعالی برای استعلام وجود ندارد.
        </h3>
        <p className="mt-2 max-w-md text-xs leading-6 text-ink-muted">
          ابتدا کالاهای موردنیاز را به لیست خرید اضافه کنید و سپس دوباره به این بخش برگردید.
        </p>
        <button type="button" onClick={onRetry} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-control border border-line px-4 text-xs font-black text-primary">
          <IconRefresh className="size-4" aria-hidden="true" />
          به‌روزرسانی
        </button>
      </div>
    );
  }

  const availableCount = items.filter((item) => item.availableQuantity > 0).length;
  if (availableCount === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-warning-soft text-warning">
          <IconScale className="size-7" aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-base font-black text-ink">
          در حال حاضر کالایی با مقدار قابل استعلام وجود ندارد.
        </h3>
        <p className="mt-2 max-w-md text-xs leading-6 text-ink-muted">
          تمام مقدارهای لیست خرید در استعلام‌های فعال استفاده شده‌اند. پس از لغو یا تکمیل فرایند دوباره بررسی کنید.
        </p>
        <button type="button" onClick={onRetry} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-control border border-line px-4 text-xs font-black text-primary">
          <IconRefresh className="size-4" aria-hidden="true" />
          به‌روزرسانی
        </button>
      </div>
    );
  }

  return (
    <section aria-labelledby="rfq-select-title">
      <h3 id="rfq-select-title" className="text-base font-black text-ink">
        کالاهای موردنظر را انتخاب کنید
      </h3>
      <p className="mt-1 text-xs leading-6 text-ink-muted">
        هر کالا به‌صورت تجمیعی نمایش داده می‌شود. مقدار انتخابی می‌تواند کمتر از مقدار قابل استعلام باشد.
      </p>
      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const selected = selections[item.key] !== undefined;
          const unavailable = item.availableQuantity === 0;
          const quantity = selections[item.key] ?? item.availableQuantity;
          const invalid = selected &&
            (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > item.availableQuantity);
          const errorId = `quantity-${item.key.replace(/[^a-zA-Z0-9_-]/g, "-")}-error`;
          return (
            <article
              key={item.key}
              className={`rounded-card border p-4 transition ${
                selected
                  ? "border-primary bg-primary-soft/35"
                  : "border-line bg-surface"
              } ${unavailable ? "opacity-70" : ""}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={unavailable}
                  onChange={() => onToggle(item)}
                  aria-label={`انتخاب ${itemTitle(item)}`}
                  className="mt-1 size-5 shrink-0 accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="break-words text-sm font-black text-ink">
                        {itemTitle(item)}
                      </h4>
                      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${item.itemType === "catalog" ? "bg-primary-soft text-primary" : "bg-violet-soft text-violet"}`}>
                        {item.itemType === "catalog" ? "کاتالوگ" : "کالای سفارشی"}
                      </span>
                    </div>
                    {selected ? (
                      <div className="w-full sm:w-36">
                        <label htmlFor={`quantity-${item.key}`} className="mb-1 block text-[11px] font-bold text-ink-muted">
                          مقدار ({itemUnit(item)})
                        </label>
                        <input
                          id={`quantity-${item.key}`}
                          type="number"
                          min="1"
                          max={item.availableQuantity}
                          step="1"
                          inputMode="numeric"
                          value={quantity}
                          onChange={(event) => onQuantityChange(item.key, event.target.value)}
                          aria-invalid={invalid}
                          aria-describedby={invalid ? errorId : undefined}
                          className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm font-black text-ink outline-none transition focus:border-primary"
                        />
                      </div>
                    ) : null}
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] sm:text-xs">
                    <div className="rounded-control bg-surface-subtle p-2">
                      <dt className="text-ink-muted">نیاز ثبت‌شده</dt>
                      <dd className="mt-1 font-black text-ink">{formatPersianNumber(item.totalQuantity)}</dd>
                    </div>
                    <div className="rounded-control bg-warning-soft p-2">
                      <dt className="text-warning">در استعلام‌های فعال</dt>
                      <dd className="mt-1 font-black text-warning">{formatPersianNumber(item.allocatedQuantity)}</dd>
                    </div>
                    <div className="rounded-control bg-success-soft p-2">
                      <dt className="text-success">قابل استعلام</dt>
                      <dd className="mt-1 font-black text-success">{formatPersianNumber(item.availableQuantity)}</dd>
                    </div>
                  </dl>
                  {unavailable ? (
                    <p className="mt-2 text-xs font-bold leading-6 text-warning">
                      تمام مقدار این کالا در استعلام‌های فعال استفاده شده است.
                    </p>
                  ) : null}
                  {invalid ? (
                    <p id={errorId} role="alert" className="mt-2 text-xs font-bold text-danger">
                      مقدار باید عدد صحیحی بین ۱ تا {formatPersianNumber(item.availableQuantity)} باشد.
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MetadataStep({
  title,
  note,
  neededByDate,
  disabled,
  onTitleChange,
  onNoteChange,
  onNeededByDateChange,
}: {
  title: string;
  note: string;
  neededByDate: string;
  disabled: boolean;
  onTitleChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onNeededByDateChange: (value: string) => void;
}) {
  return (
    <section aria-labelledby="rfq-metadata-title" className="space-y-4">
      <div>
        <h3 id="rfq-metadata-title" className="text-base font-black text-ink">
          اطلاعات استعلام
        </h3>
        <p className="mt-1 text-xs leading-6 text-ink-muted">
          این اطلاعات اختیاری‌اند و به همکاران کمک می‌کنند هدف و زمان‌بندی استعلام را بهتر بفهمند.
        </p>
      </div>
      <div>
        <label htmlFor="rfq-title" className="mb-1.5 block text-xs font-bold text-ink-muted">عنوان</label>
        <input id="rfq-title" type="text" maxLength={150} value={title} onChange={(event) => onTitleChange(event.target.value)} disabled={disabled} placeholder="مثلاً تأمین مواد اولیه هفته آینده" className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition placeholder:text-ink-muted/60 focus:border-primary disabled:opacity-60" />
        <p className="mt-1 text-[11px] text-ink-muted">حداکثر ۱۵۰ کاراکتر</p>
      </div>
      <div>
        <label htmlFor="rfq-needed-date" className="mb-1.5 block text-xs font-bold text-ink-muted">تاریخ موردنیاز</label>
        <input id="rfq-needed-date" type="date" min={todayInputValue()} value={neededByDate} onChange={(event) => onNeededByDateChange(event.target.value)} disabled={disabled} className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary disabled:opacity-60 sm:max-w-xs" />
        <p className="mt-1 text-[11px] text-ink-muted">تاریخ امروز یا روزهای آینده را انتخاب کنید.</p>
      </div>
      <div>
        <label htmlFor="rfq-note" className="mb-1.5 block text-xs font-bold text-ink-muted">یادداشت</label>
        <textarea id="rfq-note" maxLength={500} rows={5} value={note} onChange={(event) => onNoteChange(event.target.value)} disabled={disabled} placeholder="شرایط تحویل یا توضیح تکمیلی" className="w-full resize-y rounded-control border border-line bg-surface px-3 py-2.5 text-sm leading-7 text-ink outline-none transition placeholder:text-ink-muted/60 focus:border-primary disabled:opacity-60" />
        <p className="mt-1 text-[11px] text-ink-muted">حداکثر ۵۰۰ کاراکتر</p>
      </div>
    </section>
  );
}

function ReviewStep({
  title,
  note,
  neededByDate,
  selectedItems,
}: {
  title: string;
  note: string;
  neededByDate: string;
  selectedItems: Array<{ item: ShoppingListAggregateAvailabilityDTO; quantity: number }>;
}) {
  return (
    <section aria-labelledby="rfq-review-title">
      <h3 id="rfq-review-title" className="text-base font-black text-ink">مرور نهایی</h3>
      <p className="mt-1 text-xs leading-6 text-ink-muted">پیش از ذخیره یا ارسال رسمی، اطلاعات را یک‌بار مرور کنید.</p>
      <dl className="mt-4 grid gap-3 rounded-card border border-line bg-surface-subtle p-4 sm:grid-cols-2">
        <div><dt className="text-[11px] font-bold text-ink-muted">عنوان استعلام</dt><dd className="mt-1 text-sm font-black text-ink">{title || "بدون عنوان"}</dd></div>
        <div><dt className="text-[11px] font-bold text-ink-muted">تعداد اقلام</dt><dd className="mt-1 text-sm font-black text-ink">{formatPersianNumber(selectedItems.length)} قلم</dd></div>
        <div><dt className="text-[11px] font-bold text-ink-muted">تاریخ موردنیاز</dt><dd className="mt-1 text-sm font-black text-ink">{neededByDate ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" }).format(new Date(`${neededByDate}T12:00:00`)) : "تعیین نشده"}</dd></div>
        {note ? <div className="sm:col-span-2"><dt className="text-[11px] font-bold text-ink-muted">یادداشت</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-7 text-ink">{note}</dd></div> : null}
      </dl>
      <div className="mt-4 space-y-2">
        {selectedItems.map(({ item, quantity }, index) => (
          <article key={item.key} className="flex items-center gap-3 rounded-control border border-line p-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-black text-primary">{formatPersianNumber(index + 1)}</span>
            <div className="min-w-0 flex-1"><h4 className="break-words text-sm font-black text-ink">{itemTitle(item)}</h4><p className="mt-1 text-xs text-ink-muted">{item.itemType === "catalog" ? <IconPackage className="me-1 inline size-3.5" aria-hidden="true" /> : null}{item.itemType === "custom" ? "کالای سفارشی — " : ""}{formatPersianNumber(quantity)} {itemUnit(item)}</p></div>
          </article>
        ))}
      </div>
      <div className="mt-5 rounded-control border border-primary/20 bg-primary-soft px-4 py-3 text-xs leading-6 text-primary">
        «ذخیره پیش‌نویس» امکان بررسی بعدی را نگه می‌دارد؛ «ثبت و ارسال استعلام» آن را وارد فرایند رسمی استعلام می‌کند.
      </div>
    </section>
  );
}
