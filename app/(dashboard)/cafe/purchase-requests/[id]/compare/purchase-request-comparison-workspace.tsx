"use client";

import {
  IconAlertTriangle,
  IconBuildingStore,
  IconCheck,
  IconChevronLeft,
  IconClock,
  IconCoin,
  IconPackageOff,
  IconRefresh,
  IconShoppingCartCheck,
  IconTruckDelivery,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { InternalRequestDialog } from "@/app/(dashboard)/cafe/internal-requests/_components/internal-request-dialog";
import { savePurchaseRequestSelectionAction } from "@/app/actions/purchase-request-selections";
import type {
  PurchaseRequestComparisonDTO,
  PurchaseRequestComparisonItemDTO,
  PurchaseRequestComparisonResponseOptionDTO,
  PurchaseRequestSelectionItemSelectionDTO,
  PurchaseRequestSelectionSupplierGroupDTO,
} from "@/src/domain/purchase-request-selection";
import {
  formatPersianDateTime,
  formatPersianNumber,
  formatToman,
} from "@/src/lib/persian-format";

type SelectionDraft = Record<string, Record<string, string>>;
type DialogMode = "review" | "conflict" | null;

type PreviewSelection = {
  item: PurchaseRequestComparisonItemDTO;
  option: PurchaseRequestComparisonResponseOptionDTO;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  usingSnapshot: boolean;
};

type PreviewGroup = {
  supplierResponseId: string;
  supplierName: string;
  itemCount: number;
  deliveryDays: number;
  shippingCost: number;
  itemsSubtotal: number;
  total: number;
  usingSnapshot: boolean;
};

type SelectionPreview = {
  selections: PreviewSelection[];
  groups: PreviewGroup[];
  selectedItemCount: number;
  fullySelectedItemCount: number;
  partiallySelectedItemCount: number;
  unselectedItemCount: number;
  estimatedItemsTotal: number;
  shippingTotal: number;
  estimatedTotal: number;
  hasErrors: boolean;
};

function buildInitialDraft(comparison: PurchaseRequestComparisonDTO): SelectionDraft {
  const draft: SelectionDraft = {};
  for (const item of comparison.currentSelection?.items ?? []) {
    if (item.selections.length === 0) continue;
    draft[item.purchaseRequestItemId] = Object.fromEntries(
      item.selections.map((selection) => [
        selection.supplierResponseId,
        String(selection.selectedQuantity),
      ]),
    );
  }
  return draft;
}

function normalizeDraft(draft: SelectionDraft) {
  return JSON.stringify(
    Object.entries(draft)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([itemId, responses]) => [
        itemId,
        Object.entries(responses).sort(([a], [b]) => a.localeCompare(b)),
      ]),
  );
}

function deliveryLabel(days: number) {
  if (days === 0) return "امروز";
  return `${formatPersianNumber(days)} روز`;
}

function quantityLabel(value: number, unit: string) {
  return `${formatPersianNumber(value)} ${unit || "واحد"}`;
}

function safeActionError(message?: string) {
  if (
    !message ||
    /mongo|mongoose|validation failed|cast to|stack|\bat\s+\w+/i.test(message)
  ) {
    return "ذخیره انتخاب‌ها انجام نشد. لطفاً دوباره تلاش کنید.";
  }
  return message.slice(0, 300);
}

