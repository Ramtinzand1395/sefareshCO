import { z } from "zod";

import { adminEntityIdSchema } from "@/src/domain/schemas/admin-common";

// Matches model enum exactly: ["pending", "active", "suspended", "rejected"]
export const cafeStatusValues = [
  "pending",
  "active",
  "suspended",
  "rejected",
] as const;

export type CafeStatus = (typeof cafeStatusValues)[number];

export const updateCafeStatusSchema = z.object({
  cafeId: adminEntityIdSchema,
  status: z.enum(cafeStatusValues, {
    message: "وضعیت انتخاب‌شده معتبر نیست",
  }),
});

export type UpdateCafeStatusInput = z.infer<typeof updateCafeStatusSchema>;
