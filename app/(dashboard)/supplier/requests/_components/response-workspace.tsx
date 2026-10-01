"use client";

import {
  IconAlertCircle,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconEdit,
  IconLoader2,
  IconPackage,
  IconReceipt,
  IconTruck,
  IconX,
} from "@tabler/icons-react";
import {
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { InternalRequestDialog } from "@/app/(dashboard)/cafe/internal-requests/_components/internal-request-dialog";
import {
  declineSupplierRequestAction,
  submitSupplierResponseAction,
  updateSupplierResponseAction,
} from "@/app/actions/supplier-responses";
import type { SupplierRequestSupplierViewDTO } from "@/src/domain/supplier-request";
import type { SupplierResponseSupplierViewDTO } from "@/src/domain/supplier-response";
import {
  formatPersianDateTime,
  formatPersianNumber,
  formatToman,
} from "@/src/lib/persian-format";

type Decision = "quoted" | "unavailable" | undefined;

type ItemDraft = {
  purchaseRequestItemId: string;
  decision: Decision;
  unitPrice: string;
  confirmedQuantity: string;
  note: string;
};

type FormDraft = {
  items: ItemDraft[];
  deliveryDays: string;
  shippingCost: string;
  note: string;
};

type ItemErrors = Record<
  string,
  { decision?: string; unitPrice?: string; confirmedQuantity?: string }
>;

const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
const integerFormatter = new Intl.NumberFormat("fa-IR");

function toAsciiDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
    .replace(/[^0-9]/g, "")
    .replace(/^0+(?=\d)/, "");
}

function formatInputInteger(value: string) {
  if (!value) return "";
  try {
    return integerFormatter.format(BigInt(value));
  } catch {
    return value;
  }
}

function formatBigToman(value: bigint) {
  return `${integerFormatter.format(value)} تومان`;
}

function createDraft(
  request: SupplierRequestSupplierViewDTO,
  response?: SupplierResponseSupplierViewDTO,
): FormDraft {
  const responseItems = new Map(
    response?.items.map((item) => [item.purchaseRequestItemId, item]),
  );

  return {
    items: request.items.map((item) => {
      const saved = responseItems.get(item.purchaseRequestItemId);
      return {
        purchaseRequestItemId: item.purchaseRequestItemId,
        decision: saved?.status,
        unitPrice:
          saved?.status === "quoted" && saved.unitPrice !== undefined
            ? String(saved.unitPrice)
            : "",
        confirmedQuantity:
          saved?.status === "quoted" ? String(saved.confirmedQuantity) : "",
        note: saved?.note ?? "",
      };
    }),
    deliveryDays: response ? String(response.deliveryDays) : "",
    shippingCost: response ? String(response.shippingCost) : "0",
    note: response?.note ?? "",
  };
}

function calculatePreview(draft: FormDraft) {
  try {
    let itemsTotal = BigInt(0);
    for (const item of draft.items) {
      if (item.decision !== "quoted" || !item.unitPrice || !item.confirmedQuantity) {
        continue;
      }
      itemsTotal += BigInt(item.unitPrice) * BigInt(item.confirmedQuantity);
    }
    const shipping = draft.shippingCost
      ? BigInt(draft.shippingCost)
      : BigInt(0);
    return { itemsTotal, shipping, total: itemsTotal + shipping, valid: true };
  } catch {
    return {
      itemsTotal: BigInt(0),
      shipping: BigInt(0),
      total: BigInt(0),
      valid: false,
    };
  }
}

