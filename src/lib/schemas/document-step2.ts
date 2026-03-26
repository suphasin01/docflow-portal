// ─── Types ────────────────────────────────────────────────────────────────────

export type DiscountType = "percent" | "fixed";
export type TaxOption = "add_vat7" | "include_vat" | "no_vat";
export type SummaryBlockKey =
  | "document_discount"
  | "vat"
  | "wht"
  | "additional_fee";

export interface VisibleColumns {
  index: boolean;
  code: boolean;
  itemName: boolean; // always true, not togglable
  description: boolean;
  quantity: boolean;
  unit: boolean;
  unitPrice: boolean;
  discount: boolean;
  vat: boolean;
}

export interface ItemRow {
  id: string;
  itemSourceType: "master" | "manual";
  selectedItemId: string;
  selectedItemCode: string;
  title: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountType: DiscountType;
  discountValue: number;
  vatRate: number; // 0, 3, 7, etc.
}

export interface DocumentDiscountConfig {
  enabled: boolean;
  type: DiscountType;
  value: number;
}

export interface VatConfig {
  enabled: boolean;
  vatRate: number;
  includeInItems: boolean;
}

export interface WhtConfig {
  enabled: boolean;
  type: DiscountType;
  value: number;
}

export interface AdditionalFeeConfig {
  enabled: boolean;
  label: string;
  amount: number;
  taxOption: TaxOption;
}

export interface Step2FormValues {
  visibleColumns: VisibleColumns;
  items: ItemRow[];
  documentDiscount: DocumentDiscountConfig;
  vat: VatConfig;
  wht: WhtConfig;
  additionalFee: AdditionalFeeConfig;
  summaryBlockOrder: SummaryBlockKey[];
}

export interface Totals {
  itemSubtotal: number;
  rowDiscountTotal: number;
  subtotalAfterRowDiscount: number;
  documentDiscountTotal: number;
  subtotalAfterAllDiscounts: number;
  taxableBaseAfterDiscount: number;
  vatTotal: number;
  vatIncludedAmount: number;
  whtTotal: number;
  additionalFeeTotal: number;
  netTotal: number;
  netTotalText: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_VISIBLE_COLUMNS: VisibleColumns = {
  index: true,
  code: false,
  itemName: true,
  description: true,
  quantity: true,
  unit: true,
  unitPrice: true,
  discount: true,
  vat: true,
};

export const DEFAULT_SUMMARY_BLOCK_ORDER: SummaryBlockKey[] = [
  "document_discount",
  "vat",
  "wht",
  "additional_fee",
];

export const SUMMARY_BLOCK_LABELS: Record<SummaryBlockKey, string> = {
  document_discount: "ส่วนลดรวม",
  vat: "VAT",
  wht: "หัก ณ ที่จ่าย (WHT)",
  additional_fee: "ค่าใช้จ่ายเพิ่มเติม",
};

export function createEmptyItemRow(): ItemRow {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    itemSourceType: "manual",
    selectedItemId: "",
    selectedItemCode: "",
    title: "",
    description: "",
    quantity: 1,
    unit: "",
    unitPrice: 0,
    discountType: "percent",
    discountValue: 0,
    vatRate: 7,
  };
}

export function buildDefaultStep2Values(
  defaultVatRate = 7,
  defaultWhtRate = 3,
): Step2FormValues {
  return {
    visibleColumns: { ...DEFAULT_VISIBLE_COLUMNS },
    items: [createEmptyItemRow()],
    documentDiscount: { enabled: false, type: "percent", value: 0 },
    vat: { enabled: true, vatRate: defaultVatRate, includeInItems: false },
    wht: { enabled: false, type: "percent", value: defaultWhtRate },
    additionalFee: {
      enabled: false,
      label: "ค่าใช้จ่ายเพิ่มเติม",
      amount: 0,
      taxOption: "no_vat",
    },
    summaryBlockOrder: [...DEFAULT_SUMMARY_BLOCK_ORDER],
  };
}

// ─── Calculation Helpers ───────────────────────────────────────────────────────

export function calcRowDiscount(item: ItemRow): number {
  const base = item.quantity * item.unitPrice;
  return item.discountType === "percent"
    ? base * (item.discountValue / 100)
    : Math.min(item.discountValue, base);
}

export function calcRowTotal(item: ItemRow): number {
  return item.quantity * item.unitPrice - calcRowDiscount(item);
}

