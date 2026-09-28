import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .min(1, "ایمیل را وارد کنید")
  .email("ایمیل معتبر نیست")
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد")
  .max(72, "رمز عبور نمی‌تواند بیشتر از ۷۲ کاراکتر باشد")
  .regex(/[A-Za-z]/, "رمز عبور باید حداقل یک حرف داشته باشد")
  .regex(/[0-9]/, "رمز عبور باید حداقل یک عدد داشته باشد");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "رمز عبور را وارد کنید").max(72),
});

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "تکرار رمز عبور را وارد کنید"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "رمز عبور و تکرار آن یکسان نیستند",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
