import "server-only";

import { randomUUID } from "crypto";
import { Types } from "mongoose";

import { Category } from "@/model/category";
import { Product } from "@/model/product";
import {
  canCancelPurchaseRequest,
  canCreatePurchaseRequest,
  canViewPurchaseRequests,
} from "@/src/domain/cafe-access";
import {
  cancelPurchaseRequestSchema,
  createPurchaseRequestSchema,
  purchaseRequestQuerySchema,
  submitPurchaseRequestSchema,
  type CancelPurchaseRequestInput,
  type CreatePurchaseRequestInput,
  type PurchaseRequestQueryInput,
  type SubmitPurchaseRequestInput,
} from "@/src/domain/schemas/purchase-request";
import type {
  PurchaseRequestDetailDTO,
  PurchaseRequestListResult,
  PurchaseRequestProductSnapshot,
  ShoppingListAggregateAvailabilityDTO,
  ShoppingListAvailabilityDTO,
  ShoppingListItemAvailabilityDTO,
} from "@/src/domain/purchase-request";
import { getCurrentCafeIdentity } from "@/src/lib/auth-helpers";
import {
  acquireShoppingListLock,
  cancelPurchaseRequestInRepo,
  createPurchaseRequest as repoCreatePurchaseRequest,
  findPurchaseRequestById as repoFindPurchaseRequestById,
  findPurchaseRequestByIdempotencyKey,
  getShoppingListAllocations,
  listPurchaseRequestsByCafe,
  releaseShoppingListLock,
  submitPurchaseRequestInRepo,
} from "@/src/repositories/purchase-request-repository";
import { findActiveShoppingListByCafe } from "@/src/repositories/shopping-list-repository";

// ---------------------------------------------------------------------------
// Domain Errors
// ---------------------------------------------------------------------------

export class PurchaseRequestAuthError extends Error {
  constructor(message = "دسترسی به اطلاعات کافه ممکن نیست؛ لطفاً وارد شوید") {
    super(message);
    this.name = "PurchaseRequestAuthError";
  }
}

export class PurchaseRequestPermissionError extends Error {
  constructor(message = "شما دسترسی لازم برای مدیریت استعلام‌های قیمت را ندارید") {
    super(message);
    this.name = "PurchaseRequestPermissionError";
  }
}

export class PurchaseRequestNotFoundError extends Error {
  constructor(message = "استعلام قیمت مورد نظر یافت نشد") {
    super(message);
    this.name = "PurchaseRequestNotFoundError";
  }
}

export class PurchaseRequestValidationError extends Error {
  constructor(message = "اطلاعات ورودی استعلام قیمت معتبر نیست") {
    super(message);
    this.name = "PurchaseRequestValidationError";
  }
}

export class PurchaseRequestConcurrencyError extends Error {
  constructor(
    message = "یک عملیات دیگر در حال پردازش روی لیست خرید است؛ لطفاً مجدداً تلاش کنید",
  ) {
    super(message);
    this.name = "PurchaseRequestConcurrencyError";
  }
}

export class PurchaseRequestOverAllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseRequestOverAllocationError";
  }
}

// ---------------------------------------------------------------------------
// Guard: Session-based Cafe Member Access
// ---------------------------------------------------------------------------

export async function requireCafeMemberAccess() {
  const identity = await getCurrentCafeIdentity();
  if (!identity) {
    throw new PurchaseRequestAuthError();
  }
  return identity;
}

// ---------------------------------------------------------------------------
// 1. Create Purchase Request / RFQ from Active Shopping List
// ---------------------------------------------------------------------------

