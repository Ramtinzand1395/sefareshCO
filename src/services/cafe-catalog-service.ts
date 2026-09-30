import "server-only";

import {
  buyerCatalogQuerySchema,
  buyerCompareQuerySchema,
  type BuyerCompareSort,
} from "@/src/domain/schemas/cafe-catalog";
import { getCurrentCafeIdentity } from "@/src/lib/auth-helpers";
import { formatPersianNumber } from "@/src/lib/persian-format";
import {
  findBuyerCatalog,
  findProductForComparison,
  type BuyerCatalogResult,
  type BuyerOfferComparisonDTO,
  type ProductComparisonProductDTO,
} from "@/src/repositories/cafe-catalog-repository";

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

export class CafeAccessDeniedError extends Error {
  constructor(
    message = "دسترسی به کاتالوگ خریدار فقط برای اعضای فعال کافه مجاز است",
  ) {
    super(message);
    this.name = "CafeAccessDeniedError";
  }
}

export class InvalidBuyerCatalogQueryError extends Error {
  constructor(message = "پارامترهای جستجو یا صفحه‌بندی نامعتبر است") {
    super(message);
    this.name = "InvalidBuyerCatalogQueryError";
  }
}

// ---------------------------------------------------------------------------
// DTOs for Comparison Service
// ---------------------------------------------------------------------------

export type ProcessedComparisonOfferDTO = BuyerOfferComparisonDTO & {
  isFulfillable: boolean;
  unfulfillableReason?: string;
  itemTotal: number;
  isLowestPrice: boolean;
};

export type BuyerProductComparisonResult =
  | { state: "not_found_or_inactive" }
  | {
      state: "available";
      product: ProductComparisonProductDTO;
      offers: ProcessedComparisonOfferDTO[];
      quantity: number;
      sortBy: BuyerCompareSort;
      fulfillableCount: number;
      totalOffersCount: number;
    };

// ---------------------------------------------------------------------------
// Authorization Guard
// Any active user with an active membership in an active cafe can view catalog
// ---------------------------------------------------------------------------

export async function requireCafeBuyerAccess() {
  const identity = await getCurrentCafeIdentity();
  if (!identity) {
    throw new CafeAccessDeniedError();
  }
  return identity;
}

// ---------------------------------------------------------------------------
// Get Buyer Catalog List
// ---------------------------------------------------------------------------

export async function getBuyerCatalog(
  rawQuery: unknown,
): Promise<BuyerCatalogResult> {
  await requireCafeBuyerAccess();

  const parsed = buyerCatalogQuerySchema.safeParse(rawQuery ?? {});
  if (!parsed.success) {
    throw new InvalidBuyerCatalogQueryError();
  }

  return findBuyerCatalog(parsed.data);
}

// ---------------------------------------------------------------------------
// Get Buyer Product Comparison
// Evaluates quantity fulfillability, lowest price badge, and stable sorting
// ---------------------------------------------------------------------------

export async function getBuyerProductComparison(
  productId: string,
  rawQuantity?: unknown,
  rawSortBy?: unknown,
): Promise<BuyerProductComparisonResult> {
  await requireCafeBuyerAccess();

  const parsedQuery = buyerCompareQuerySchema.safeParse({
    productId,
    quantity: rawQuantity,
    sortBy: rawSortBy,
  });

  const quantity = parsedQuery.success ? parsedQuery.data.quantity : 1;
  const sortBy = parsedQuery.success ? parsedQuery.data.sortBy : "price";

  const repoResult = await findProductForComparison(productId);
  if (repoResult.state === "not_found_or_inactive") {
    return { state: "not_found_or_inactive" };
  }

  const { product, offers } = repoResult;

  if (offers.length === 0) {
    return {
      state: "available",
      product,
      offers: [],
      quantity,
      sortBy,
      fulfillableCount: 0,
      totalOffersCount: 0,
    };
  }

  // Evaluate fulfillability and compute item total for each offer
  const processed: Array<
    BuyerOfferComparisonDTO & {
      isFulfillable: boolean;
      unfulfillableReason?: string;
      itemTotal: number;
    }
  > = offers.map((offer) => {
    const isFulfillable =
      offer.minOrderQuantity <= quantity && quantity <= offer.stock;

    let unfulfillableReason: string | undefined;
    if (!isFulfillable) {
      if (quantity < offer.minOrderQuantity) {
        unfulfillableReason = `حداقل سفارش این تأمین‌کننده ${formatPersianNumber(offer.minOrderQuantity)} ${offer.productUnit} است.`;
      } else if (quantity > offer.stock) {
        unfulfillableReason = `موجودی فعلی این تأمین‌کننده (${formatPersianNumber(offer.stock)} ${offer.productUnit}) کمتر از مقدار انتخابی است.`;
      }
    }

    const calculatedTotal = quantity * offer.price;
    const safeTotal = Number.isSafeInteger(calculatedTotal)
      ? calculatedTotal
      : Number.MAX_SAFE_INTEGER;

    return {
      ...offer,
      isFulfillable,
      unfulfillableReason,
      itemTotal: safeTotal,
    };
  });

  // Partition into fulfillable and unfulfillable
  const fulfillable = processed.filter((o) => o.isFulfillable);
  const unfulfillable = processed.filter((o) => !o.isFulfillable);

  // Lowest price badge applies ONLY among fulfillable offers
  let minFulfillablePrice: number | null = null;
  if (fulfillable.length > 0) {
    minFulfillablePrice = Math.min(...fulfillable.map((o) => o.price));
  }

  // Stable sorter
  const sortComparator = (
    a: (typeof processed)[number],
    b: (typeof processed)[number],
  ) => {
    if (sortBy === "deliveryDays") {
      if (a.deliveryDays !== b.deliveryDays) {
        return a.deliveryDays - b.deliveryDays;
      }
      if (a.price !== b.price) {
        return a.price - b.price;
      }
    } else {
      // Default: price
      if (a.price !== b.price) {
        return a.price - b.price;
      }
      if (a.deliveryDays !== b.deliveryDays) {
        return a.deliveryDays - b.deliveryDays;
      }
    }
    // Stable tie-breaker: offerId
    return a.offerId.localeCompare(b.offerId);
  };

  fulfillable.sort(sortComparator);
  unfulfillable.sort(sortComparator);

  const finalOffers: ProcessedComparisonOfferDTO[] = [
    ...fulfillable.map((o) => ({
      ...o,
      isLowestPrice: minFulfillablePrice !== null && o.price === minFulfillablePrice,
    })),
    ...unfulfillable.map((o) => ({
      ...o,
      isLowestPrice: false,
    })),
  ];

  return {
    state: "available",
    product,
    offers: finalOffers,
    quantity,
    sortBy,
    fulfillableCount: fulfillable.length,
    totalOffersCount: offers.length,
  };
}
