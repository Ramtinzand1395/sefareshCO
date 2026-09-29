import { z } from "zod";

export const userStatusValues = [
  "active",
  "pending",
  "suspended",
  "disabled",
] as const;

export type UserStatus = (typeof userStatusValues)[number];

export const updateUserStatusSchema = z.object({
  userId: z.string().min(1, "شناسه کاربر الزامی است"),
  status: z.enum(userStatusValues, {
    message: "وضعیت انتخاب‌شده معتبر نیست",
  }),
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