export async function createPurchaseRequest(
  rawInput: unknown,
): Promise<PurchaseRequestDetailDTO> {
  const identity = await requireCafeMemberAccess();

  if (!canCreatePurchaseRequest(identity)) {
    throw new PurchaseRequestPermissionError(
      "شما دسترسی لازم برای ایجاد استعلام قیمت در بازارگاه را ندارید",
    );
  }

  const parsed = createPurchaseRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    throw new PurchaseRequestValidationError(
      firstIssue || "داده‌های ورودی استعلام قیمت نامعتبر است",
    );
  }

  const input: CreatePurchaseRequestInput = parsed.data;

  // 1. Fast idempotency check
  if (input.idempotencyKey) {
    const existing = await findPurchaseRequestByIdempotencyKey(
      identity.cafeId,
      input.idempotencyKey,
    );
    if (existing) {
      return existing;
    }
  }

  // 2. Concurrency Lock on active Shopping List
  const lockId = randomUUID();
  let locked = await acquireShoppingListLock(identity.cafeId, lockId);
  if (!locked) {
    // Brief backoff retry
    await new Promise((res) => setTimeout(res, 100));
    locked = await acquireShoppingListLock(identity.cafeId, lockId);
    if (!locked) {
      throw new PurchaseRequestConcurrencyError();
    }
  }

  try {
    // 3. Re-check idempotency key after lock acquisition
    if (input.idempotencyKey) {
      const existingAfterLock = await findPurchaseRequestByIdempotencyKey(
        identity.cafeId,
        input.idempotencyKey,
      );
      if (existingAfterLock) {
        return existingAfterLock;
      }
    }

    // 4. Fetch Active Shopping List for current cafe
    const shoppingList = await findActiveShoppingListByCafe(identity.cafeId);
    if (!shoppingList || shoppingList.items.length === 0) {
      throw new PurchaseRequestValidationError(
        "لیست خرید فعال کافه خالی است یا وجود ندارد",
      );
    }

    // 5. Query Active Allocations across existing draft & submitted RFQs
    const allocationsMap = await getShoppingListAllocations(identity.cafeId);

    // Track dynamic in-memory available quantities for this transaction
    const availableByItemId = new Map<string, number>();
    for (const item of shoppingList.items) {
      const allocated = allocationsMap.get(item.id) || 0;
      const available = Math.max(0, item.quantity - allocated);
      availableByItemId.set(item.id, available);
    }

    // Map of raw items for quick lookup
    const rawItemsMap = new Map(shoppingList.items.map((i) => [i.id, i]));

    // Map of aggregate groups for quick lookup
    const aggregateMap = new Map(
      shoppingList.aggregatedItems.map((a) => [a.key, a]),
    );

    // Prepared RFQ Items
    const preparedRfqItems: Array<{
      itemType: "catalog" | "custom";
      productId?: string;
      productSnapshot?: PurchaseRequestProductSnapshot;
      customTitle?: string;
      customUnit?: string;
      quantity: number;
      note?: string;
      allocations: Array<{
        shoppingListItemId: string;
        quantity: number;
      }>;
    }> = [];

    // 6. Process and validate selections
    for (const selection of input.items) {
      if (selection.shoppingListItemId) {
        const rawItem = rawItemsMap.get(selection.shoppingListItemId);
        if (!rawItem) {
          throw new PurchaseRequestValidationError(
            `قلم با شناسه "${selection.shoppingListItemId}" در لیست خرید فعال کافه یافت نشد`,
          );
        }

        const currentAvailable =
          availableByItemId.get(rawItem.id) ?? 0;

        if (currentAvailable <= 0) {
          const title =
            rawItem.productName || rawItem.customTitle || rawItem.id;
          throw new PurchaseRequestOverAllocationError(
            `موجودی قلم "${title}" در لیست خرید قبلاً به استعلام‌های دیگر تخصیص یافته و تکمیل شده است`,
          );
        }

        const requestedQty = selection.quantity ?? currentAvailable;
        if (requestedQty > currentAvailable) {
          const title =
            rawItem.productName || rawItem.customTitle || rawItem.id;
          throw new PurchaseRequestOverAllocationError(
            `تعداد درخواستی (${requestedQty}) برای قلم "${title}" بیشتر از مقدار قابل تخصیص در لیست خرید (${currentAvailable}) است`,
          );
        }

        // Deduct from in-memory pool
        availableByItemId.set(rawItem.id, currentAvailable - requestedQty);

        preparedRfqItems.push({
          itemType: rawItem.itemType,
          productId: rawItem.productId,
          customTitle: rawItem.customTitle,
          customUnit: rawItem.customUnit,
          quantity: requestedQty,
          note: selection.note || rawItem.note,
          allocations: [
            {
              shoppingListItemId: rawItem.id,
              quantity: requestedQty,
            },
          ],
        });
      } else if (selection.aggregateKey) {
        const aggGroup = aggregateMap.get(selection.aggregateKey);
        if (!aggGroup) {
          throw new PurchaseRequestValidationError(
            `قلم تجمیعی با کلید "${selection.aggregateKey}" در لیست خرید فعال کافه یافت نشد`,
          );
        }

        // Compute total current available for this aggregate group
        let totalAggAvailable = 0;
        for (const line of aggGroup.items) {
          totalAggAvailable += availableByItemId.get(line.id) ?? 0;
        }

        const title =
          aggGroup.productName || aggGroup.customTitle || selection.aggregateKey;

        if (totalAggAvailable <= 0) {
          throw new PurchaseRequestOverAllocationError(
            `موجودی قلم تجمیعی "${title}" در لیست خرید تکمیل شده و قبلاً تخصیص یافته است`,
          );
        }

        const requestedQty = selection.quantity ?? totalAggAvailable;
        if (requestedQty > totalAggAvailable) {
          throw new PurchaseRequestOverAllocationError(
            `تعداد درخواستی (${requestedQty}) برای قلم تجمیعی "${title}" بیشتر از مقدار قابل تخصیص (${totalAggAvailable}) است`,
          );
        }

        // Allocate across source lines (FIFO by creation order)
        let remainingToAllocate = requestedQty;
        const itemAllocations: Array<{
          shoppingListItemId: string;
          quantity: number;
        }> = [];

        for (const line of aggGroup.items) {
          if (remainingToAllocate <= 0) break;
          const lineAvail = availableByItemId.get(line.id) ?? 0;
          if (lineAvail <= 0) continue;

          const take = Math.min(remainingToAllocate, lineAvail);
          itemAllocations.push({
            shoppingListItemId: line.id,
            quantity: take,
          });

          availableByItemId.set(line.id, lineAvail - take);
          remainingToAllocate -= take;
        }

        preparedRfqItems.push({
          itemType: aggGroup.itemType,
          productId: aggGroup.productId,
          customTitle: aggGroup.customTitle,
          customUnit: aggGroup.customUnit,
          quantity: requestedQty,
          note: selection.note,
          allocations: itemAllocations,
        });
      }
    }

    if (preparedRfqItems.length === 0) {
      throw new PurchaseRequestValidationError(
        "هیچ قلم معتبری برای ثبت استعلام قیمت یافت نشد",
      );
    }

    // 7. Generate Product Snapshots for Catalog Items
    // Preserves historical integrity: snapshot product name, unit, category, brand.
    // DOES NOT snapshot supplier prices or commercial supplier data.
    const catalogProductIds = preparedRfqItems
      .filter((i) => i.itemType === "catalog" && i.productId)
      .map((i) => new Types.ObjectId(i.productId));

    if (catalogProductIds.length > 0) {
      const activeProducts = (await Product.find({
        _id: { $in: catalogProductIds },
        status: "active",
        deletedAt: null,
      })
        .select("name unit brand categoryId")
        .lean()) as Array<{
        _id: Types.ObjectId;
        name: string;
        unit: string;
        brand?: string | null;
        categoryId?: Types.ObjectId | null;
      }>;

      const productMap = new Map(
        activeProducts.map((p) => [p._id.toString(), p]),
      );

      // Hydrate category names if any
      const categoryIds = activeProducts
        .map((p) => p.categoryId)
        .filter((cid): cid is Types.ObjectId => Boolean(cid));

      const categoryMap = new Map<string, string>();
      if (categoryIds.length > 0) {
        const categories = (await Category.find({ _id: { $in: categoryIds } })
          .select("name")
          .lean()) as Array<{ _id: Types.ObjectId; name: string }>;
        for (const c of categories) {
          categoryMap.set(c._id.toString(), c.name);
        }
      }

      for (const item of preparedRfqItems) {
        if (item.itemType === "catalog" && item.productId) {
          const product = productMap.get(item.productId);
          if (!product) {
            throw new PurchaseRequestValidationError(
              `کالای انتخابی با شناسه "${item.productId}" در کاتالوگ فعال نیست یا حذف شده است`,
            );
          }

          const catName = product.categoryId
            ? categoryMap.get(product.categoryId.toString())
            : undefined;

          item.productSnapshot = {
            name: product.name,
            unit: product.unit,
            brand: product.brand || undefined,
            categoryName: catName,
          };
        }
      }
    }

    // 8. Persist PurchaseRequest via Repository
    const created = await repoCreatePurchaseRequest({
      cafeId: identity.cafeId,
      createdByUserId: identity.userId,
      title: input.title,
      note: input.note,
      neededByDate: input.neededByDate ? new Date(input.neededByDate) : null,
      status: input.submitImmediately ? "submitted" : "draft",
      idempotencyKey: input.idempotencyKey,
      items: preparedRfqItems,
    });

    return created;
  } finally {
    await releaseShoppingListLock(identity.cafeId, lockId);
  }
}

