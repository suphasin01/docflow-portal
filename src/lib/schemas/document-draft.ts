import { z } from "zod";
import {
  getDefaultDocGroupForFlow,
  getDefaultDocTypeForFlowGroup,
} from "@/lib/doc-types";

const optStr = z.string().optional().or(z.literal(""));

const officeSnapshotSchema = z.object({
  officeType: z.enum(["none", "hq", "branch"]),
  branchName: optStr,
  branchCode: optStr,
});

export const companySnapshotSchema = z
  .object({
    name: z.string().min(1, "กรุณากรอกชื่อบริษัท"),
    nameEn: optStr,
    logoUrl: optStr,
    address: optStr,
    phone: optStr,
    email: optStr,
    taxId: optStr,
  })
  .merge(officeSnapshotSchema)
  .superRefine((d, ctx) => {
    if (d.officeType === "branch") {
      if (!d.branchName?.trim())
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["branchName"],
          message: "กรุณากรอกชื่อสาขา",
        });
      if (!d.branchCode?.trim())
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["branchCode"],
          message: "กรุณากรอกรหัสสาขา",
        });
    }
  });

export const partnerSnapshotSchema = z
  .object({
    masterId: optStr,
    name: optStr,
    taxId: optStr,
    address: optStr,
    phone: optStr,
    email: optStr,
    contactName: optStr,
  })
  .merge(officeSnapshotSchema);

export const step1Schema = z.object({
  selectedCompanyId: z.string().min(1, "กรุณาเลือกบริษัท"),
  companySnapshot: companySnapshotSchema,

  flowType: z.enum(["income", "expense"]),
  documentGroup: z.enum(["sales", "finance", "purchase"]),
  documentType: z.enum([
    "quotation",
    "sales_order",
    "invoice",
    "billing_note",
    "tax_invoice",
    "receipt",
    "delivery_order",
    "credit_note",
    "purchase_order",
    "purchase_request",
    "payment_voucher",
  ] as const),
  documentNumber: z.string().min(1, "กรุณากรอกเลขที่เอกสาร"),
  documentDate: z.string().min(1, "กรุณาเลือกวันที่เอกสาร"),
  extraDateValue: optStr,
  companyNameSize: z.enum(["S", "M", "L", "XL"]),
  showReferenceNumber: z.boolean(),
  referenceNumber: optStr,

  partnerSnapshot: partnerSnapshotSchema,
});

export type Step1FormValues = z.infer<typeof step1Schema>;
export type CompanySnapshot = Step1FormValues["companySnapshot"];
export type PartnerSnapshot = Step1FormValues["partnerSnapshot"];

export function buildDefaultStep1Values(
  companyId = "",
  companyName = "",
): Step1FormValues {
  const flowType = "income" as const;
  const documentGroup = getDefaultDocGroupForFlow(flowType);
  const documentType = getDefaultDocTypeForFlowGroup(flowType, documentGroup);

  return {
    selectedCompanyId: companyId,
    companySnapshot: {
      name: companyName,
      nameEn: "",
      logoUrl: "",
      address: "",
      phone: "",
      email: "",
      taxId: "",
      officeType: "none",
      branchName: "",
      branchCode: "",
    },
    flowType,
    documentGroup,
    documentType,
    documentNumber: "",
    documentDate: new Date().toISOString().slice(0, 10),
    extraDateValue: "",
    companyNameSize: "L",
    showReferenceNumber: false,
    referenceNumber: "",
    partnerSnapshot: {
      masterId: "",
      name: "",
      taxId: "",
      address: "",
      phone: "",
      email: "",
      contactName: "",
      officeType: "none",
      branchName: "",
      branchCode: "",
    },
  };
}
