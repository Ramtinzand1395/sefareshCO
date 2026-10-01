import type {
  InternalRequestItemStatus,
  InternalRequestStatus,
} from "@/model/internal-purchase-request";

export type { InternalRequestItemStatus, InternalRequestStatus };

export type ItemReviewEvaluationInput = {
  requestedQuantity: number;
  approvedQuantity: number;
};

/**
 * Derives the review status of an individual item based on approved vs requested quantity.
 * Rules:
 * - 0 <= approvedQuantity <= requestedQuantity
 * - approvedQuantity === 0 -> "rejected"
 * - approvedQuantity === requestedQuantity -> "approved"
 * - 0 < approvedQuantity < requestedQuantity -> "partially_approved"
 */
export type ReviewedItemStatus = "approved" | "partially_approved" | "rejected";

export function deriveItemReviewStatus(
  requestedQuantity: number,
  approvedQuantity: number,
): ReviewedItemStatus {
  if (approvedQuantity <= 0) return "rejected";
  if (approvedQuantity >= requestedQuantity) return "approved";
  return "partially_approved";
}

/**
 * Derives parent request status from evaluated items:
 * - If all items are rejected (approvedQuantity === 0 for each): "rejected"
 * - If all items are approved with requestedQuantity: "approved"
 * - If only some items or partial quantities are approved: "partially_approved"
 */
export function deriveParentRequestStatus(
  items: Array<{ requestedQuantity: number; approvedQuantity: number }>,
): "approved" | "partially_approved" | "rejected" {
  if (!items || items.length === 0) return "rejected";

  const allApproved = items.every(
    (item) =>
      item.approvedQuantity === item.requestedQuantity &&
      item.requestedQuantity > 0,
  );
  if (allApproved) return "approved";

  const allRejected = items.every((item) => item.approvedQuantity === 0);
  if (allRejected) return "rejected";

  return "partially_approved";
}
