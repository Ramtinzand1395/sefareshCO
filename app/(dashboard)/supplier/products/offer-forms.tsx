"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  IconCheck,
  IconEdit,
  IconLoader2,
  IconPlus,
  IconRefresh,
  IconSearch,
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

type CreateOfferFormValues = {
  price: string;
  stock: string;
  minOrderQuantity: string;
  deliveryDays: string;
  status: "active" | "inactive";
};

type EditOfferFormValues = Omit<CreateOfferFormValues, "status">;

const initialCreateFormValues: CreateOfferFormValues = {
  price: "",
  stock: "0",
  minOrderQuantity: "1",
  deliveryDays: "1",
  status: "inactive",
};

type ProductSearchState =
  | { status: "loading"; items: ProductOption[]; message?: undefined }
  | { status: "ready"; items: ProductOption[]; message?: undefined }
  | { status: "error"; items: ProductOption[]; message: string };

function FieldError({
  id,
  errors,
}: {
  id?: string;
  errors?: string[];
}) {
  if (!errors?.length) return null;

  return (
    <p id={id} className="mt-1 text-[11px] font-bold text-danger">
      {errors.join("، ")}
    </p>
  );
}

function ProductSearchPicker({
  selectedProduct,
  onSelect,
  disabled,
  error,
}: {
  selectedProduct: ProductOption | null;
  onSelect: (product: ProductOption | null) => void;
  disabled: boolean;
  error?: string[];
}) {
  const inputId = useId();
  const listboxId = useId();
  const errorId = `${inputId}-error`;
  const [query, setQuery] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searchState, setSearchState] = useState<ProductSearchState>({
    status: "loading",
    items: [],
  });
  const requestVersionRef = useRef(0);
  const latestQueryRef = useRef(query);
  const controllerRef = useRef<AbortController | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const requestedQuery = query;
    const requestVersion = ++requestVersionRef.current;
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/supplier/products/search?q=${encodeURIComponent(requestedQuery)}`,
          { signal: controller.signal, cache: "no-store" },
        );

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(
              "نشست شما پایان یافته است؛ لطفاً دوباره وارد شوید.",
            );
          }
          if (response.status === 403) {
            throw new Error("اجازه مدیریت عرضه‌ها برای حساب شما فعال نیست.");
          }
          throw new Error("جستجوی کالا انجام نشد؛ لطفاً دوباره تلاش کنید.");
        }

        const data: unknown = await response.json();
        if (!Array.isArray(data)) {
          throw new Error("پاسخ جستجوی کالا معتبر نیست؛ دوباره تلاش کنید.");
        }

        if (
          requestVersion !== requestVersionRef.current ||
          requestedQuery !== latestQueryRef.current
        ) {
          return;
        }

        const products = data as ProductOption[];
        setActiveIndex(products.length > 0 ? 0 : -1);
        setSearchState({ status: "ready", items: products });
      } catch (searchError) {
        if (controller.signal.aborted) return;
        if (
          requestVersion !== requestVersionRef.current ||
          requestedQuery !== latestQueryRef.current
        ) {
          return;
        }

        setSearchState({
          status: "error",
          items: [],
          message:
            searchError instanceof Error
              ? searchError.message
              : "جستجوی کالا انجام نشد؛ لطفاً دوباره تلاش کنید.",
        });
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query, retryKey]);

  const updateQuery = (value: string) => {
    latestQueryRef.current = value;
    controllerRef.current?.abort();
    setActiveIndex(-1);
    setSearchState({ status: "loading", items: [] });
    setQuery(value);
    setIsExpanded(true);
  };

  const selectProduct = (product: ProductOption) => {
    onSelect(product);
    latestQueryRef.current = product.name;
    setActiveIndex(-1);
    setSearchState({ status: "loading", items: [] });
    setQuery(product.name);
    setIsExpanded(false);
  };

  const retrySearch = () => {
    setActiveIndex(-1);
    setSearchState({ status: "loading", items: [] });
    setRetryKey((value) => value + 1);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    const options = searchState.items;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsExpanded(true);
      setActiveIndex((current) =>
        options.length === 0 ? -1 : Math.min(current + 1, options.length - 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsExpanded(true);
      setActiveIndex((current) =>
        options.length === 0
          ? -1
          : current <= 0
            ? 0
            : current - 1,
      );
      return;
    }

    if (
      event.key === "Enter" &&
      isExpanded &&
      activeIndex >= 0 &&
      options[activeIndex]
    ) {
      event.preventDefault();
      selectProduct(options[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsExpanded(false);
    }
  };

  const activeOptionId =
    isExpanded && activeIndex >= 0
      ? `${listboxId}-option-${activeIndex}`
      : undefined;

  return (
    <div ref={pickerRef} className="relative">
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-xs font-bold text-ink-muted"
      >
        جستجو و انتخاب کالای کاتالوگ *
      </label>
      <input type="hidden" name="productId" value={selectedProduct?.id ?? ""} />
      <div className="relative">
        <IconSearch
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />
        <input
          id={inputId}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isExpanded}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          aria-invalid={Boolean(error?.length)}
          aria-describedby={error?.length ? errorId : undefined}
          autoComplete="off"
          disabled={disabled}
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          onFocus={() => setIsExpanded(true)}
          onBlur={() => {
            window.requestAnimationFrame(() => {
              if (!pickerRef.current?.contains(document.activeElement)) {
                setIsExpanded(false);
              }
            });
          }}
          onKeyDown={handleKeyDown}
          placeholder="نام، برند یا کد کالا را جستجو کنید..."
          className="h-11 w-full rounded-control border border-line bg-surface ps-10 pe-3 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-primary disabled:opacity-60"
        />
      </div>

      {isExpanded ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="نتایج جستجوی کالا"
          className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-card border border-line bg-surface p-1.5 shadow-float"
        >
          {searchState.status === "loading" ? (
            <div
              role="status"
              className="flex items-center gap-2 px-3 py-4 text-xs font-bold text-ink-muted"
            >
              <IconLoader2 className="size-4 animate-spin" aria-hidden="true" />
              در حال جستجوی کالاها...
            </div>
          ) : null}

          {searchState.status === "error" ? (
            <div role="alert" className="space-y-3 px-3 py-4">
              <p className="text-xs font-bold leading-6 text-danger">
                {searchState.message}
              </p>
              <button
                type="button"
                onClick={retrySearch}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-line px-3 text-xs font-bold text-ink-muted transition hover:border-primary hover:text-primary"
              >
                <IconRefresh className="size-4" aria-hidden="true" />
                تلاش دوباره
              </button>
            </div>
          ) : null}

          {searchState.status === "ready" && searchState.items.length === 0 ? (
            <p role="status" className="px-3 py-4 text-xs text-ink-muted">
              کالایی مطابق این عبارت پیدا نشد.
            </p>
          ) : null}

          {searchState.status === "ready"
            ? searchState.items.map((product, index) => (
                <button
                  key={product.id}
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={selectedProduct?.id === product.id}
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectProduct(product)}
                  className={`block w-full rounded-control px-3 py-2.5 text-start transition ${
                    activeIndex === index
                      ? "bg-primary-soft text-primary"
                      : "text-ink hover:bg-surface-subtle"
                  }`}
                >
                  <span className="block text-sm font-black">{product.name}</span>
                  <span className="mt-1 block text-[11px] text-ink-muted">
                    واحد: {product.unit}
                    {product.categoryName
                      ? ` · دسته‌بندی: ${product.categoryName}`
                      : ""}
                  </span>
                </button>
              ))
            : null}
        </div>
      ) : null}

      {selectedProduct ? (
        <div className="mt-2 flex items-start justify-between gap-3 rounded-control border border-primary/20 bg-primary-soft px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-xs font-black text-primary">
              انتخاب‌شده: {selectedProduct.name}
            </p>
            <p className="mt-1 text-[11px] text-ink-muted">
              واحد: {selectedProduct.unit}
              {selectedProduct.categoryName
                ? ` · دسته‌بندی: ${selectedProduct.categoryName}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(null)}
            aria-label={`پاک کردن انتخاب ${selectedProduct.name}`}
            className="grid size-8 shrink-0 place-items-center rounded-control text-ink-muted transition hover:bg-surface hover:text-danger disabled:opacity-50"
          >
            <IconX className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <FieldError id={errorId} errors={error} />
    </div>
  );
}

