import {
  buildDefaultStep2Values,
  computeTotals,
  type Step2FormValues,
} from "@/lib/schemas/document-step2";
import {
  DOC_TYPE_CONFIG,
  documentTypeSupportsPaymentStatus,
  type ExtDocType,
} from "@/lib/doc-types";
import type { BusinessDocument, DocumentType } from "@/types";

export type ReportRow = BusinessDocument & { id: string };

export type ReportGroupTab = "all" | "sales" | "purchase" | "finance";

export type DateQuickPreset =
  | "this_month"
  | "last_3m"
  | "this_year"
  | "all"
  | "custom";

/** เอกสารขาย (ตามสเปกรายงาน) */
export const REPORT_SALES_TYPES: DocumentType[] = [
  "quotation",
  "sales_order",
  "invoice",
  "tax_invoice",
  "receipt",
  "billing_note",
  "delivery_order",
];

/** เอกสารจัดซื้อ */
export const REPORT_PURCHASE_TYPES: DocumentType[] = [
  "purchase_order",
  "goods_receipt",
  "payment_voucher",
];

/** เอกสารการเงิน — ใบลดหนี้เท่านั้น */
export const REPORT_FINANCE_TYPES: DocumentType[] = ["credit_note"];

const ALL_REPORT_TAB_TYPES = new Set<DocumentType>([
  ...REPORT_SALES_TYPES,
  ...REPORT_PURCHASE_TYPES,
  ...REPORT_FINANCE_TYPES,
]);

/** P&L: รายได้จากการขาย (รับรู้รายได้) */
export const PNL_REVENUE_TYPES: DocumentType[] = [
  "invoice",
  "tax_invoice",
  "receipt",
];

export function mergeStep2ForTotals(
  initial: Partial<Step2FormValues> | null | undefined,
): Step2FormValues {
  const base = buildDefaultStep2Values();
  if (!initial) return base;
  return {
    ...base,
    ...initial,
    visibleColumns: { ...base.visibleColumns, ...initial.visibleColumns },
    items:
      initial.items && initial.items.length > 0 ? initial.items : base.items,
    summaryBlockOrder:
      initial.summaryBlockOrder && initial.summaryBlockOrder.length > 0
        ? initial.summaryBlockOrder
        : base.summaryBlockOrder,
  };
}

export function docSubtotalBeforeTax(d: ReportRow): number {
  return Math.max(0, (d.subtotal ?? 0) - (d.discountTotal ?? 0));
}

/**
 * เอกสารที่นับใน **การ์ดสรุป 4 ช่อง** (จำนวน, ยอดรวม, VAT, WHT):
 * เฉพาะประเภทที่ระบบติดตามการชำระเงิน และถือว่าชำระครบแล้ว
 * (`paymentStatus === "paid"` หรือ legacy `status === "paid"`).
 * ไม่ยกเว้นเพราะ `draft` — ให้สอดคล้องคอลัมน์สถานะในตารางรายการ
 */
export function isCountedInReportSums(d: ReportRow): boolean {
  if (d.status === "cancelled") return false;
  if (!documentTypeSupportsPaymentStatus(d.type)) return false;
  if (d.status === "paid") return true;
  return (d.paymentStatus ?? "unpaid") === "paid";
}

export function documentsCountedInSums(docs: ReportRow[]): ReportRow[] {
  return docs.filter(isCountedInReportSums);
}

export function docWithholdingTaxAmount(d: ReportRow): number {
  const raw = d.previewData?.step2Data;
  if (!raw || typeof raw !== "object") return 0;
  try {
    return computeTotals(mergeStep2ForTotals(raw as unknown as Step2FormValues))
      .whtTotal;
  } catch {
    return 0;
  }
}

export function typesForGroupTab(tab: ReportGroupTab): DocumentType[] | null {
  if (tab === "all") return null;
  if (tab === "sales") return [...REPORT_SALES_TYPES];
  if (tab === "purchase") return [...REPORT_PURCHASE_TYPES];
  return [...REPORT_FINANCE_TYPES];
}

export function documentMatchesGroupTab(
  type: DocumentType,
  tab: ReportGroupTab,
): boolean {
  const allowed = typesForGroupTab(tab);
  if (!allowed) {
    return ALL_REPORT_TAB_TYPES.has(type);
  }
  return allowed.includes(type);
}

export function getAvailableDocumentTypes(docs: ReportRow[]): DocumentType[] {
  const s = new Set<DocumentType>();
  for (const d of docs) {
    if (!ALL_REPORT_TAB_TYPES.has(d.type)) continue;
    s.add(d.type);
  }
  return Array.from(s).sort((a, b) =>
    (DOC_TYPE_CONFIG[a as ExtDocType]?.label ?? a).localeCompare(
      DOC_TYPE_CONFIG[b as ExtDocType]?.label ?? b,
      "th",
    ),
  );
}

export type DateRange = { from: string | null; to: string | null };

