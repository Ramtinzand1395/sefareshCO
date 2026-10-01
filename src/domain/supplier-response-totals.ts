export class SupplierResponseCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupplierResponseCalculationError";
  }
}

export type ItemPriceCalculationInput = {
  purchaseRequestItemId: string;
  status: "quoted" | "unavailable";
  unitPrice?: number | null;
  confirmedQuantity?: number | null;
};

export type ItemPriceCalculationResult = {
  purchaseRequestItemId: string;
  status: "quoted" | "unavailable";
  unitPrice?: number;
  confirmedQuantity: number;
  itemSubtotal: number;
};

export type SupplierResponseCalculationResult = {
  items: ItemPriceCalculationResult[];
  itemSubtotal: number;
  shippingCost: number;
  estimatedTotal: number;
};

/**
 * Pure domain helper for authoritative calculation of Supplier Response totals.
 * Enforces safe integer Toman constraints, rejects floats and unsafe numbers,
 * prevents arithmetic overflow beyond Number.MAX_SAFE_INTEGER, and enforces
 * status-specific pricing invariants.
 */
export function calculateSupplierResponseTotals(
  items: ItemPriceCalculationInput[],
  shippingCost: number,
): SupplierResponseCalculationResult {
  // Validate shippingCost
  if (typeof shippingCost !== "number" || !Number.isInteger(shippingCost)) {
    throw new SupplierResponseCalculationError(
      "هزینه ارسال باید عدد صحیح به تومان باشد",
    );
  }
  if (shippingCost < 0) {
    throw new SupplierResponseCalculationError("هزینه ارسال نمی‌تواند منفی باشد");
  }
  if (!Number.isSafeInteger(shippingCost)) {
    throw new SupplierResponseCalculationError(
      "هزینه ارسال خارج از محدوده مجاز سیستم است",
    );
  }

  let calculatedItemSubtotal = 0;
  const calculatedItems: ItemPriceCalculationResult[] = [];

  for (const item of items) {
    if (item.status === "quoted") {
      if (
        item.unitPrice === undefined ||
        item.unitPrice === null ||
        typeof item.unitPrice !== "number" ||
        !Number.isInteger(item.unitPrice)
      ) {
        throw new SupplierResponseCalculationError(
          "قیمت واحد برای قلم قیمت‌گذاری‌شده الزامی و باید عدد صحیح به تومان باشد",
        );
      }
      if (item.unitPrice <= 0) {
        throw new SupplierResponseCalculationError(
          "قیمت واحد باید عددی مثبت و بزرگ‌تر از صفر باشد",
        );
      }
      if (!Number.isSafeInteger(item.unitPrice)) {
        throw new SupplierResponseCalculationError(
          "قیمت واحد خارج از محدوده اعداد مجاز سیستم است",
        );
      }

      if (
        item.confirmedQuantity === undefined ||
        item.confirmedQuantity === null ||
        typeof item.confirmedQuantity !== "number" ||
        !Number.isInteger(item.confirmedQuantity)
      ) {
        throw new SupplierResponseCalculationError(
          "تعداد تأییدشده الزامی و باید عدد صحیح باشد",
        );
      }
      if (item.confirmedQuantity <= 0) {
        throw new SupplierResponseCalculationError(
          "تعداد تأییدشده باید عددی مثبت و حداقل ۱ باشد",
        );
      }
      if (!Number.isSafeInteger(item.confirmedQuantity)) {
        throw new SupplierResponseCalculationError(
          "تعداد تأییدشده خارج از محدوده اعداد مجاز سیستم است",
        );
      }

      const itemTotal = item.unitPrice * item.confirmedQuantity;
      if (
        !Number.isSafeInteger(itemTotal) ||
        itemTotal > Number.MAX_SAFE_INTEGER
      ) {
        throw new SupplierResponseCalculationError(
          "مجموع قیمت قلم از سقف مجاز سیستم بیشتر شده است",
        );
      }

      calculatedItemSubtotal += itemTotal;
      if (
        !Number.isSafeInteger(calculatedItemSubtotal) ||
        calculatedItemSubtotal > Number.MAX_SAFE_INTEGER
      ) {
        throw new SupplierResponseCalculationError(
          "مجموع اقلام از سقف مجاز سیستم بیشتر شده است",
        );
      }

      calculatedItems.push({
        purchaseRequestItemId: item.purchaseRequestItemId,
        status: "quoted",
        unitPrice: item.unitPrice,
        confirmedQuantity: item.confirmedQuantity,
        itemSubtotal: itemTotal,
      });
    } else if (item.status === "unavailable") {
      if (item.unitPrice !== undefined && item.unitPrice !== null) {
        throw new SupplierResponseCalculationError(
          "برای قلم ناموجود نباید قیمت واحد ثبت شود",
        );
      }

      if (
        item.confirmedQuantity !== undefined &&
        item.confirmedQuantity !== null &&
        item.confirmedQuantity !== 0
      ) {
        throw new SupplierResponseCalculationError(
          "برای قلم ناموجود، تعداد تأییدشده باید صفر یا خالی باشد",
        );
      }

      calculatedItems.push({
        purchaseRequestItemId: item.purchaseRequestItemId,
        status: "unavailable",
        unitPrice: undefined,
        confirmedQuantity: 0,
        itemSubtotal: 0,
      });
    } else {
      throw new SupplierResponseCalculationError(
        `وضعیت قلم "${item.status as string}" معتبر نیست`,
      );
    }
  }

  const estimatedTotal = calculatedItemSubtotal + shippingCost;
  if (
    !Number.isSafeInteger(estimatedTotal) ||
    estimatedTotal > Number.MAX_SAFE_INTEGER
  ) {
    throw new SupplierResponseCalculationError(
      "مبلغ کل برآوردشده از سقف مجاز سیستم بیشتر شده است",
    );
  }

  return {
    items: calculatedItems,
    itemSubtotal: calculatedItemSubtotal,
    shippingCost,
    estimatedTotal,
  };
}
