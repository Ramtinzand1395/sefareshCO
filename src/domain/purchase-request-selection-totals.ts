export class PurchaseRequestSelectionCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseRequestSelectionCalculationError";
  }
}

export class PurchaseRequestSelectionInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseRequestSelectionInvariantError";
  }
}

export class PurchaseRequestSelectionConflictError extends Error {
  constructor(
    message = "این انتخاب قبلاً توسط کاربر دیگری به‌روزرسانی شده است؛ لطفاً صفحه را بارگذاری مجدد کرده و دوباره تلاش کنید",
  ) {
    super(message);
    this.name = "PurchaseRequestSelectionConflictError";
  }
}

export type SelectionItemCalculationInput = {
  purchaseRequestItemId: string;
  supplierRequestId: string;
  supplierResponseId: string;
  supplierId: string;
  supplierName: string;
  selectedQuantity: number;
  unitPrice: number;
  deliveryDays: number;
  shippingCost: number;
  supplierResponseUpdatedAt: Date;
};

export type CalculatedSelectionItem = {
  purchaseRequestItemId: string;
  supplierRequestId: string;
  supplierResponseId: string;
  supplierId: string;
  supplierName: string;
  selectedQuantity: number;
  unitPrice: number;
  itemSubtotal: number;
  supplierResponseUpdatedAt: Date;
};

export type CalculatedSupplierGroup = {
  supplierId: string;
  supplierName: string;
  supplierResponseId: string;
  deliveryDays: number;
  shippingCost: number;
  itemsSubtotal: number;
  supplierTotal: number;
};

export type CalculatedSelectionTotals = {
  selectedItemCount: number;
  fullySelectedItemCount: number;
  partiallySelectedItemCount: number;
  unselectedItemCount: number;
  estimatedItemsTotal: number;
  shippingTotal: number;
  estimatedTotal: number;
};

export type SelectionCalculationResult = {
  items: CalculatedSelectionItem[];
  supplierGroups: CalculatedSupplierGroup[];
  totals: CalculatedSelectionTotals;
};

/**
 * Pure domain helper for calculating selection totals, grouping suppliers,
 * and enforcing safe integer pricing and shipping deduplication policies.
 *
 * Shipping policy:
 * If at least one item is selected from a SupplierResponse, that response's
 * shippingCost is included exactly once in the estimated selection total.
 */
