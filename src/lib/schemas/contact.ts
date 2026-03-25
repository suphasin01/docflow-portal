import { z } from "zod";

const optionalStr = z.string().optional().or(z.literal(""));

export const contactFormSchema = z
  .object({
    partnerType: z.enum(["customer", "vendor"]),
    nameTh: z.string().min(1, "กรุณากรอกชื่อ"),
    nameEn: optionalStr,
    taxId: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => !v || /^\d{13}$/.test(v),
        "เลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก"
      ),
    phone: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => !v || /^\d{9,10}$/.test(v),
        "เบอร์โทรศัพท์ต้องเป็นตัวเลข 9-10 หลัก"
      ),
    email: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => !v || z.string().email().safeParse(v).success,
        "อีเมลไม่ถูกต้อง"
      ),
    address: optionalStr,
    officeType: z.enum(["none", "hq", "branch"]),
    branchName: optionalStr,
    branchCode: optionalStr,
    logoBase64: optionalStr,
  })
  .superRefine((data, ctx) => {
    if (data.officeType === "branch") {
      if (!data.branchName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["branchName"],
          message: "กรุณากรอกชื่อสาขา",
        });
      }
      if (!data.branchCode?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["branchCode"],
          message: "กรุณากรอกรหัสสาขา",
        });
      }
    }
  });

export type ContactFormValues = z.infer<typeof contactFormSchema>;