// ---------------------------------------------------------------------------
// 2. Submit Purchase Request (Draft -> Submitted)
// ---------------------------------------------------------------------------

export async function submitPurchaseRequest(
  rawInput: unknown,
): Promise<PurchaseRequestDetailDTO> {
  const identity = await requireCafeMemberAccess();

  if (!canCreatePurchaseRequest(identity)) {
    throw new PurchaseRequestPermissionError(
      "شما دسترسی لازم برای ارسال استعلام قیمت را ندارید",
    );
  }

  const parsed = submitPurchaseRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    throw new PurchaseRequestValidationError(
      firstIssue || "شناسه استعلام قیمت نامعتبر است",
    );
  }

  const input: SubmitPurchaseRequestInput = parsed.data;

  return submitPurchaseRequestInRepo(identity.cafeId, input.requestId);
}

// ---------------------------------------------------------------------------
// 3. Cancel Purchase Request (Draft / Submitted -> Cancelled)
// Releases allocations immediately back to the Shopping List
// ---------------------------------------------------------------------------

export async function cancelPurchaseRequest(
  rawInput: unknown,
): Promise<PurchaseRequestDetailDTO> {
  const identity = await requireCafeMemberAccess();

  const parsed = cancelPurchaseRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    throw new PurchaseRequestValidationError(
      firstIssue || "اطلاعات ارسالی برای لغو استعلام قیمت معتبر نیست",
    );
  }

  const input: CancelPurchaseRequestInput = parsed.data;

  // Tenant-isolated lookup to verify ownership/permission
  const existing = await repoFindPurchaseRequestById(
    identity.cafeId,
    input.requestId,
  );
  if (!existing) {
    throw new PurchaseRequestNotFoundError();
  }

  if (
    !canCancelPurchaseRequest(identity, {
      createdByUserId: existing.createdByUserId,
      status: existing.status,
    })
  ) {
    throw new PurchaseRequestPermissionError(
      "شما دسترسی لازم برای لغو این استعلام قیمت را ندارید",
    );
  }

  return cancelPurchaseRequestInRepo({
    cafeId: identity.cafeId,
    requestId: input.requestId,
    cancelledByUserId: identity.userId,
    reason: input.reason,
  });
}

