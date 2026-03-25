import { z } from "zod";

const optionalStr = z.string().optional().or(z.literal(""));

export const catalogFormSchema = z
  .object({
    itemType: z.enum(["product", "service"]),
    name: z.string().min(1, "กรุณากรอกชื่อสินค้า/บริการ"),
    description: optionalStr,
    unit: optionalStr,
    salePrice: z.number().min(0, "ราคาขายต้องไม่ติดลบ"),
    costPrice: z.number().min(0, "ราคาซื้อต้องไม่ติดลบ").optional(),
    vatType: z.enum(["vat3", "vat7", "custom"]),
    customVatRate: z.number().min(0, "VAT ต้องไม่ติดลบ").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.vatType === "custom") {
      if (data.customVatRate === undefined || data.customVatRate === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["customVatRate"],
          message: "กรุณากรอก VAT %",
        });
      }
    }
  });

export type CatalogFormValues = z.infer<typeof catalogFormSchema>;

/** แปลง vatType → อัตราจริงเป็นตัวเลข */
export function resolveVatRate(
  vatType: "vat3" | "vat7" | "custom",
  customVatRate?: number
): number {
  if (vatType === "vat3") return 3;
  if (vatType === "vat7") return 7;
  return customVatRate ?? 0;
}