export function ymdToday(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function formatRangeLabel(
  from: string | null,
  to: string | null,
): string {
  if (!from || !to) return "—";
  return `${from} — ${to}`;
}

export function getDateRangeFromPreset(preset: DateQuickPreset): DateRange {
  const today = new Date();
  const ymd = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;

  if (preset === "all") return { from: null, to: null };
  if (preset === "this_month") {
    const a = startOfMonth(today);
    const b = endOfMonth(today);
    return { from: ymd(a), to: ymd(b) };
  }
  if (preset === "last_3m") {
    const start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    return { from: ymd(startOfMonth(start)), to: ymd(today) };
  }
  if (preset === "this_year") {
    const a = new Date(today.getFullYear(), 0, 1);
    const b = new Date(today.getFullYear(), 11, 31);
    return { from: ymd(a), to: ymd(b) };
  }
  return { from: null, to: null };
}

export function documentInDateRange(d: ReportRow, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  const idate = (d.issueDate ?? "").trim();
  if (!idate) return false;
  if (range.from && idate < range.from) return false;
  if (range.to && idate > range.to) return false;
  return true;
}

export type FilterParams = {
  dateRange: DateRange;
  groupTab: ReportGroupTab;
  typeDropdown: DocumentType | "all";
  drilldownType: DocumentType | null;
};

export function activeSingleTypeFilter(p: FilterParams): DocumentType | null {
  return p.drilldownType ?? (p.typeDropdown !== "all" ? p.typeDropdown : null);
}

export function filterReportDocuments(
  docs: ReportRow[],
  p: FilterParams,
): ReportRow[] {
  const effectiveType = activeSingleTypeFilter(p);
  return docs.filter((d) => {
    if (d.status === "cancelled") return false;
    if (!documentMatchesGroupTab(d.type, p.groupTab)) return false;
    if (!documentInDateRange(d, p.dateRange)) return false;
    if (effectiveType && d.type !== effectiveType) return false;
    return true;
  });
}

export type TypeSummaryRow = {
  type: DocumentType;
  count: number;
  subtotalBeforeTax: number;
  vat: number;
  wht: number;
  total: number;
};

export function groupByTypeSummary(docs: ReportRow[]): TypeSummaryRow[] {
  const m = new Map<DocumentType, TypeSummaryRow>();
  for (const d of docs) {
    if (d.status === "cancelled") continue;
    const prev = m.get(d.type);
    const sub = docSubtotalBeforeTax(d);
    const wht = docWithholdingTaxAmount(d);
    const vat = d.vatAmount ?? 0;
    const total = d.total ?? 0;
    if (!prev) {
      m.set(d.type, {
        type: d.type,
        count: 1,
        subtotalBeforeTax: sub,
        vat,
        wht,
        total,
      });
    } else {
      prev.count += 1;
      prev.subtotalBeforeTax += sub;
      prev.vat += vat;
      prev.wht += wht;
      prev.total += total;
    }
  }
  return Array.from(m.values()).sort((a, b) =>
    (DOC_TYPE_CONFIG[a.type as ExtDocType]?.label ?? a.type).localeCompare(
      DOC_TYPE_CONFIG[b.type as ExtDocType]?.label ?? b.type,
      "th",
    ),
  );
}

export type SummaryStats = {
  docCount: number;
  grandTotal: number;
  vatSum: number;
  whtSum: number;
};

export function calculateSummaryStats(docs: ReportRow[]): SummaryStats {
  let docCount = 0;
  let grandTotal = 0;
  let vatSum = 0;
  let whtSum = 0;
  for (const d of docs) {
    if (!isCountedInReportSums(d)) continue;
    docCount += 1;
    grandTotal += d.total ?? 0;
    vatSum += d.vatAmount ?? 0;
    whtSum += docWithholdingTaxAmount(d);
  }
  return { docCount, grandTotal, vatSum, whtSum };
}

export type PnLResult = {
  revenueSales: number;
  lessDiscountCredit: number;
  netRevenue: number;
  costPurchase: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  vatOutput: number;
  vatInput: number;
  netVatPayable: number;
  whtTotal: number;
};

function sumSubtax(docs: ReportRow[], types: Set<DocumentType>): number {
  let s = 0;
  for (const d of docs) {
    if (types.has(d.type)) s += docSubtotalBeforeTax(d);
  }
  return s;
}

function sumVat(docs: ReportRow[], types: Set<DocumentType>): number {
  let s = 0;
  for (const d of docs) {
    if (types.has(d.type)) s += d.vatAmount ?? 0;
  }
  return s;
}

const SALES_VAT_TYPES = new Set<DocumentType>(REPORT_SALES_TYPES);
const PURCHASE_VAT_TYPES = new Set<DocumentType>(REPORT_PURCHASE_TYPES);

export function calculatePnL(docs: ReportRow[]): PnLResult {
  const counted = docs.filter((d) => d.status !== "cancelled");
  const revenueSales = sumSubtax(counted, new Set(PNL_REVENUE_TYPES));
  const lessDiscountCredit = sumSubtax(counted, new Set(["credit_note"]));
  const netRevenue = revenueSales - lessDiscountCredit;

  const costPurchase = sumSubtax(
    counted,
    new Set(["purchase_order", "goods_receipt", "payment_voucher"]),
  );

  const grossProfit = netRevenue - costPurchase;
  const operatingExpenses = 0;
  const netProfit = grossProfit - operatingExpenses;

  const vatOutput = sumVat(counted, SALES_VAT_TYPES);
  const vatInput = sumVat(counted, PURCHASE_VAT_TYPES);
  const netVatPayable = vatOutput - vatInput;

  let whtTotal = 0;
  for (const d of counted) whtTotal += docWithholdingTaxAmount(d);

  return {
    revenueSales,
    lessDiscountCredit,
    netRevenue,
    costPurchase,
    grossProfit,
    operatingExpenses,
    netProfit,
    vatOutput,
    vatInput,
    netVatPayable,
    whtTotal,
  };
}