export function PurchaseRequestComparisonWorkspace({
  comparison,
  editable,
}: {
  comparison: PurchaseRequestComparisonDTO;
  editable: boolean;
}) {
  const router = useRouter();
  const initialDraft = useMemo(() => buildInitialDraft(comparison), [comparison]);
  const initialNormalized = useMemo(() => normalizeDraft(initialDraft), [initialDraft]);
  const [draft, setDraft] = useState<SelectionDraft>(initialDraft);
  const [acceptedResponses, setAcceptedResponses] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const reviewFocusRef = useRef<HTMLButtonElement>(null);

  const selectionSnapshotMap = useMemo(() => {
    const map = new Map<string, PurchaseRequestSelectionItemSelectionDTO>();
    for (const item of comparison.currentSelection?.items ?? []) {
      for (const selection of item.selections) {
        map.set(`${item.purchaseRequestItemId}:${selection.supplierResponseId}`, selection);
      }
    }
    return map;
  }, [comparison.currentSelection]);

  const snapshotGroupMap = useMemo(() => {
    return new Map<string, PurchaseRequestSelectionSupplierGroupDTO>(
      (comparison.currentSelection?.supplierGroups ?? []).map((group) => [
        group.supplierResponseId,
        group,
      ]),
    );
  }, [comparison.currentSelection]);

  const preview = useMemo(() => {
    const itemErrors: Record<string, string> = {};
    const itemTotals: Record<string, number> = {};
    const selections: PreviewSelection[] = [];

    for (const item of comparison.items) {
      const itemDraft = draft[item.purchaseRequestItemId] ?? {};
      let selectedTotal = 0;
      let itemError = "";

      for (const [responseId, rawQuantity] of Object.entries(itemDraft)) {
        const option = item.responses.find(
          (candidate) => candidate.supplierResponseId === responseId,
        );
        const quantity = Number(rawQuantity);
        if (!option) {
          itemError = "پیشنهاد انتخاب‌شده دیگر در مقایسه موجود نیست؛ نسخه جدید را بارگذاری کنید.";
          continue;
        }
        if (!rawQuantity.trim() || !Number.isSafeInteger(quantity) || quantity <= 0) {
          itemError = "مقدار انتخابی باید یک عدد صحیح بزرگ‌تر از صفر باشد.";
          continue;
        }
        if (quantity > option.confirmedQuantity) {
          itemError = `مقدار انتخابی نمی‌تواند بیشتر از ${quantityLabel(option.confirmedQuantity, item.unit)} باشد.`;
        }

        selectedTotal += quantity;
        const snapshot = selectionSnapshotMap.get(
          `${item.purchaseRequestItemId}:${responseId}`,
        );
        const usingSnapshot = Boolean(
          snapshot?.responseModifiedAfterSelection &&
            !acceptedResponses.has(responseId),
        );
        const unitPrice = usingSnapshot
          ? snapshot!.unitPrice
          : option.unitPrice ?? snapshot?.unitPrice ?? 0;
        selections.push({
          item,
          option,
          quantity,
          unitPrice,
          subtotal: quantity * unitPrice,
          usingSnapshot,
        });
      }

      if (selectedTotal > item.requestedQuantity) {
        itemError = "مجموع مقدار انتخاب‌شده نمی‌تواند بیشتر از مقدار موردنیاز باشد.";
      }
      itemTotals[item.purchaseRequestItemId] = selectedTotal;
      if (itemError) itemErrors[item.purchaseRequestItemId] = itemError;
    }

    const groupsMap = new Map<string, PreviewGroup>();
    for (const selection of selections) {
      const responseId = selection.option.supplierResponseId;
      const existing = groupsMap.get(responseId);
      const snapshotGroup = snapshotGroupMap.get(responseId);
      const useSnapshotGroup =
        selection.usingSnapshot && Boolean(snapshotGroup);
      const shippingCost = useSnapshotGroup
        ? snapshotGroup!.shippingCost
        : selection.option.shippingCost;
      const deliveryDays = useSnapshotGroup
        ? snapshotGroup!.deliveryDays
        : selection.option.deliveryDays;

      if (existing) {
        existing.itemCount += 1;
        existing.itemsSubtotal += selection.subtotal;
        existing.total = existing.itemsSubtotal + existing.shippingCost;
        existing.usingSnapshot = existing.usingSnapshot || useSnapshotGroup;
      } else {
        groupsMap.set(responseId, {
          supplierResponseId: responseId,
          supplierName: selection.option.supplierName,
          itemCount: 1,
          deliveryDays,
          shippingCost,
          itemsSubtotal: selection.subtotal,
          total: selection.subtotal + shippingCost,
          usingSnapshot: useSnapshotGroup,
        });
      }
    }

    const groups = Array.from(groupsMap.values());
    const estimatedItemsTotal = selections.reduce(
      (sum, selection) => sum + selection.subtotal,
      0,
    );
    const shippingTotal = groups.reduce(
      (sum, group) => sum + group.shippingCost,
      0,
    );
    let fullySelectedItemCount = 0;
    let partiallySelectedItemCount = 0;
    let unselectedItemCount = 0;
    for (const item of comparison.items) {
      const total = itemTotals[item.purchaseRequestItemId] ?? 0;
      if (total === item.requestedQuantity) fullySelectedItemCount += 1;
      else if (total > 0) partiallySelectedItemCount += 1;
      else unselectedItemCount += 1;
    }

    return {
      itemErrors,
      itemTotals,
      selections,
      groups,
      selectedItemCount: fullySelectedItemCount + partiallySelectedItemCount,
      fullySelectedItemCount,
      partiallySelectedItemCount,
      unselectedItemCount,
      estimatedItemsTotal,
      shippingTotal,
      estimatedTotal: estimatedItemsTotal + shippingTotal,
      hasErrors: Object.keys(itemErrors).length > 0,
    };
  }, [
    acceptedResponses,
    comparison.items,
    draft,
    selectionSnapshotMap,
    snapshotGroupMap,
  ]);

  const hasUnreviewedModifiedResponse = preview.selections.some(
    (selection) => selection.usingSnapshot,
  );
  const isDirty =
    normalizeDraft(draft) !== initialNormalized || acceptedResponses.size > 0;
  const canOpenSaveReview = editable && !preview.hasErrors && isDirty;

  function markResponseAccepted(responseId: string) {
    setAcceptedResponses((current) => {
      const next = new Set(current);
      next.add(responseId);
      return next;
    });
  }

  function toggleOption(
    item: PurchaseRequestComparisonItemDTO,
    option: PurchaseRequestComparisonResponseOptionDTO,
    checked: boolean,
  ) {
    setFeedback(null);
    setSaveError(null);
    if (checked) {
      const snapshot = selectionSnapshotMap.get(
        `${item.purchaseRequestItemId}:${option.supplierResponseId}`,
      );
      if (snapshot?.responseModifiedAfterSelection) {
        markResponseAccepted(option.supplierResponseId);
      }
    }
    setDraft((current) => {
      const itemDraft = { ...(current[item.purchaseRequestItemId] ?? {}) };
      if (!checked) {
        delete itemDraft[option.supplierResponseId];
      } else {
        const alreadySelected = Object.values(itemDraft).reduce((sum, value) => {
          const quantity = Number(value);
          return sum + (Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 0);
        }, 0);
        const remaining = Math.max(1, item.requestedQuantity - alreadySelected);
        itemDraft[option.supplierResponseId] = String(
          Math.min(option.confirmedQuantity, remaining),
        );
      }
      const next = { ...current };
      if (Object.keys(itemDraft).length === 0) delete next[item.purchaseRequestItemId];
      else next[item.purchaseRequestItemId] = itemDraft;
      return next;
    });
  }

  function updateQuantity(
    item: PurchaseRequestComparisonItemDTO,
    option: PurchaseRequestComparisonResponseOptionDTO,
    value: string,
  ) {
    setFeedback(null);
    setSaveError(null);
    setDraft((current) => ({
      ...current,
      [item.purchaseRequestItemId]: {
        ...(current[item.purchaseRequestItemId] ?? {}),
        [option.supplierResponseId]: value,
      },
    }));
    const snapshot = selectionSnapshotMap.get(
      `${item.purchaseRequestItemId}:${option.supplierResponseId}`,
    );
    if (snapshot?.responseModifiedAfterSelection) {
      markResponseAccepted(option.supplierResponseId);
    }
  }

  function openReview() {
    setSaveError(null);
    setDialog("review");
  }

  function clearSelections() {
    setFeedback(null);
    setSaveError(null);
    setDraft({});
    setAcceptedResponses(new Set());
  }

  function saveSelections() {
    if (!canOpenSaveReview || isPending || hasUnreviewedModifiedResponse) return;
    setSaveError(null);
    startTransition(async () => {
      try {
        const result = await savePurchaseRequestSelectionAction(
          {},
          {
            purchaseRequestId: comparison.purchaseRequestId,
            expectedVersion: comparison.currentSelection?.version,
            items: preview.selections.map((selection) => ({
              purchaseRequestItemId: selection.item.purchaseRequestItemId,
              supplierResponseId: selection.option.supplierResponseId,
              selectedQuantity: selection.quantity,
            })),
          },
        );
        if (result.conflict) {
          setConflictMessage(safeActionError(result.error));
          setDialog("conflict");
          return;
        }
        if (!result.ok) {
          setSaveError(safeActionError(result.error));
          return;
        }
        setDialog(null);
        setFeedback("انتخاب تأمین‌کنندگان ذخیره شد.");
        router.refresh();
      } catch {
        setSaveError("ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.");
      }
    });
  }

  return (
    <>
      <div aria-live="polite" aria-atomic="true">
        {feedback ? (
          <p className="rounded-control border border-success/25 bg-success-soft px-4 py-3 text-sm font-bold text-success">
            {feedback}
          </p>
        ) : null}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          {comparison.items.map((item, index) => {
            const selected = preview.itemTotals[item.purchaseRequestItemId] ?? 0;
            const remaining = Math.max(0, item.requestedQuantity - selected);
            const error = preview.itemErrors[item.purchaseRequestItemId];
            const quoted = item.responses.filter((response) => response.status === "quoted");
            const unavailable = item.responses.filter(
              (response) => response.status === "unavailable",
            );

            return (
              <section
                key={item.purchaseRequestItemId}
                aria-labelledby={`comparison-item-${item.purchaseRequestItemId}`}
                className="scroll-mt-24 overflow-hidden rounded-card border border-line bg-surface shadow-card"
              >
                <header className="border-b border-line bg-surface-subtle/70 p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-control bg-primary-soft text-sm font-black text-primary">
                        {formatPersianNumber(index + 1)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2
                            id={`comparison-item-${item.purchaseRequestItemId}`}
                            className="break-words text-base font-black leading-7 text-ink"
                          >
                            {item.title}
                          </h2>
                          {item.itemType === "custom" ? (
                            <span className="rounded-full bg-violet-soft px-2 py-1 text-[10px] font-black text-violet">کالای سفارشی</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs font-bold text-ink-muted">
                          نیاز: <span className="text-ink">{quantityLabel(item.requestedQuantity, item.unit)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:min-w-64">
                      <QuantityStat label="انتخاب‌شده" value={quantityLabel(selected, item.unit)} tone={selected > 0 ? "success" : "neutral"} />
                      <QuantityStat label="باقی‌مانده" value={quantityLabel(remaining, item.unit)} tone={remaining > 0 ? "warning" : "success"} />
                    </div>
                  </div>
                  <div className="mt-3 min-h-6" aria-live="polite">
                    {error ? (
                      <p role="alert" className="text-xs font-bold leading-6 text-danger">{error}</p>
                    ) : remaining > 0 && selected > 0 ? (
                      <p className="text-xs font-bold leading-6 text-warning">{quantityLabel(remaining, item.unit)} هنوز انتخاب نشده است.</p>
                    ) : selected === item.requestedQuantity ? (
                      <p className="inline-flex items-center gap-1.5 text-xs font-bold text-success"><IconCheck className="size-4" aria-hidden="true" />مقدار موردنیاز این قلم کامل انتخاب شده است.</p>
                    ) : null}
                  </div>
                </header>

                <div className="p-4 sm:p-5">
                  {quoted.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-control border border-dashed border-line bg-surface-subtle p-6 text-center">
                      <IconPackageOff className="size-8 text-ink-muted" aria-hidden="true" />
                      <h3 className="mt-3 text-sm font-black text-ink">هنوز پیشنهادی برای این کالا ثبت نشده است.</h3>
                      <p className="mt-1 text-xs leading-6 text-ink-muted">این قلم در مقایسه باقی می‌ماند و می‌توانید انتخاب‌ها را بدون آن ذخیره کنید.</p>
                    </div>
                  ) : (
                    <fieldset>
                      <legend className="sr-only">پیشنهادهای قابل انتخاب برای {item.title}</legend>
                      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                        {quoted.map((option) => (
                          <SupplierOptionCard
                            key={option.supplierResponseId}
                            item={item}
                            option={option}
                            value={draft[item.purchaseRequestItemId]?.[option.supplierResponseId]}
                            editable={editable}
                            snapshot={selectionSnapshotMap.get(`${item.purchaseRequestItemId}:${option.supplierResponseId}`)}
                            accepted={acceptedResponses.has(option.supplierResponseId)}
                            onAccept={() => markResponseAccepted(option.supplierResponseId)}
                            onToggle={(checked) => toggleOption(item, option, checked)}
                            onQuantityChange={(value) => updateQuantity(item, option, value)}
                          />
                        ))}
                      </div>
                    </fieldset>
                  )}

                  {unavailable.length > 0 ? (
                    <details className="mt-4 rounded-control border border-line bg-surface-subtle">
                      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 text-xs font-black text-ink-muted">
                        <span>{formatPersianNumber(unavailable.length)} تأمین‌کننده این قلم را قابل تأمین اعلام نکرده‌اند</span>
                        <IconChevronLeft className="size-4" aria-hidden="true" />
                      </summary>
                      <div className="grid gap-2 border-t border-line p-3 sm:grid-cols-2">
                        {unavailable.map((option) => (
                          <div key={option.supplierResponseId} className="flex items-center justify-between gap-3 rounded-control bg-surface px-3 py-2.5 text-xs">
                            <span className="font-black text-ink">{option.supplierName}</span>
                            <span className="font-bold text-ink-muted">قابل تأمین نیست</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>

        <SelectionSummary
          preview={preview}
          editable={editable}
          isDirty={isDirty}
          hasCurrentSelection={Boolean(comparison.currentSelection)}
          canReview={canOpenSaveReview}
          onReview={openReview}
          onClear={clearSelections}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 p-3 shadow-[0_-8px_30px_rgb(20_43_74_/_0.12)] backdrop-blur xl:hidden">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-black text-ink">{formatPersianNumber(preview.selectedItemCount)} قلم انتخاب شده</p>
            <p className="mt-0.5 truncate text-xs font-bold text-primary">{formatToman(preview.estimatedTotal)}</p>
          </div>
          <button type="button" onClick={openReview} disabled={preview.hasErrors} className="min-h-11 shrink-0 rounded-control bg-primary px-4 text-xs font-black text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">مرور انتخاب‌ها</button>
        </div>
      </div>

      <InternalRequestDialog
        open={dialog === "review"}
        title="مرور نهایی انتخاب‌ها"
        description="پیش از ذخیره، مقدارها، قیمت کالا و هزینه ارسال هر تأمین‌کننده را بررسی کنید."
        onClose={() => !isPending && setDialog(null)}
        busy={isPending}
        initialFocusRef={reviewFocusRef}
      >
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
          {saveError ? <p role="alert" className="mb-4 rounded-control border border-danger/25 bg-danger-soft px-4 py-3 text-xs font-bold leading-6 text-danger">{saveError}</p> : null}
          {hasUnreviewedModifiedResponse ? (
            <div className="mb-4 rounded-control border border-warning/25 bg-warning-soft p-3 text-xs font-bold leading-6 text-warning">
              برای ذخیره تغییرات، ابتدا پیشنهادهایی را که پس از انتخاب قبلی تغییر کرده‌اند بررسی و قیمت فعلی آن‌ها را تأیید کنید. نگه‌داشتن انتخاب قبلی بدون ذخیره مجدد ممکن است.
            </div>
          ) : null}
          {preview.selections.length === 0 ? (
            <div className="rounded-control border border-dashed border-line p-6 text-center">
              <h3 className="text-sm font-black text-ink">هیچ تأمین‌کننده‌ای انتخاب نشده است</h3>
              <p className="mt-1 text-xs leading-6 text-ink-muted">با ذخیره این وضعیت، انتخاب‌های فعلی حذف می‌شوند.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {preview.selections.map((selection) => (
                <div key={`${selection.item.purchaseRequestItemId}:${selection.option.supplierResponseId}`} className="grid gap-2 rounded-control border border-line p-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0"><p className="font-black text-ink">{selection.item.title}</p><p className="mt-1 text-ink-muted">{selection.option.supplierName} · {quantityLabel(selection.quantity, selection.item.unit)}</p></div>
                  <div className="sm:text-end"><p className="font-bold text-ink-muted">{formatToman(selection.unitPrice)} × {formatPersianNumber(selection.quantity)}</p><p className="mt-1 font-black text-ink">{formatToman(selection.subtotal)}</p></div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 space-y-3 border-t border-line pt-5">
            <h3 className="text-sm font-black text-ink">تفکیک تأمین‌کنندگان</h3>
            {preview.groups.map((group) => <SupplierGroupRow key={group.supplierResponseId} group={group} />)}
          </div>

          <dl className="mt-5 space-y-2 rounded-control bg-surface-subtle p-4 text-xs">
            <SummaryLine label="جمع کالاها" value={formatToman(preview.estimatedItemsTotal)} />
            <SummaryLine label="هزینه ارسال" value={formatToman(preview.shippingTotal)} />
            <SummaryLine label="جمع برآوردی" value={formatToman(preview.estimatedTotal)} strong />
          </dl>
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line p-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={() => setDialog(null)} disabled={isPending} className="min-h-11 rounded-control border border-line px-4 text-sm font-bold text-ink-muted transition hover:bg-surface-subtle disabled:opacity-50">بازگشت</button>
          {editable ? (
            <button ref={reviewFocusRef} type="button" onClick={saveSelections} disabled={!canOpenSaveReview || hasUnreviewedModifiedResponse || isPending} className="min-h-11 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">{isPending ? "در حال ذخیره…" : "ذخیره انتخاب‌ها"}</button>
          ) : null}
        </div>
      </InternalRequestDialog>

      <InternalRequestDialog
        open={dialog === "conflict"}
        title="انتخاب‌ها هم‌زمان تغییر کرده‌اند"
        description="برای جلوگیری از بازنویسی انتخاب کاربر دیگر، اطلاعات جدید را بارگذاری کنید."
        onClose={() => setDialog(null)}
        size="sm"
      >
        <div className="p-4 sm:p-6">
          <p role="alert" className="rounded-control border border-warning/25 bg-warning-soft px-4 py-3 text-sm font-bold leading-7 text-warning">{conflictMessage || "این انتخاب توسط کاربر دیگری تغییر کرده است."}</p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setDialog(null)} className="min-h-11 rounded-control border border-line px-4 text-sm font-bold text-ink-muted transition hover:bg-surface-subtle">بستن</button>
            <button type="button" onClick={() => { setDialog(null); router.refresh(); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover"><IconRefresh className="size-4" aria-hidden="true" />بارگذاری نسخه جدید</button>
          </div>
        </div>
      </InternalRequestDialog>
    </>
  );
}

function SupplierOptionCard({
  item,
  option,
  value,
  editable,
  snapshot,
  accepted,
  onAccept,
  onToggle,
  onQuantityChange,
}: {
  item: PurchaseRequestComparisonItemDTO;
  option: PurchaseRequestComparisonResponseOptionDTO;
  value?: string;
  editable: boolean;
  snapshot?: PurchaseRequestSelectionItemSelectionDTO;
  accepted: boolean;
  onAccept: () => void;
  onToggle: (checked: boolean) => void;
  onQuantityChange: (value: string) => void;
}) {
  const selected = value !== undefined;
  const modified = Boolean(snapshot?.responseModifiedAfterSelection || option.isModifiedAfterSelection);
  const currentPrice = option.unitPrice ?? 0;
  const isLowest = option.unitPrice === item.lowestUnitPrice;
  const partial = option.confirmedQuantity < item.requestedQuantity;

  return (
    <article className={`relative min-w-0 rounded-card border p-4 transition ${selected ? "border-primary bg-primary-soft/35 ring-1 ring-primary/20" : "border-line bg-surface"}`}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <IconBuildingStore className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0"><h3 className="break-words text-sm font-black leading-6 text-ink">{option.supplierName}</h3><p className="mt-0.5 text-[11px] text-ink-muted">پاسخ در {formatPersianDateTime(option.respondedAt)}</p></div>
        </div>
        {editable ? (
          <label className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-control px-1 text-xs font-black text-primary">
            <input type="checkbox" checked={selected} disabled={!option.isSelectable && !selected} onChange={(event) => onToggle(event.target.checked)} className="size-5 accent-primary" />
            {selected ? "انتخاب‌شده" : "انتخاب"}
          </label>
        ) : selected ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-[10px] font-black text-success"><IconCheck className="size-3.5" aria-hidden="true" />انتخاب فعلی</span>
        ) : null}
      </div>

      <div className="mt-4 border-y border-line py-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><p className="text-[11px] font-bold text-ink-muted">قیمت هر {item.unit || "واحد"}</p><p className="mt-1 text-xl font-black tabular-nums text-primary">{formatToman(currentPrice)}</p></div>
          {isLowest ? <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-[10px] font-black text-ink-muted">کمترین قیمت واحد</span> : null}
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
        <OptionMeta icon={<IconShoppingCartCheck className="size-4" />} label="قابل تأمین" value={`${quantityLabel(option.confirmedQuantity, item.unit)} از ${quantityLabel(item.requestedQuantity, item.unit)}`} />
        <OptionMeta icon={<IconTruckDelivery className="size-4" />} label="هزینه ارسال" value={formatToman(option.shippingCost)} />
        <OptionMeta icon={<IconClock className="size-4" />} label="زمان تحویل" value={deliveryLabel(option.deliveryDays)} />
        <OptionMeta icon={<IconCoin className="size-4" />} label="مبلغ کل این قلم" value={formatToman(currentPrice * option.confirmedQuantity)} />
      </dl>
      {partial ? <span className="mt-3 inline-flex rounded-full bg-warning-soft px-2.5 py-1 text-[10px] font-black text-warning">تأمین جزئی</span> : null}

      {modified ? (
        <div className="mt-4 rounded-control border border-warning/25 bg-warning-soft p-3 text-warning">
          <p className="flex items-start gap-2 text-xs font-black leading-6"><IconAlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />تأمین‌کننده پس از انتخاب شما، پیشنهاد خود را تغییر داده است.</p>
          {snapshot ? <dl className="mt-2 grid gap-2 text-[11px] sm:grid-cols-2"><div><dt className="font-bold">انتخاب قبلی</dt><dd className="mt-0.5 font-black">{formatToman(snapshot.unitPrice)}</dd></div><div><dt className="font-bold">پیشنهاد فعلی</dt><dd className="mt-0.5 font-black">{formatToman(currentPrice)}</dd></div></dl> : null}
          {editable && selected && !accepted ? <button type="button" onClick={onAccept} className="mt-3 min-h-10 rounded-control border border-warning/35 bg-surface px-3 text-xs font-black text-warning transition hover:bg-warning-soft">بررسی شد؛ استفاده از پیشنهاد فعلی</button> : selected && accepted ? <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-black"><IconCheck className="size-3.5" aria-hidden="true" />پیشنهاد فعلی تأیید شده است</p> : null}
        </div>
      ) : null}

      {selected ? (
        <div className="mt-4">
          <label htmlFor={`selection-${item.purchaseRequestItemId}-${option.supplierResponseId}`} className="mb-1.5 block text-xs font-black text-ink">مقدار انتخابی</label>
          {editable ? (
            <div className="flex items-center">
              <input id={`selection-${item.purchaseRequestItemId}-${option.supplierResponseId}`} type="number" inputMode="numeric" min="1" max={option.confirmedQuantity} step="1" value={value} onChange={(event) => onQuantityChange(event.target.value)} className="h-11 min-w-0 flex-1 rounded-s-control border border-line bg-surface px-3 text-center text-sm font-black tabular-nums text-ink outline-none transition focus:border-primary" />
              <span className="flex h-11 items-center rounded-e-control border border-s-0 border-line bg-surface-subtle px-3 text-xs font-bold text-ink-muted">{item.unit || "واحد"}</span>
            </div>
          ) : <p className="rounded-control bg-surface-subtle px-3 py-2.5 text-sm font-black text-ink">{quantityLabel(Number(value), item.unit)}</p>}
        </div>
      ) : null}
    </article>
  );
}

function OptionMeta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="min-w-0"><dt className="flex items-center gap-1.5 text-[11px] font-bold text-ink-muted"><span className="text-primary">{icon}</span>{label}</dt><dd className="mt-1 break-words font-black leading-5 text-ink">{value}</dd></div>;
}

function QuantityStat({ label, value, tone }: { label: string; value: string; tone: "neutral" | "success" | "warning" }) {
  const colors = tone === "success" ? "bg-success-soft text-success" : tone === "warning" ? "bg-warning-soft text-warning" : "bg-surface text-ink-muted";
  return <div className={`rounded-control px-3 py-2 ${colors}`}><p className="text-[10px] font-bold">{label}</p><p className="mt-0.5 text-xs font-black">{value}</p></div>;
}

function SelectionSummary({ preview, editable, isDirty, hasCurrentSelection, canReview, onReview, onClear }: { preview: SelectionPreview; editable: boolean; isDirty: boolean; hasCurrentSelection: boolean; canReview: boolean; onReview: () => void; onClear: () => void }) {
  return (
    <aside className="hidden space-y-4 xl:sticky xl:top-24 xl:block" aria-label="خلاصه انتخاب‌ها">
      <section className="rounded-card border border-line bg-surface p-5 shadow-card" aria-live="polite">
        <div className="flex items-center gap-2"><IconShoppingCartCheck className="size-5 text-primary" aria-hidden="true" /><h2 className="text-base font-black text-ink">خلاصه انتخاب‌ها</h2></div>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <SummaryMetric label="دارای انتخاب" value={preview.selectedItemCount} />
          <SummaryMetric label="تأمین کامل" value={preview.fullySelectedItemCount} />
          <SummaryMetric label="تأمین جزئی" value={preview.partiallySelectedItemCount} />
          <SummaryMetric label="بدون انتخاب" value={preview.unselectedItemCount} />
        </dl>
        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-xs">
          <SummaryLine label="جمع کالاها" value={formatToman(preview.estimatedItemsTotal)} />
          <SummaryLine label="ارسال" value={formatToman(preview.shippingTotal)} />
          <SummaryLine label="جمع برآوردی" value={formatToman(preview.estimatedTotal)} strong />
        </dl>
        <button type="button" onClick={onReview} disabled={preview.hasErrors} className="mt-5 min-h-11 w-full rounded-control bg-primary px-4 text-sm font-black text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">مرور انتخاب‌ها</button>
        {editable && isDirty ? <p className="mt-2 text-center text-[11px] font-bold text-warning">تغییرات هنوز ذخیره نشده‌اند.</p> : null}
        {editable && hasCurrentSelection && preview.selections.length > 0 ? <button type="button" onClick={onClear} className="mt-2 min-h-10 w-full rounded-control text-xs font-black text-danger transition hover:bg-danger-soft">حذف انتخاب‌های فعلی</button> : null}
        {editable && !canReview && isDirty && preview.hasErrors ? <p className="mt-2 text-[11px] font-bold leading-5 text-danger">برای مرور و ذخیره، خطاهای مقدار را اصلاح کنید.</p> : null}
      </section>

      {preview.groups.length > 0 ? <section className="rounded-card border border-line bg-surface p-5 shadow-card"><h2 className="text-sm font-black text-ink">تفکیک تأمین‌کنندگان</h2><div className="mt-3 space-y-3">{preview.groups.map((group) => <SupplierGroupRow key={group.supplierResponseId} group={group} />)}</div></section> : null}
    </aside>
  );
}

function SupplierGroupRow({ group }: { group: PreviewGroup }) {
  return <div className="rounded-control border border-line p-3 text-xs"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-ink">{group.supplierName}</p><p className="mt-1 text-[11px] text-ink-muted">{formatPersianNumber(group.itemCount)} قلم · تحویل {deliveryLabel(group.deliveryDays)}</p></div><p className="font-black text-primary">{formatToman(group.total)}</p></div><dl className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 text-[11px]"><div><dt className="text-ink-muted">جمع کالاها</dt><dd className="mt-1 font-black text-ink">{formatToman(group.itemsSubtotal)}</dd></div><div><dt className="text-ink-muted">ارسال، یک‌بار</dt><dd className="mt-1 font-black text-ink">{formatToman(group.shippingCost)}</dd></div></dl>{group.usingSnapshot ? <p className="mt-2 text-[10px] font-bold text-warning">بر اساس snapshot انتخاب قبلی</p> : null}</div>;
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-control bg-surface-subtle p-3"><dt className="text-[10px] font-bold text-ink-muted">{label}</dt><dd className="mt-1 text-lg font-black text-ink">{formatPersianNumber(value)}</dd></div>;
}

function SummaryLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex items-center justify-between gap-3 ${strong ? "border-t border-line pt-3 text-sm" : ""}`}><dt className={strong ? "font-black text-ink" : "text-ink-muted"}>{label}</dt><dd className={strong ? "font-black text-primary" : "font-black text-ink"}>{value}</dd></div>;
}