// ---------------------------------------------------------------------------
// 4. Get Purchase Request Details by ID or Reference Number (Cafe-Scoped)
// ---------------------------------------------------------------------------

export async function getPurchaseRequestById(
  idOrRef: string,
): Promise<PurchaseRequestDetailDTO> {
  const identity = await requireCafeMemberAccess();

  if (!canViewPurchaseRequests(identity)) {
    throw new PurchaseRequestPermissionError(
      "شما دسترسی لازم برای مشاهده استعلام‌های قیمت کافه را ندارید",
    );
  }

  if (!idOrRef || typeof idOrRef !== "string") {
    throw new PurchaseRequestValidationError(
      "شناسه یا شماره پیگیری استعلام قیمت الزامی است",
    );
  }

  const request = await repoFindPurchaseRequestById(
    identity.cafeId,
    idOrRef.trim(),
  );

  if (!request) {
    throw new PurchaseRequestNotFoundError();
  }

  return request;
}

// ---------------------------------------------------------------------------
// 5. List Purchase Requests for Current Cafe (Paginated)
// ---------------------------------------------------------------------------

export async function listPurchaseRequests(
  rawQuery: unknown,
): Promise<PurchaseRequestListResult> {
  const identity = await requireCafeMemberAccess();

  if (!canViewPurchaseRequests(identity)) {
    throw new PurchaseRequestPermissionError(
      "شما دسترسی لازم برای مشاهده لیست استعلام‌های قیمت کافه را ندارید",
    );
  }

  const parsed = purchaseRequestQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    throw new PurchaseRequestValidationError(
      firstIssue || "پارامترهای جستجوی استعلام قیمت معتبر نیست",
    );
  }

  const query: PurchaseRequestQueryInput = parsed.data;

  return listPurchaseRequestsByCafe(identity.cafeId, {
    page: query.page,
    pageSize: query.pageSize,
    status: query.status,
  });
}

