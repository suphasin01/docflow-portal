import { z } from "zod";

export const documentSettingsSchema = z.object({
  defaultVatRate: z.number().min(0).max(100),
  defaultWithholdingTaxRate: z.number().min(0).max(100),
  documentNumberDateFormat: z.enum([
    "TH_YYMM",
    "TH_YY",
    "TH_YYYY",
    "AD_YYMM",
    "AD_YYYY",
  ]),
  documentRunningDigits: z.number().int().min(1).max(8),
  documentNumberSeparator: z.string().max(5),
  deletedNumberBehavior: z.enum(["fill_gap", "continue_max"]),
  documentDisplayDateFormat: z.enum([
    "TH_SHORT_BE",
    "TH_LONG_BE",
    "TH_NUMERIC_BE",
    "EN_SHORT_AD",
    "EN_LONG_AD",
    "EN_NUMERIC_AD",
    "ISO_8601",
  ]),
});

export type DocumentSettingsFormValues = z.infer<typeof documentSettingsSchema>;

export const DEFAULT_DOCUMENT_SETTINGS: DocumentSettingsFormValues = {
  defaultVatRate: 7,
  defaultWithholdingTaxRate: 3,
  documentNumberDateFormat: "TH_YYMM",
  documentRunningDigits: 4,
  documentNumberSeparator: "-",
  deletedNumberBehavior: "continue_max",
  documentDisplayDateFormat: "TH_SHORT_BE",
};

/** แปลง date format → ตัวอย่างวันที่บนเอกสาร */
export function previewDocumentNumber(
  dateFormat: DocumentSettingsFormValues["documentNumberDateFormat"],
  digits: number,
  separator: string,
): string {
  const now = new Date();
  const adYear = now.getFullYear();
  const beYear = adYear + 543;
  const month = String(now.getMonth() + 1).padStart(2, "0");

  let datePart = "";
  switch (dateFormat) {
    case "TH_YYMM":
      datePart = `${String(beYear).slice(-2)}${month}`;
      break;
    case "TH_YY":
      datePart = String(beYear).slice(-2);
      break;
    case "TH_YYYY":
      datePart = String(beYear);
      break;
    case "AD_YYMM":
      datePart = `${String(adYear).slice(-2)}${month}`;
      break;
    case "AD_YYYY":
      datePart = String(adYear);
      break;
  }

  const runningPart = "1".padStart(digits, "0");
  const sep = separator || "";
  return `INV${datePart}${sep}${runningPart}`;
}
