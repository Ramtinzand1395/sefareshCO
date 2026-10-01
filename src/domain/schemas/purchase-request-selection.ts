import { z } from "zod";

const objectIdPattern = /^[a-f\d]{24}$/i;

export const purchaseRequestSelectionEntityIdSchema = z
  .string()
  .trim()
  .regex(objectIdPattern, "شناسه معتبر نیست");

export const selectionItemInputSchema = z.object({
  purchaseRequestItemId: purchaseRequestSelectionEntityIdSchema,
  supplierResponseId: purchaseRequestSelectionEntityIdSchema,
  selectedQuantity: z
    .number({ message: "تعداد انتخابی الزامی است" })
    .int("تعداد انتخابی باید عدد صحیح باشد")
    .positive("تعداد انتخابی باید عددی مثبت و بزرگ‌تر از صفر باشد")
    .refine(Number.isSafeInteger, "تعداد انتخابی خارج از محدوده مجاز است"),
});

export type SelectionItemInput = z.infer<typeof selectionItemInputSchema>;

export const savePurchaseRequestSelectionSchema = z.object({
  purchaseRequestId: purchaseRequestSelectionEntityIdSchema,
  expectedVersion: z
    .number()
    .int("شماره نسخه باید عدد صحیح باشد")
    .positive("شماره نسخه باید مثبت باشد")
    .refine(Number.isSafeInteger, "شماره نسخه خارج از محدوده مجاز است")
    .optional(),
  items: z.array(selectionItemInputSchema).default([]),
});

export type SavePurchaseRequestSelectionInput = z.infer<
  typeof savePurchaseRequestSelectionSchema
>;

export const purchaseRequestComparisonQuerySchema = z.object({
  purchaseRequestId: purchaseRequestSelectionEntityIdSchema,
});

export type PurchaseRequestComparisonQueryInput = z.infer<
  typeof purchaseRequestComparisonQuerySchema
>;