export function computeTotals(values: Step2FormValues): Totals {
  const { items, documentDiscount, vat, wht, additionalFee } = values;
  const normalizedVatRate = vat.vatRate > 0 ? vat.vatRate : 0;

  const itemSubtotal = items.reduce(
    (s, i) => s + i.quantity * i.unitPrice,
    0,
  );
  const rowDiscountTotal = items.reduce((s, i) => s + calcRowDiscount(i), 0);
  const subtotalAfterRowDiscount = itemSubtotal - rowDiscountTotal;

  const documentDiscountTotal = documentDiscount.enabled
    ? documentDiscount.type === "percent"
      ? subtotalAfterRowDiscount * (documentDiscount.value / 100)
      : documentDiscount.value
    : 0;

  const subtotalAfterAllDiscounts =
    subtotalAfterRowDiscount - documentDiscountTotal;

  // Exclude rows explicitly marked as VAT exempt (-1) from VAT base.
  const taxableSubtotalAfterRowDiscount = items.reduce((sum, item) => {
    if (item.vatRate === -1) return sum;
    return sum + calcRowTotal(item);
  }, 0);
  const taxableRatio =
    subtotalAfterRowDiscount > 0
      ? Math.min(1, taxableSubtotalAfterRowDiscount / subtotalAfterRowDiscount)
      : 0;
  const taxableBaseAfterDiscount = subtotalAfterAllDiscounts * taxableRatio;

  const vatIncludedAmount =
    vat.enabled && vat.includeInItems && normalizedVatRate > 0
      ? (taxableBaseAfterDiscount * normalizedVatRate) /
        (100 + normalizedVatRate)
      : 0;

  const vatTotal =
    vat.enabled && !vat.includeInItems
      ? taxableBaseAfterDiscount * (normalizedVatRate / 100)
      : 0;

  const whtTotal = wht.enabled
    ? wht.type === "percent"
      ? subtotalAfterAllDiscounts * (wht.value / 100)
      : wht.value
    : 0;

  const additionalFeeTotal = additionalFee.enabled
    ? additionalFee.taxOption === "add_vat7"
      ? additionalFee.amount * 1.07
      : additionalFee.amount
    : 0;

  const netTotal =
    subtotalAfterAllDiscounts + vatTotal - whtTotal + additionalFeeTotal;

  return {
    itemSubtotal,
    rowDiscountTotal,
    subtotalAfterRowDiscount,
    documentDiscountTotal,
    subtotalAfterAllDiscounts,
    taxableBaseAfterDiscount,
    vatTotal,
    vatIncludedAmount,
    whtTotal,
    additionalFeeTotal,
    netTotal: Math.max(0, netTotal),
    netTotalText: bahtToWords(Math.max(0, netTotal)),
  };
}

// ─── Thai Baht to Words ────────────────────────────────────────────────────────

export function bahtToWords(amount: number): string {
  const ones = [
    "",
    "หนึ่ง",
    "สอง",
    "สาม",
    "สี่",
    "ห้า",
    "หก",
    "เจ็ด",
    "แปด",
    "เก้า",
  ];
  const places = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

  function numToThai(n: number): string {
    if (n <= 0) return "";
    const s = String(n);
    const len = s.length;
    let result = "";
    for (let i = 0; i < len; i++) {
      const d = parseInt(s[i]);
      const pos = len - 1 - i;
      if (d === 0) continue;
      if (pos === 1) {
        if (d === 1) result += "สิบ";
        else if (d === 2) result += "ยี่สิบ";
        else result += ones[d] + "สิบ";
      } else if (pos === 0 && d === 1 && len > 1) {
        result += "เอ็ด";
      } else {
        result += ones[d] + (pos > 0 ? places[pos] : "");
      }
    }
    return result;
  }

  if (amount === 0) return "ศูนย์บาทถ้วน";

  const abs = Math.abs(amount);
  const baht = Math.floor(abs);
  const satang = Math.round((abs - baht) * 100);

  let bahtText = "";
  if (baht >= 1000000) {
    const mil = Math.floor(baht / 1000000);
    const rem = baht % 1000000;
    bahtText = numToThai(mil) + "ล้าน" + (rem > 0 ? numToThai(rem) : "");
  } else {
    bahtText = baht === 0 ? "ศูนย์" : numToThai(baht);
  }

  const satangText =
    satang === 0 ? "ถ้วน" : numToThai(satang) + "สตางค์";

  return (amount < 0 ? "ลบ" : "") + bahtText + "บาท" + satangText;
}
