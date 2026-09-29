import { z } from "zod";

import { adminEntityIdSchema } from "@/src/domain/schemas/admin-common";

export const userStatusValues = [
  "active",
  "pending",
  "suspended",
  "disabled",
] as const;

export type UserStatus = (typeof userStatusValues)[number];

export const updateUserStatusSchema = z.object({
  userId: adminEntityIdSchema,
  status: z.enum(userStatusValues, {
    message: "وضعیت انتخاب‌شده معتبر نیست",
  }),
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