export function calculateSelectionTotalsAndGroups(
  inputs: SelectionItemCalculationInput[],
  totalRfqItemCount: number,
  fullySelectedCount: number,
  partiallySelectedCount: number,
): SelectionCalculationResult {
  if (inputs.length === 0) {
    return {
      items: [],
      supplierGroups: [],
      totals: {
        selectedItemCount: 0,
        fullySelectedItemCount: 0,
        partiallySelectedItemCount: 0,
        unselectedItemCount: totalRfqItemCount,
        estimatedItemsTotal: 0,
        shippingTotal: 0,
        estimatedTotal: 0,
      },
    };
  }

  let calculatedItemsTotal = 0;
  const calculatedItems: CalculatedSelectionItem[] = [];

  // Map to group items by supplierResponseId for shipping deduplication
  const groupMap = new Map<
    string,
    {
      supplierId: string;
      supplierName: string;
      supplierResponseId: string;
      deliveryDays: number;
      shippingCost: number;
      itemsSubtotal: number;
    }
  >();

  for (const item of inputs) {
    // 1. Validate selectedQuantity
    if (
      typeof item.selectedQuantity !== "number" ||
      !Number.isInteger(item.selectedQuantity)
    ) {
      throw new PurchaseRequestSelectionCalculationError(
        "تعداد انتخابی باید عدد صحیح باشد",
      );
    }
    if (item.selectedQuantity <= 0) {
      throw new PurchaseRequestSelectionCalculationError(
        "تعداد انتخابی باید عددی مثبت و بزرگ‌تر از صفر باشد",
      );
    }
    if (!Number.isSafeInteger(item.selectedQuantity)) {
      throw new PurchaseRequestSelectionCalculationError(
        "تعداد انتخابی خارج از محدوده اعداد مجاز است",
      );
    }

    // 2. Validate unitPrice
    if (
      typeof item.unitPrice !== "number" ||
      !Number.isInteger(item.unitPrice)
    ) {
      throw new PurchaseRequestSelectionCalculationError(
        "قیمت واحد باید عدد صحیح به تومان باشد",
      );
    }
    if (item.unitPrice <= 0) {
      throw new PurchaseRequestSelectionCalculationError(
        "قیمت واحد باید عددی مثبت و بزرگ‌تر از صفر باشد",
      );
    }
    if (!Number.isSafeInteger(item.unitPrice)) {
      throw new PurchaseRequestSelectionCalculationError(
        "قیمت واحد خارج از محدوده اعداد مجاز است",
      );
    }

    // 3. Compute item subtotal
    const itemSubtotal = item.selectedQuantity * item.unitPrice;
    if (
      !Number.isSafeInteger(itemSubtotal) ||
      itemSubtotal > Number.MAX_SAFE_INTEGER
    ) {
      throw new PurchaseRequestSelectionCalculationError(
        "مجموع مبلغ قلم از سقف مجاز محاسبات سیستم بیشتر شده است",
      );
    }

    calculatedItemsTotal += itemSubtotal;
    if (
      !Number.isSafeInteger(calculatedItemsTotal) ||
      calculatedItemsTotal > Number.MAX_SAFE_INTEGER
    ) {
      throw new PurchaseRequestSelectionCalculationError(
        "مجموع مبلغ کل اقلام از سقف مجاز محاسبات سیستم بیشتر شده است",
      );
    }

    calculatedItems.push({
      purchaseRequestItemId: item.purchaseRequestItemId,
      supplierRequestId: item.supplierRequestId,
      supplierResponseId: item.supplierResponseId,
      supplierId: item.supplierId,
      supplierName: item.supplierName,
      selectedQuantity: item.selectedQuantity,
      unitPrice: item.unitPrice,
      itemSubtotal,
      supplierResponseUpdatedAt: item.supplierResponseUpdatedAt,
    });

    // 4. Validate shippingCost and deliveryDays for the group
    if (
      typeof item.shippingCost !== "number" ||
      !Number.isInteger(item.shippingCost) ||
      item.shippingCost < 0 ||
      !Number.isSafeInteger(item.shippingCost)
    ) {
      throw new PurchaseRequestSelectionCalculationError(
        "هزینه ارسال تأمین‌کننده نامعتبر است",
      );
    }

    if (
      typeof item.deliveryDays !== "number" ||
      !Number.isInteger(item.deliveryDays) ||
      item.deliveryDays < 0
    ) {
      throw new PurchaseRequestSelectionCalculationError(
        "زمان تحویل تأمین‌کننده نامعتبر است",
      );
    }

    // 5. Aggregate into response group
    const existingGroup = groupMap.get(item.supplierResponseId);
    if (existingGroup) {
      const newSubtotal = existingGroup.itemsSubtotal + itemSubtotal;
      if (
        !Number.isSafeInteger(newSubtotal) ||
        newSubtotal > Number.MAX_SAFE_INTEGER
      ) {
        throw new PurchaseRequestSelectionCalculationError(
          "مجموع اقلام تأمین‌کننده از سقف مجاز عبور کرده است",
        );
      }
      existingGroup.itemsSubtotal = newSubtotal;
    } else {
      groupMap.set(item.supplierResponseId, {
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        supplierResponseId: item.supplierResponseId,
        deliveryDays: item.deliveryDays,
        shippingCost: item.shippingCost,
        itemsSubtotal: itemSubtotal,
      });
    }
  }

  // 6. Deduplicate shippingCost across groups: exactly once per SupplierResponse
  let calculatedShippingTotal = 0;
  const supplierGroups: CalculatedSupplierGroup[] = [];

  for (const group of groupMap.values()) {
    calculatedShippingTotal += group.shippingCost;
    if (
      !Number.isSafeInteger(calculatedShippingTotal) ||
      calculatedShippingTotal > Number.MAX_SAFE_INTEGER
    ) {
      throw new PurchaseRequestSelectionCalculationError(
        "مجموع هزینه ارسال از سقف مجاز سیستم بیشتر شده است",
      );
    }

    const supplierTotal = group.itemsSubtotal + group.shippingCost;
    if (
      !Number.isSafeInteger(supplierTotal) ||
      supplierTotal > Number.MAX_SAFE_INTEGER
    ) {
      throw new PurchaseRequestSelectionCalculationError(
        "مجموع مبلغ تأمین‌کننده از سقف مجاز سیستم بیشتر شده است",
      );
    }

    supplierGroups.push({
      supplierId: group.supplierId,
      supplierName: group.supplierName,
      supplierResponseId: group.supplierResponseId,
      deliveryDays: group.deliveryDays,
      shippingCost: group.shippingCost,
      itemsSubtotal: group.itemsSubtotal,
      supplierTotal,
    });
  }

  const estimatedTotal = calculatedItemsTotal + calculatedShippingTotal;
  if (
    !Number.isSafeInteger(estimatedTotal) ||
    estimatedTotal > Number.MAX_SAFE_INTEGER
  ) {
    throw new PurchaseRequestSelectionCalculationError(
      "مبلغ کل برآوردشده از سقف مجاز سیستم بیشتر شده است",
    );
  }

  const selectedItemCount = fullySelectedCount + partiallySelectedCount;
  const unselectedItemCount = Math.max(0, totalRfqItemCount - selectedItemCount);

  return {
    items: calculatedItems,
    supplierGroups,
    totals: {
      selectedItemCount,
      fullySelectedItemCount: fullySelectedCount,
      partiallySelectedItemCount: partiallySelectedCount,
      unselectedItemCount,
      estimatedItemsTotal: calculatedItemsTotal,
      shippingTotal: calculatedShippingTotal,
      estimatedTotal,
    },
  };
}