export function ResponseWorkspace({
  request,
  initialResponse,
  canRespond,
}: {
  request: SupplierRequestSupplierViewDTO;
  initialResponse?: SupplierResponseSupplierViewDTO;
  canRespond: boolean;
}) {
  const router = useRouter();
  const [response, setResponse] = useState(initialResponse);
  const [mode, setMode] = useState<"idle" | "create" | "view" | "edit">(
    initialResponse ? "view" : "idle",
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [declined, setDeclined] = useState(request.status === "declined");
  const [declineOpen, setDeclineOpen] = useState(false);

  if (declined) {
    return (
      <section className="rounded-card border border-danger/20 bg-danger-soft p-5 text-danger" aria-live="polite">
        <h2 className="text-base font-black">درخواست رد شد.</h2>
        <p className="mt-1 text-xs leading-6">
          برای این درخواست امکان ثبت پیشنهاد قیمت وجود ندارد.
        </p>
      </section>
    );
  }

  if (request.status === "cancelled") {
    return response ? <ResponseSummary response={response} /> : null;
  }

  if (request.status === "declined") return null;

  if (response && mode === "view") {
    return (
      <>
        {feedback ? <SuccessFeedback message={feedback} /> : null}
        <ResponseSummary response={response} />
        {request.status === "responded" && canRespond ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setMode("edit");
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-control border border-primary px-5 text-sm font-black text-primary transition hover:bg-primary-soft"
            >
              <IconEdit className="size-4" aria-hidden="true" />
              ویرایش پیشنهاد
            </button>
          </div>
        ) : null}
      </>
    );
  }

  if ((mode === "create" || mode === "edit") && canRespond) {
    return (
      <QuoteEditor
        key={mode}
        request={request}
        response={mode === "edit" ? response : undefined}
        mode={mode}
        onCancel={() => setMode(response ? "view" : "idle")}
        onDecline={
          mode === "create"
            ? () => {
                setMode("idle");
                setDeclineOpen(true);
              }
            : undefined
        }
        onSuccess={(nextResponse, message) => {
          setResponse(nextResponse);
          setFeedback(message);
          setMode("view");
          router.refresh();
        }}
        onStale={() => router.refresh()}
      />
    );
  }

  if (request.status !== "pending") return null;

  return (
    <>
      <section className="rounded-card border border-primary/20 bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-ink">پاسخ به درخواست</h2>
            <p className="mt-1 text-xs leading-6 text-ink-muted">
              برای همه اقلام وضعیت موجودی و در صورت امکان قیمت خود را اعلام کنید.
            </p>
          </div>
          {canRespond ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setMode("create")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover"
              >
                <IconReceipt className="size-4" aria-hidden="true" />
                ثبت پیشنهاد قیمت
              </button>
              <button
                type="button"
                onClick={() => setDeclineOpen(true)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-danger/40 px-5 text-sm font-black text-danger transition hover:bg-danger-soft"
              >
                <IconX className="size-4" aria-hidden="true" />
                رد درخواست
              </button>
            </div>
          ) : (
            <span className="rounded-control bg-surface-subtle px-4 py-2 text-xs font-bold text-ink-muted">
              دسترسی شما فقط برای مشاهده است.
            </span>
          )}
        </div>
      </section>

      {canRespond ? (
        <DeclineDialog
          open={declineOpen}
          requestId={request.id}
          onClose={() => setDeclineOpen(false)}
          onSuccess={() => {
            setDeclineOpen(false);
            setDeclined(true);
            router.refresh();
          }}
          onStale={() => router.refresh()}
        />
      ) : null}
    </>
  );
}