// ---------------------------------------------------------------------------
// 6. Get Shopping List Availability (Available, Allocated, Total Quantities)
// ---------------------------------------------------------------------------

export async function getShoppingListAvailability(): Promise<ShoppingListAvailabilityDTO> {
  const identity = await requireCafeMemberAccess();

  if (!canViewPurchaseRequests(identity)) {
    throw new PurchaseRequestPermissionError(
      "شما دسترسی لازم برای مشاهده موجودی‌های لیست خرید را ندارید",
    );
  }

  const shoppingList = await findActiveShoppingListByCafe(identity.cafeId);
  if (!shoppingList) {
    return { items: [], aggregatedItems: [] };
  }

  const allocationsMap = await getShoppingListAllocations(identity.cafeId);

  const items: ShoppingListItemAvailabilityDTO[] = shoppingList.items.map(
    (item) => {
      const allocated = allocationsMap.get(item.id) || 0;
      const available = Math.max(0, item.quantity - allocated);
      return {
        id: item.id,
        itemType: item.itemType,
        productId: item.productId,
        productName: item.productName,
        productUnit: item.productUnit,
        customTitle: item.customTitle,
        customUnit: item.customUnit,
        totalQuantity: item.quantity,
        allocatedQuantity: allocated,
        availableQuantity: available,
      };
    },
  );

  const aggregatedItems: ShoppingListAggregateAvailabilityDTO[] =
    shoppingList.aggregatedItems.map((agg) => {
      let totalAllocated = 0;
      for (const line of agg.items) {
        totalAllocated += allocationsMap.get(line.id) || 0;
      }
      const available = Math.max(0, agg.totalQuantity - totalAllocated);

      return {
        key: agg.key,
        itemType: agg.itemType,
        productId: agg.productId,
        productName: agg.productName,
        productUnit: agg.productUnit,
        customTitle: agg.customTitle,
        customUnit: agg.customUnit,
        totalQuantity: agg.totalQuantity,
        allocatedQuantity: totalAllocated,
        availableQuantity: available,
        itemCount: agg.itemCount,
      };
    });

  return { items, aggregatedItems };
}
