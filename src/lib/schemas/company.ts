import { z } from "zod";

/** field ที่ไม่บังคับ — รับ string ว่างได้ */
const optionalStr = z.string().optional().or(z.literal(""));

export const companyFormSchema = z
  .object({
    officeType: z.enum(["none", "hq", "branch"]),
    /** บังคับเฉพาะชื่อบริษัทภาษาไทย */
    companyNameTh: z.string().min(1, "กรุณากรอกชื่อบริษัท (TH)"),
    companyNameEn: optionalStr,
    taxId: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => !v || /^\d{13}$/.test(v),
        "เลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลักเท่านั้น",
      ),
    phone: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => !v || /^\d{9,10}$/.test(v),
        "เบอร์โทรศัพท์ต้องเป็นตัวเลข 9-10 หลักเท่านั้น",
      ),
    email: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => !v || z.string().email().safeParse(v).success,
        "อีเมลไม่ถูกต้อง",
      ),
    address: optionalStr,
    signerName: optionalStr,
    signerPosition: optionalStr,
    logoUrl: optionalStr,
    branchName: optionalStr,
    branchCode: optionalStr,
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

export type CompanyFormValues = z.infer<typeof companyFormSchema>;