function QuoteEditor({
  request,
  response,
  mode,
  onCancel,
  onDecline,
  onSuccess,
  onStale,
}: {
  request: SupplierRequestSupplierViewDTO;
  response?: SupplierResponseSupplierViewDTO;
  mode: "create" | "edit";
  onCancel: () => void;
  onDecline?: () => void;
  onSuccess: (response: SupplierResponseSupplierViewDTO, message: string) => void;
  onStale: () => void;
}) {
  const [draft, setDraft] = useState(() => createDraft(request, response));
  const [itemErrors, setItemErrors] = useState<ItemErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const reviewSubmitRef = useRef<HTMLButtonElement>(null);

  const preview = useMemo(() => calculatePreview(draft), [draft]);
  const quotedCount = draft.items.filter((item) => item.decision === "quoted").length;
  const unavailableCount = draft.items.filter((item) => item.decision === "unavailable").length;
  const undecidedItems = request.items.filter(
    (item) =>
      !draft.items.find((draftItem) => draftItem.purchaseRequestItemId === item.purchaseRequestItemId)
        ?.decision,
  );
  const allUnavailable = unavailableCount === draft.items.length;

  function updateItem(id: string, patch: Partial<ItemDraft>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.purchaseRequestItemId === id ? { ...item, ...patch } : item,
      ),
    }));
    setItemErrors((current) => ({ ...current, [id]: {} }));
    setFormError(null);
  }

  function validate() {
    const nextErrors: ItemErrors = {};
    let nextFormError: string | null = null;

    for (const requestItem of request.items) {
      const item = draft.items.find(
        (candidate) => candidate.purchaseRequestItemId === requestItem.purchaseRequestItemId,
      )!;
      const errors: ItemErrors[string] = {};
      if (!item.decision) {
        errors.decision = "وضعیت این کالا را مشخص کنید.";
      } else if (item.decision === "quoted") {
        const price = Number(item.unitPrice);
        const quantity = Number(item.confirmedQuantity);
        if (!item.unitPrice || !Number.isSafeInteger(price) || price <= 0) {
          errors.unitPrice = "قیمت واحد باید یک عدد صحیح و مثبت باشد.";
        }
        if (
          !item.confirmedQuantity ||
          !Number.isSafeInteger(quantity) ||
          quantity <= 0 ||
          quantity > requestItem.quantity
        ) {
          errors.confirmedQuantity = `مقدار باید بین ۱ تا ${formatPersianNumber(requestItem.quantity)} باشد.`;
        }
      }
      if (Object.keys(errors).length > 0) nextErrors[item.purchaseRequestItemId] = errors;
    }

    const deliveryDays = Number(draft.deliveryDays);
    const shippingCost = Number(draft.shippingCost || "0");
    if (!Number.isSafeInteger(deliveryDays) || deliveryDays < 0 || deliveryDays > 365) {
      nextFormError = "زمان تحویل باید عددی صحیح بین صفر تا ۳۶۵ روز باشد.";
    } else if (!Number.isSafeInteger(shippingCost) || shippingCost < 0) {
      nextFormError = "هزینه ارسال باید عددی صحیح و غیرمنفی باشد.";
    } else if (!preview.valid) {
      nextFormError = "مقادیر واردشده برای محاسبه معتبر نیستند.";
    } else if (allUnavailable) {
      nextFormError =
        mode === "create"
          ? "اگر هیچ‌یک از اقلام قابل تأمین نیست، درخواست را رد کنید."
          : "برای حفظ پیشنهاد، حداقل یک قلم باید قیمت‌گذاری شود.";
    }

    setItemErrors(nextErrors);
    setFormError(nextFormError);
    return Object.keys(nextErrors).length === 0 && !nextFormError;
  }

  function openReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;
    setReviewOpen(true);
  }

  function submit() {
    if (!validate()) {
      setReviewOpen(false);
      return;
    }

    const payload = {
      supplierRequestId: request.id,
      deliveryDays: Number(draft.deliveryDays),
      shippingCost: Number(draft.shippingCost || "0"),
      note: draft.note.trim() || undefined,
      items: draft.items.map((item) =>
        item.decision === "quoted"
          ? {
              purchaseRequestItemId: item.purchaseRequestItemId,
              status: "quoted" as const,
              unitPrice: Number(item.unitPrice),
              confirmedQuantity: Number(item.confirmedQuantity),
              note: item.note.trim() || undefined,
            }
          : {
              purchaseRequestItemId: item.purchaseRequestItemId,
              status: "unavailable" as const,
              note: item.note.trim() || undefined,
            },
      ),
    };

    startTransition(async () => {
      const result =
        mode === "create"
          ? await submitSupplierResponseAction({}, payload)
          : await updateSupplierResponseAction({}, payload);
      if (result.ok && result.data) {
        setReviewOpen(false);
        onSuccess(
          result.data,
          mode === "create"
            ? "پیشنهاد قیمت با موفقیت ثبت شد."
            : "پیشنهاد قیمت به‌روزرسانی شد.",
        );
        return;
      }
      const message = humanizeActionError(result.error);
      setFormError(message);
      setReviewOpen(false);
      if (isStaleError(result.error)) onStale();
    });
  }

  return (
    <>
      <form onSubmit={openReview} className="space-y-5" noValidate>
        <section className="rounded-card border border-line bg-surface shadow-card">
          <div className="border-b border-line px-4 py-4 sm:px-6">
            <h2 className="text-lg font-black text-ink">
              {mode === "create" ? "ثبت پیشنهاد قیمت" : "ویرایش پیشنهاد قیمت"}
            </h2>
            <p className="mt-1 text-xs leading-6 text-ink-muted">
              برای هر کالا دقیقاً یکی از دو گزینه «قیمت می‌دهم» یا «موجود نیست» را انتخاب کنید.
            </p>
          </div>

          <div className="grid gap-4 p-3 sm:p-5 xl:grid-cols-2">
            {request.items.map((requestItem, index) => {
              const item = draft.items.find(
                (candidate) => candidate.purchaseRequestItemId === requestItem.purchaseRequestItemId,
              )!;
              const errors = itemErrors[item.purchaseRequestItemId];
              const confirmed = Number(item.confirmedQuantity);
              const isPartial =
                item.decision === "quoted" &&
                Number.isSafeInteger(confirmed) &&
                confirmed > 0 &&
                confirmed < requestItem.quantity;

              return (
                <fieldset
                  key={requestItem.purchaseRequestItemId}
                  className="min-w-0 rounded-card border border-line p-4 sm:p-5"
                  aria-describedby={errors?.decision ? `${requestItem.purchaseRequestItemId}-decision-error` : undefined}
                >
                  <legend className="w-full px-1">
                    <span className="flex min-w-0 items-start gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-control bg-primary-soft text-xs font-black text-primary">
                        {formatPersianNumber(index + 1)}
                      </span>
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-black leading-6 text-ink">
                          {requestItem.name}
                        </span>
                        <span className="mt-1 block text-[11px] font-bold text-ink-muted">
                          درخواست خریدار: {formatPersianNumber(requestItem.quantity)} {requestItem.unit}
                        </span>
                      </span>
                    </span>
                  </legend>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <DecisionOption
                      name={`decision-${requestItem.purchaseRequestItemId}`}
                      checked={item.decision === "quoted"}
                      label="قیمت می‌دهم"
                      icon={<IconCheck className="size-4" />}
                      disabled={isPending}
                      onChange={() => updateItem(item.purchaseRequestItemId, { decision: "quoted" })}
                    />
                    <DecisionOption
                      name={`decision-${requestItem.purchaseRequestItemId}`}
                      checked={item.decision === "unavailable"}
                      label="موجود نیست"
                      icon={<IconX className="size-4" />}
                      disabled={isPending}
                      onChange={() =>
                        updateItem(item.purchaseRequestItemId, {
                          decision: "unavailable",
                          unitPrice: "",
                          confirmedQuantity: "",
                        })
                      }
                    />
                  </div>
                  {errors?.decision ? (
                    <FieldError id={`${requestItem.purchaseRequestItemId}-decision-error`} message={errors.decision} />
                  ) : null}

                  {item.decision === "quoted" ? (
                    <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                      <MoneyInput
                        id={`unit-price-${requestItem.purchaseRequestItemId}`}
                        label="قیمت واحد"
                        value={item.unitPrice}
                        disabled={isPending}
                        required
                        error={errors?.unitPrice}
                        onChange={(unitPrice) => updateItem(item.purchaseRequestItemId, { unitPrice })}
                      />
                      <IntegerInput
                        id={`quantity-${requestItem.purchaseRequestItemId}`}
                        label={`مقدار قابل تأمین (${requestItem.unit})`}
                        value={item.confirmedQuantity}
                        disabled={isPending}
                        required
                        max={requestItem.quantity}
                        error={errors?.confirmedQuantity}
                        onChange={(confirmedQuantity) =>
                          updateItem(item.purchaseRequestItemId, { confirmedQuantity })
                        }
                      />
                      {isPartial ? (
                        <p className="sm:col-span-2 rounded-control bg-primary-soft px-3 py-2 text-[11px] font-bold leading-6 text-primary">
                          تأمین جزئی: از {formatPersianNumber(requestItem.quantity)} {requestItem.unit} درخواستی، {formatPersianNumber(confirmed)} {requestItem.unit} قابل تأمین است.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {item.decision ? (
                    <div className="mt-4">
                      <label htmlFor={`item-note-${requestItem.purchaseRequestItemId}`} className="mb-1.5 block text-xs font-bold text-ink-muted">
                        یادداشت اختیاری
                      </label>
                      <textarea
                        id={`item-note-${requestItem.purchaseRequestItemId}`}
                        value={item.note}
                        onChange={(event) => updateItem(item.purchaseRequestItemId, { note: event.target.value })}
                        maxLength={300}
                        rows={2}
                        disabled={isPending}
                        placeholder={item.decision === "unavailable" ? "در صورت تمایل، دلیل ناموجود بودن را بنویسید." : "توضیحی درباره این کالا..."}
                        className="w-full resize-y rounded-control border border-line bg-surface px-3 py-2.5 text-sm leading-6 text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-primary disabled:opacity-60"
                      />
                    </div>
                  ) : null}
                </fieldset>
              );
            })}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-6">
            <h2 className="text-base font-black text-ink">شرایط پیشنهاد</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="delivery-days" className="mb-1.5 block text-xs font-bold text-ink-muted">
                  زمان تحویل
                </label>
                <div className="relative">
                  <input
                    id="delivery-days"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={365}
                    step={1}
                    value={draft.deliveryDays}
                    onChange={(event) => {
                      const normalized = toAsciiDigits(event.target.value);
                      const deliveryDays = normalized
                        ? String(Math.min(Number(normalized), 365))
                        : "";
                      setDraft((current) => ({ ...current, deliveryDays }));
                      setFormError(null);
                    }}
                    disabled={isPending}
                    required
                    className="h-11 w-full rounded-control border border-line bg-surface px-3 pe-12 text-start text-sm tabular-nums text-ink outline-none transition focus:border-primary disabled:opacity-60"
                  />
                  <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted">روز</span>
                </div>
                <p className="mt-1.5 text-[11px] font-bold text-primary">
                  {deliveryLabel(Number(draft.deliveryDays))}
                </p>
              </div>
              <MoneyInput
                id="shipping-cost"
                label="هزینه ارسال"
                value={draft.shippingCost}
                disabled={isPending}
                allowZero
                onChange={(shippingCost) => {
                  setDraft((current) => ({ ...current, shippingCost }));
                  setFormError(null);
                }}
                hint={draft.shippingCost === "0" ? "ارسال رایگان" : undefined}
              />
            </div>
            <div className="mt-4">
              <label htmlFor="response-note" className="mb-1.5 block text-xs font-bold text-ink-muted">
                یادداشت کلی پیشنهاد (اختیاری)
              </label>
              <textarea
                id="response-note"
                value={draft.note}
                onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                maxLength={500}
                rows={3}
                disabled={isPending}
                placeholder="شرایط کلی ارسال یا توضیحات تکمیلی..."
                className="w-full resize-y rounded-control border border-line bg-surface px-3 py-2.5 text-sm leading-6 text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-primary disabled:opacity-60"
              />
            </div>
          </div>

          <aside className="rounded-card border border-primary/20 bg-surface p-4 shadow-card lg:sticky lg:top-4">
            <h2 className="flex items-center gap-2 text-sm font-black text-ink">
              <IconReceipt className="size-5 text-primary" aria-hidden="true" />
              خلاصه برآورد
            </h2>
            <dl className="mt-4 space-y-3 text-xs">
              <SummaryRow label="اقلام قیمت‌گذاری‌شده" value={`${formatPersianNumber(quotedCount)} قلم`} />
              <SummaryRow label="اقلام ناموجود" value={`${formatPersianNumber(unavailableCount)} قلم`} />
              <SummaryRow label="جمع کالاها" value={preview.valid ? formatBigToman(preview.itemsTotal) : "نامعتبر"} />
              <SummaryRow label="هزینه ارسال" value={preview.valid && preview.shipping === BigInt(0) ? "رایگان" : preview.valid ? formatBigToman(preview.shipping) : "نامعتبر"} />
              <div className="border-t border-line pt-3">
                <SummaryRow label="جمع برآوردی" value={preview.valid ? formatBigToman(preview.total) : "نامعتبر"} strong />
              </div>
              <SummaryRow label="زمان تحویل" value={deliveryLabel(Number(draft.deliveryDays))} />
            </dl>
            <p className="mt-4 text-[10px] leading-5 text-ink-muted">
              مبلغ نهایی پس از ثبت، توسط سامانه دوباره محاسبه و تأیید می‌شود.
            </p>
          </aside>
        </section>

        {undecidedItems.length > 0 ? (
          <div className="rounded-control border border-warning/25 bg-warning-soft px-4 py-3 text-xs leading-6 text-warning">
            <p className="font-black">این کالاها هنوز تعیین تکلیف نشده‌اند:</p>
            <p className="mt-1">{undecidedItems.map((item) => item.name).join("، ")}</p>
          </div>
        ) : null}

        {allUnavailable ? (
          <div className="rounded-control border border-warning/25 bg-warning-soft px-4 py-3 text-xs leading-6 text-warning">
            <p className="font-black">هیچ قلمی برای قیمت‌گذاری انتخاب نشده است.</p>
            <p className="mt-1">
              {mode === "create"
                ? "اگر هیچ‌یک از اقلام قابل تأمین نیست، به صفحه درخواست برگردید و آن را رد کنید."
                : "برای ثبت ویرایش، دست‌کم یک قلم را قیمت‌گذاری کنید."}
            </p>
            {mode === "create" && onDecline ? (
              <button
                type="button"
                onClick={onDecline}
                className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-control border border-warning/40 px-4 font-black transition hover:bg-surface"
              >
                <IconX className="size-4" aria-hidden="true" />
                رد درخواست
              </button>
            ) : null}
          </div>
        ) : null}

        {formError ? (
          <div role="alert" className="flex items-start gap-2 rounded-control border border-danger/25 bg-danger-soft px-4 py-3 text-xs font-bold leading-6 text-danger">
            <IconAlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {formError}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="min-h-11 rounded-control border border-line px-5 text-sm font-black text-ink-muted transition hover:border-primary hover:text-primary disabled:opacity-50"
          >
            انصراف
          </button>
          <button
            type="submit"
            disabled={isPending || undecidedItems.length > 0 || allUnavailable}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-primary px-6 text-sm font-black text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mode === "create" ? "بررسی و ثبت پیشنهاد" : "بررسی و ثبت ویرایش"}
          </button>
        </div>
      </form>

      <InternalRequestDialog
        open={reviewOpen}
        title={mode === "create" ? "مرور پیشنهاد قیمت" : "مرور ویرایش پیشنهاد"}
        description="پیش از ثبت، خلاصه پیشنهاد را بررسی کنید."
        onClose={() => !isPending && setReviewOpen(false)}
        busy={isPending}
        size="sm"
        initialFocusRef={reviewSubmitRef}
      >
        <div className="overflow-y-auto p-4 sm:p-6">
          <dl className="space-y-3 text-sm">
            <SummaryRow label="اقلام قیمت‌گذاری‌شده" value={`${formatPersianNumber(quotedCount)} قلم`} />
            <SummaryRow label="اقلام ناموجود" value={`${formatPersianNumber(unavailableCount)} قلم`} />
            <SummaryRow label="جمع کالاها" value={formatBigToman(preview.itemsTotal)} />
            <SummaryRow label="هزینه ارسال" value={preview.shipping === BigInt(0) ? "رایگان" : formatBigToman(preview.shipping)} />
            <div className="border-t border-line pt-3">
              <SummaryRow label="جمع برآوردی" value={formatBigToman(preview.total)} strong />
            </div>
            <SummaryRow label="زمان تحویل" value={deliveryLabel(Number(draft.deliveryDays))} />
          </dl>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-line p-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={() => setReviewOpen(false)} disabled={isPending} className="min-h-11 rounded-control border border-line px-5 text-sm font-black text-ink-muted disabled:opacity-50">
            بازگشت و ویرایش
          </button>
          <button ref={reviewSubmitRef} type="button" onClick={submit} disabled={isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover disabled:opacity-50">
            {isPending ? <IconLoader2 className="size-4 animate-spin" aria-hidden="true" /> : <IconCheck className="size-4" aria-hidden="true" />}
            {isPending ? "در حال ثبت..." : mode === "create" ? "ثبت پیشنهاد قیمت" : "ثبت ویرایش پیشنهاد"}
          </button>
        </div>
      </InternalRequestDialog>
    </>
  );
}

function ResponseSummary({ response }: { response: SupplierResponseSupplierViewDTO }) {
  const edited = response.updatedAt !== response.respondedAt;
  return (
    <section className="overflow-hidden rounded-card border border-success/25 bg-surface shadow-card" aria-labelledby="registered-response-title">
      <div className="flex flex-col gap-3 border-b border-line bg-success-soft/45 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h2 id="registered-response-title" className="flex items-center gap-2 text-lg font-black text-ink">
            <IconCircleCheck className="size-5 text-success" aria-hidden="true" />
            پیشنهاد قیمت ثبت‌شده
          </h2>
          <p className="mt-1 text-xs leading-6 text-ink-muted">
            مبالغ زیر اطلاعات تأییدشده و ذخیره‌شده در سامانه هستند.
          </p>
        </div>
        <div className="text-[11px] leading-6 text-ink-muted">
          <p>ثبت اولیه: {formatPersianDateTime(response.respondedAt)}</p>
          {edited ? <p>آخرین ویرایش: {formatPersianDateTime(response.updatedAt)}</p> : null}
        </div>
      </div>

      <div className="grid gap-3 p-3 sm:p-5 lg:grid-cols-2">
        {response.items.map((item) => (
          <article key={item.purchaseRequestItemId} className="rounded-card border border-line p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words text-sm font-black leading-6 text-ink">{item.name}</h3>
                <p className="mt-1 text-[11px] text-ink-muted">
                  درخواست: {formatPersianNumber(item.requestedQuantity)} {item.unit}
                </p>
              </div>
              <span className={`inline-flex min-h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-black ${item.status === "quoted" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
                {item.status === "quoted" ? <IconCheck className="size-3.5" aria-hidden="true" /> : <IconX className="size-3.5" aria-hidden="true" />}
                {item.status === "quoted" ? "قیمت‌گذاری‌شده" : "ناموجود"}
              </span>
            </div>
            {item.status === "quoted" ? (
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs">
                <ReadOnlyMeta label="قیمت واحد" value={formatToman(item.unitPrice ?? 0)} />
                <ReadOnlyMeta label="مقدار قابل تأمین" value={`${formatPersianNumber(item.confirmedQuantity)} ${item.unit}`} />
                <ReadOnlyMeta label="جمع این قلم" value={formatToman(item.itemSubtotal)} />
                <ReadOnlyMeta label="نوع تأمین" value={item.confirmedQuantity < item.requestedQuantity ? "تأمین جزئی" : "تأمین کامل"} />
              </dl>
            ) : null}
            {item.note ? <p className="mt-4 rounded-control bg-surface-subtle px-3 py-2 text-xs leading-6 text-ink">{item.note}</p> : null}
          </article>
        ))}
      </div>

      <div className="grid gap-3 border-t border-line bg-surface-subtle/50 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
        <TotalCard icon={<IconPackage className="size-5" />} label="جمع کالاها" value={formatToman(response.itemSubtotal)} />
        <TotalCard icon={<IconTruck className="size-5" />} label="هزینه ارسال" value={response.shippingCost === 0 ? "رایگان" : formatToman(response.shippingCost)} />
        <TotalCard icon={<IconReceipt className="size-5" />} label="جمع برآوردی" value={formatToman(response.estimatedTotal)} emphasis />
        <TotalCard icon={<IconClock className="size-5" />} label="زمان تحویل" value={deliveryLabel(response.deliveryDays)} />
      </div>
      {response.note ? <div className="border-t border-line px-4 py-4 sm:px-6"><h3 className="text-xs font-black text-ink-muted">یادداشت کلی پیشنهاد</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink">{response.note}</p></div> : null}
    </section>
  );
}

function DeclineDialog({
  open,
  requestId,
  onClose,
  onSuccess,
  onStale,
}: {
  open: boolean;
  requestId: string;
  onClose: () => void;
  onSuccess: () => void;
  onStale: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const confirmRef = useRef<HTMLButtonElement>(null);

  function decline() {
    setError(null);
    startTransition(async () => {
      const result = await declineSupplierRequestAction({}, {
        supplierRequestId: requestId,
        reason: reason.trim() || undefined,
      });
      if (result.ok) {
        onSuccess();
        return;
      }
      setError(humanizeActionError(result.error));
      if (isStaleError(result.error)) onStale();
    });
  }

  return (
    <InternalRequestDialog open={open} title="رد درخواست استعلام" description="با رد این درخواست، امکان ثبت پیشنهاد قیمت برای آن وجود نخواهد داشت." onClose={onClose} busy={isPending} size="sm" initialFocusRef={confirmRef}>
      <div className="overflow-y-auto p-4 sm:p-6">
        <label htmlFor="decline-reason" className="mb-1.5 block text-xs font-bold text-ink-muted">دلیل رد (اختیاری)</label>
        <textarea id="decline-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} rows={4} disabled={isPending} placeholder="در صورت تمایل، دلیل رد را بنویسید." className="w-full resize-y rounded-control border border-line bg-surface px-3 py-2.5 text-sm leading-6 text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-primary disabled:opacity-60" />
        {error ? <div role="alert" className="mt-3 rounded-control bg-danger-soft px-3 py-2 text-xs font-bold leading-6 text-danger">{error}</div> : null}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-line p-4 sm:flex-row sm:justify-end sm:px-6">
        <button type="button" onClick={onClose} disabled={isPending} className="min-h-11 rounded-control border border-line px-5 text-sm font-black text-ink-muted disabled:opacity-50">انصراف</button>
        <button ref={confirmRef} type="button" onClick={decline} disabled={isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-danger px-5 text-sm font-black text-white transition disabled:opacity-50">
          {isPending ? <IconLoader2 className="size-4 animate-spin" aria-hidden="true" /> : <IconX className="size-4" aria-hidden="true" />}
          {isPending ? "در حال رد..." : "رد درخواست"}
        </button>
      </div>
    </InternalRequestDialog>
  );
}

function DecisionOption({ name, checked, label, icon, disabled, onChange }: { name: string; checked: boolean; label: string; icon: ReactNode; disabled: boolean; onChange: () => void }) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control border px-3 text-xs font-black transition ${checked ? "border-primary bg-primary-soft text-primary" : "border-line text-ink-muted hover:border-primary/50"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} disabled={disabled} className="sr-only" />
      <span aria-hidden="true">{icon}</span>{label}
    </label>
  );
}

function MoneyInput({ id, label, value, onChange, disabled, required = false, allowZero = false, error, hint }: { id: string; label: string; value: string; onChange: (value: string) => void; disabled: boolean; required?: boolean; allowZero?: boolean; error?: string; hint?: string }) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-bold text-ink-muted">{label}</label>
      <div className="relative">
        <input id={id} type="text" inputMode="numeric" autoComplete="off" value={formatInputInteger(value)} onChange={(event) => { const normalized = toAsciiDigits(event.target.value); onChange(!allowZero && normalized === "0" ? "" : normalized); }} disabled={disabled} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} placeholder={allowZero ? "۰" : "مثلاً ۱۲۵٬۰۰۰"} className="h-11 w-full rounded-control border border-line bg-surface px-3 pe-16 text-start text-sm tabular-nums text-ink outline-none transition focus:border-primary disabled:opacity-60" />
        <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted">تومان</span>
      </div>
      {hint ? <p className="mt-1 text-[11px] font-bold text-success">{hint}</p> : null}
      {error ? <FieldError id={errorId} message={error} /> : null}
    </div>
  );
}

function IntegerInput({ id, label, value, onChange, disabled, required, max, error }: { id: string; label: string; value: string; onChange: (value: string) => void; disabled: boolean; required: boolean; max: number; error?: string }) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-bold text-ink-muted">{label}</label>
      <input id={id} type="text" inputMode="numeric" autoComplete="off" value={formatInputInteger(value)} onChange={(event) => { const normalized = toAsciiDigits(event.target.value); if (!normalized || normalized === "0") { onChange(""); return; } onChange(BigInt(normalized) > BigInt(max) ? String(max) : normalized); }} disabled={disabled} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} placeholder={`حداکثر ${formatPersianNumber(max)}`} className="h-11 w-full rounded-control border border-line bg-surface px-3 text-start text-sm tabular-nums text-ink outline-none transition focus:border-primary disabled:opacity-60" />
      {error ? <FieldError id={errorId} message={error} /> : null}
    </div>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  return <p id={id} className="mt-1.5 text-[11px] font-bold leading-5 text-danger">{message}</p>;
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-start justify-between gap-4"><dt className={strong ? "font-black text-ink" : "text-ink-muted"}>{label}</dt><dd className={`text-end tabular-nums ${strong ? "font-black text-primary" : "font-bold text-ink"}`}>{value}</dd></div>;
}

function ReadOnlyMeta({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-ink-muted">{label}</dt><dd className="mt-1 font-black tabular-nums text-ink">{value}</dd></div>;
}

function TotalCard({ icon, label, value, emphasis = false }: { icon: ReactNode; label: string; value: string; emphasis?: boolean }) {
  return <div className={`rounded-control border p-3 ${emphasis ? "border-primary/25 bg-primary-soft" : "border-line bg-surface"}`}><dt className="flex items-center gap-2 text-[11px] font-bold text-ink-muted"><span className="text-primary" aria-hidden="true">{icon}</span>{label}</dt><dd className={`mt-2 text-sm font-black tabular-nums ${emphasis ? "text-primary" : "text-ink"}`}>{value}</dd></div>;
}

function SuccessFeedback({ message }: { message: string }) {
  return <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-control border border-success/25 bg-success-soft px-4 py-3 text-sm font-bold text-success"><IconCircleCheck className="size-5 shrink-0" aria-hidden="true" />{message}</div>;
}

function deliveryLabel(days: number) {
  if (!Number.isSafeInteger(days) || days < 0) return "زمان تحویل تعیین نشده";
  if (days === 0) return "امروز";
  if (days === 1) return "یک روز";
  if (days === 2) return "دو روز";
  return `${formatPersianNumber(days)} روز`;
}

function isStaleError(message?: string) {
  return Boolean(message && (message.includes("لغو") || message.includes("وضعیت") || message.includes("قبلاً")));
}

function humanizeActionError(message?: string) {
  if (!message) return "عملیات انجام نشد. لطفاً دوباره تلاش کنید.";
  if (message.includes("لغو") || message.includes("فعال نیست")) {
    return "این استعلام دیگر فعال نیست و امکان ثبت پیشنهاد برای آن وجود ندارد.";
  }
  if (message.includes("دسترسی") || message.includes("اجازه")) {
    return "اجازه انجام این عملیات برای حساب شما فعال نیست.";
  }
  const safeKeywords = ["الزامی", "باید", "نمی‌تواند", "نامعتبر", "ناقص", "حداقل", "بیشتر", "مجاز", "رد شده", "پاسخ داده"];
  if (safeKeywords.some((keyword) => message.includes(keyword))) return message;
  return "عملیات انجام نشد. لطفاً دوباره تلاش کنید.";
}