export function OfferCreateForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] =
    useState<ProductOption | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const [formValues, setFormValues] = useState<CreateOfferFormValues>(
    initialCreateFormValues,
  );
  const createAction = useCallback(
    async (previousState: SupplierOfferActionState, formData: FormData) => {
      const result = await createOfferAction(previousState, formData);
      if (result.ok) {
        setFormValues(initialCreateFormValues);
        setSelectedProduct(null);
        setPickerKey((value) => value + 1);
      }
      return result;
    },
    [],
  );
  const [state, formAction, isPending] = useActionState(
    createAction,
    initialState,
  );

  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-ink">عرضهٔ محصول در کاتالوگ</h2>
          <p className="mt-1 text-xs leading-6 text-ink-muted">
            کالای مرجع را جستجو کنید و قیمت، موجودی و شرایط تحویل عرضهٔ خود را
            ثبت کنید.
          </p>
        </div>
        <button
          type="button"
          disabled={isPending}
          aria-expanded={isOpen}
          aria-controls="create-offer-form"
          onClick={() => setIsOpen((value) => !value)}
          className="inline-flex items-center gap-1.5 rounded-control bg-primary px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-primary-hover disabled:opacity-50"
        >
          {isOpen ? (
            <IconX className="size-4" aria-hidden="true" />
          ) : (
            <IconPlus className="size-4" aria-hidden="true" />
          )}
          {isOpen ? "بستن فرم" : "ثبت عرضه جدید"}
        </button>
      </div>

      {isOpen ? (
        <form
          id="create-offer-form"
          action={formAction}
          aria-busy={isPending}
          className="mt-5 space-y-4 border-t border-line pt-4"
        >
          <div aria-live="polite">
            {state.error ? (
              <div className="rounded-control bg-danger-soft p-3 text-xs font-bold text-danger">
                {state.error}
              </div>
            ) : null}
            {state.ok ? (
              <div className="flex items-center gap-2 rounded-control bg-success-soft p-3 text-xs font-bold text-success">
                <IconCheck className="size-4 shrink-0" aria-hidden="true" />
                <span>عرضه با موفقیت ثبت و به فهرست شما اضافه شد.</span>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <ProductSearchPicker
                key={pickerKey}
                selectedProduct={selectedProduct}
                onSelect={setSelectedProduct}
                disabled={isPending}
                error={state.fieldErrors?.productId}
              />
            </div>

            <div>
              <label htmlFor="offer-price" className="mb-1.5 block text-xs font-bold text-ink-muted">
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
                value={formValues.price}
                onChange={(event) =>
                  setFormValues((values) => ({
                    ...values,
                    price: event.target.value,
                  }))
                }
                aria-invalid={Boolean(state.fieldErrors?.price)}
                aria-describedby={state.fieldErrors?.price ? "offer-price-error" : undefined}
                placeholder="مثلاً ۲۵۰۰۰۰"
                className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-primary disabled:opacity-60"
              />
              <FieldError id="offer-price-error" errors={state.fieldErrors?.price} />
            </div>

            <div>
              <label htmlFor="offer-stock" className="mb-1.5 block text-xs font-bold text-ink-muted">
                موجودی انبار{selectedProduct ? ` (برحسب ${selectedProduct.unit})` : ""} *
              </label>
              <input
                id="offer-stock"
                name="stock"
                type="number"
                min="0"
                step="1"
                required
                disabled={isPending}
                value={formValues.stock}
                onChange={(event) =>
                  setFormValues((values) => ({
                    ...values,
                    stock: event.target.value,
                  }))
                }
                aria-invalid={Boolean(state.fieldErrors?.stock)}
                aria-describedby={state.fieldErrors?.stock ? "offer-stock-error" : undefined}
                className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-primary disabled:opacity-60"
              />
              <FieldError id="offer-stock-error" errors={state.fieldErrors?.stock} />
            </div>

            <div>
              <label htmlFor="offer-minimum" className="mb-1.5 block text-xs font-bold text-ink-muted">
                حداقل مقدار سفارش{selectedProduct ? ` (${selectedProduct.unit})` : ""} *
              </label>
              <input
                id="offer-minimum"
                name="minOrderQuantity"
                type="number"
                min="1"
                step="1"
                required
                disabled={isPending}
                value={formValues.minOrderQuantity}
                onChange={(event) =>
                  setFormValues((values) => ({
                    ...values,
                    minOrderQuantity: event.target.value,
                  }))
                }
                aria-invalid={Boolean(state.fieldErrors?.minOrderQuantity)}
                aria-describedby={state.fieldErrors?.minOrderQuantity ? "offer-minimum-error" : undefined}
                className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-primary disabled:opacity-60"
              />
              <FieldError id="offer-minimum-error" errors={state.fieldErrors?.minOrderQuantity} />
            </div>

            <div>
              <label htmlFor="offer-delivery" className="mb-1.5 block text-xs font-bold text-ink-muted">
                زمان آماده‌سازی و تحویل (روز)
              </label>
              <input
                id="offer-delivery"
                name="deliveryDays"
                type="number"
                min="0"
                max="365"
                step="1"
                disabled={isPending}
                value={formValues.deliveryDays}
                onChange={(event) =>
                  setFormValues((values) => ({
                    ...values,
                    deliveryDays: event.target.value,
                  }))
                }
                aria-invalid={Boolean(state.fieldErrors?.deliveryDays)}
                aria-describedby={state.fieldErrors?.deliveryDays ? "offer-delivery-error" : undefined}
                className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-primary disabled:opacity-60"
              />
              <FieldError id="offer-delivery-error" errors={state.fieldErrors?.deliveryDays} />
            </div>

            <div>
              <label htmlFor="offer-status" className="mb-1.5 block text-xs font-bold text-ink-muted">
                وضعیت انتشار
              </label>
              <select
                id="offer-status"
                name="status"
                disabled={isPending}
                value={formValues.status}
                onChange={(event) =>
                  setFormValues((values) => ({
                    ...values,
                    status: event.target.value as "active" | "inactive",
                  }))
                }
                aria-invalid={Boolean(state.fieldErrors?.status)}
                aria-describedby={state.fieldErrors?.status ? "offer-status-error" : undefined}
                className="h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary disabled:opacity-60"
              >
                <option value="inactive">غیرفعال (پیش‌فرض)</option>
                <option value="active">فعال</option>
              </select>
              <FieldError id="offer-status-error" errors={state.fieldErrors?.status} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              disabled={isPending || !selectedProduct}
              className="inline-flex min-h-10 items-center justify-center rounded-control bg-primary px-6 text-xs font-black text-white transition hover:bg-primary-hover disabled:opacity-50"
            >
              {isPending ? "در حال ثبت..." : "ذخیره و ثبت عرضه"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export function OfferEditModal({
  offer,
  onClose,
  onSuccess,
}: {
  offer: SupplierOfferListItemDTO;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [formValues, setFormValues] = useState<EditOfferFormValues>(() => ({
    price: String(offer.price),
    stock: String(offer.stock),
    minOrderQuantity: String(offer.minOrderQuantity),
    deliveryDays: String(offer.deliveryDays),
  }));
  const editAction = useCallback(
    async (previousState: SupplierOfferActionState, formData: FormData) => {
      const result = await updateOfferAction(previousState, formData);
      if (result.ok) {
        onSuccess();
        onClose();
      }
      return result;
    },
    [onClose, onSuccess],
  );
  const [state, formAction, isPending] = useActionState(editAction, initialState);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("[data-dialog-autofocus]")?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!isPending) {
          event.preventDefault();
          onClose();
        }
        return;
      }

      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden"));

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [isPending, onClose]);

  const requestClose = () => {
    if (!isPending) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-3 backdrop-blur-xs sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={isPending}
        tabIndex={-1}
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-card border border-line bg-surface shadow-float sm:max-h-[calc(100dvh-2rem)]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <IconEdit className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <h3 id={titleId} className="text-sm font-black text-ink">ویرایش شرایط عرضه</h3>
            </div>
            <p id={descriptionId} className="mt-1 truncate text-xs text-ink-muted">{offer.productName}</p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={requestClose}
            aria-label="بستن پنجره ویرایش عرضه"
            className="grid size-9 shrink-0 place-items-center rounded-control text-ink-muted transition hover:bg-surface-subtle disabled:opacity-50"
          >
            <IconX className="size-4" aria-hidden="true" />
          </button>
        </div>

        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="offerId" value={offer.id} />

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
            {state.error ? (
              <div role="alert" className="rounded-control bg-danger-soft p-3 text-xs font-bold text-danger">{state.error}</div>
            ) : null}
            <FieldError errors={state.fieldErrors?.offerId} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="edit-price" className="mb-1 block text-xs font-bold text-ink-muted">قیمت واحد (تومان) *</label>
                <input
                  id="edit-price" name="price" type="number" min="1" step="1" required
                  value={formValues.price}
                  onChange={(event) =>
                    setFormValues((values) => ({
                      ...values,
                      price: event.target.value,
                    }))
                  }
                  disabled={isPending} data-dialog-autofocus
                  aria-invalid={Boolean(state.fieldErrors?.price)}
                  aria-describedby={state.fieldErrors?.price ? "edit-price-error" : undefined}
                  className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-primary disabled:opacity-60"
                />
                <FieldError id="edit-price-error" errors={state.fieldErrors?.price} />
              </div>

              <div>
                <label htmlFor="edit-stock" className="mb-1 block text-xs font-bold text-ink-muted">موجودی انبار ({offer.productUnit}) *</label>
                <input
                  id="edit-stock" name="stock" type="number" min="0" step="1" required
                  value={formValues.stock}
                  onChange={(event) =>
                    setFormValues((values) => ({
                      ...values,
                      stock: event.target.value,
                    }))
                  }
                  disabled={isPending}
                  aria-invalid={Boolean(state.fieldErrors?.stock)}
                  aria-describedby={state.fieldErrors?.stock ? "edit-stock-error" : undefined}
                  className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-primary disabled:opacity-60"
                />
                <FieldError id="edit-stock-error" errors={state.fieldErrors?.stock} />
              </div>

              <div>
                <label htmlFor="edit-minimum" className="mb-1 block text-xs font-bold text-ink-muted">حداقل سفارش ({offer.productUnit}) *</label>
                <input
                  id="edit-minimum" name="minOrderQuantity" type="number" min="1" step="1" required
                  value={formValues.minOrderQuantity}
                  onChange={(event) =>
                    setFormValues((values) => ({
                      ...values,
                      minOrderQuantity: event.target.value,
                    }))
                  }
                  disabled={isPending}
                  aria-invalid={Boolean(state.fieldErrors?.minOrderQuantity)}
                  aria-describedby={state.fieldErrors?.minOrderQuantity ? "edit-minimum-error" : undefined}
                  className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-primary disabled:opacity-60"
                />
                <FieldError id="edit-minimum-error" errors={state.fieldErrors?.minOrderQuantity} />
              </div>

              <div>
                <label htmlFor="edit-delivery" className="mb-1 block text-xs font-bold text-ink-muted">زمان تحویل (روز)</label>
                <input
                  id="edit-delivery" name="deliveryDays" type="number" min="0" max="365" step="1"
                  value={formValues.deliveryDays}
                  onChange={(event) =>
                    setFormValues((values) => ({
                      ...values,
                      deliveryDays: event.target.value,
                    }))
                  }
                  disabled={isPending}
                  aria-invalid={Boolean(state.fieldErrors?.deliveryDays)}
                  aria-describedby={state.fieldErrors?.deliveryDays ? "edit-delivery-error" : undefined}
                  className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-primary disabled:opacity-60"
                />
                <FieldError id="edit-delivery-error" errors={state.fieldErrors?.deliveryDays} />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-line bg-surface px-4 py-3 sm:px-6 sm:py-4">
            <button type="button" onClick={requestClose} disabled={isPending} className="min-h-10 rounded-control border border-line px-4 text-xs font-bold text-ink-muted transition hover:bg-surface-subtle disabled:opacity-50">انصراف</button>
            <button type="submit" disabled={isPending} className="min-h-10 rounded-control bg-primary px-5 text-xs font-black text-white transition hover:bg-primary-hover disabled:opacity-50">
              {isPending ? "در حال ذخیره..." : "ذخیره تغییرات"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function OfferStatusToggle({ offer }: { offer: SupplierOfferListItemDTO }) {
  const [successfulStatus, setSuccessfulStatus] = useState<
    "active" | "inactive" | null
  >(null);
  const toggleAction = useCallback(
    async (previousState: SupplierOfferActionState, formData: FormData) => {
      setSuccessfulStatus(null);
      const requestedStatus = formData.get("status");
      const result = await toggleOfferStatusAction(previousState, formData);
      if (
        result.ok &&
        (requestedStatus === "active" || requestedStatus === "inactive")
      ) {
        setSuccessfulStatus(requestedStatus);
      }
      return result;
    },
    [],
  );
  const [state, formAction, isPending] = useActionState(
    toggleAction,
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
          className={`rounded-control px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50 ${offer.status === "active" ? "bg-danger-soft text-danger hover:bg-danger hover:text-white" : "bg-success-soft text-success hover:bg-success hover:text-white"}`}
          title={offer.status === "active" ? "غیرفعال‌سازی عرضه" : "فعال‌سازی انتشار عرضه"}
        >
          {isPending ? "در حال تغییر..." : offer.status === "active" ? "غیرفعال کن" : "فعال کن"}
        </button>
      </form>
      <div aria-live="polite" className="mt-1 max-w-36 text-center text-[10px] font-bold">
        {!isPending && state.error ? (
          <span className="text-danger">{state.error}</span>
        ) : null}
        {!isPending ? (
          <>
            <FieldError errors={state.fieldErrors?.offerId} />
            <FieldError errors={state.fieldErrors?.status} />
          </>
        ) : null}
        {!isPending && state.ok && successfulStatus ? (
          <span className="text-success">عرضه با موفقیت {successfulStatus === "active" ? "فعال" : "غیرفعال"} شد.</span>
        ) : null}
      </div>
    </div>
  );
}

export function OfferRowActions({ offer }: { offer: SupplierOfferListItemDTO }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editSuccessMessage, setEditSuccessMessage] = useState<string | null>(null);
  const closeEditor = useCallback(() => setIsEditing(false), []);
  const handleEditSuccess = useCallback(() => {
    setEditSuccessMessage("تغییرات عرضه با موفقیت ذخیره شد.");
  }, []);

  return (
    <>
      <div className="flex flex-wrap items-start justify-center gap-2">
        <div className="inline-flex flex-col items-center">
          <button
            type="button"
            onClick={() => {
              setEditSuccessMessage(null);
              setIsEditing(true);
            }}
            className="inline-flex items-center gap-1 rounded-control border border-line px-2.5 py-1 text-[11px] font-bold text-ink-muted transition hover:border-primary hover:text-primary"
          >
            <IconEdit className="size-3.5" aria-hidden="true" />
            ویرایش
          </button>
          <span aria-live="polite" className="mt-1 max-w-36 text-center text-[10px] font-bold text-success">{editSuccessMessage}</span>
        </div>
        <OfferStatusToggle offer={offer} />
      </div>

      {isEditing ? (
        <OfferEditModal offer={offer} onClose={closeEditor} onSuccess={handleEditSuccess} />
      ) : null}
    </>
  );
}
