import { z } from "zod";

const requiredText = (label: string, max = 150) =>
  z.string().trim().min(1, `${label} را وارد کنید`).max(max, `${label} بیش از حد طولانی است`);

const iranMobileSchema = z
  .string()
  .trim()
  .regex(/^(?:\+98|0098|98|0)?9\d{9}$/, "شماره موبایل معتبر نیست")
  .transform((value) => {
    const digits = value.replace(/^0098/, "0").replace(/^\+98/, "0").replace(/^98/, "0");
    return digits.startsWith("0") ? digits : `0${digits}`;
  });

export const onboardingAccountTypeSchema = z.object({
  accountType: z.enum(["buyer", "supplier"], {
    message: "نوع حساب را انتخاب کنید",
  }),
});

const personalFields = {
  firstName: requiredText("نام", 80),
  lastName: requiredText("نام خانوادگی", 80),
  mobile: iranMobileSchema,
  province: requiredText("استان", 80),
  city: requiredText("شهر", 80),
};

export const buyerOnboardingSchema = z.object({
  accountType: z.literal("buyer"),
  ...personalFields,
  businessName: requiredText("نام کافه یا رستوران"),
  businessType: z.enum(
    ["cafe", "restaurant", "fast_food", "bakery", "catering", "other"],
    { message: "نوع کسب‌وکار را انتخاب کنید" },
  ),
});

export const supplierOnboardingSchema = z.object({
  accountType: z.literal("supplier"),
  ...personalFields,
  businessName: requiredText("نام فروشگاه یا شرکت"),
});

export const onboardingSchema = z.discriminatedUnion("accountType", [
  buyerOnboardingSchema,
  supplierOnboardingSchema,
]);

export type OnboardingInput = z.infer<typeof onboardingSchema>;
