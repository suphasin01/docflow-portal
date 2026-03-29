import {
  DOC_TYPE_CONFIG,
  documentTypeSupportsPaymentStatus,
  type ExtDocType,
} from "@/lib/doc-types";
import { paymentStatusLabels } from "@/lib/navigation";
import type { DocumentType, Payment } from "@/types";
import {
  calculatePnL,
  docSubtotalBeforeTax,
  docWithholdingTaxAmount,
  filterReportDocuments,
  formatRangeLabel,
  type DateQuickPreset,
  type DateRange,
  type FilterParams,
  type PnLResult,
  type ReportRow,
  ymdToday,
} from "@/lib/reports/document-summary-report";

/** เอกสารในขอบเขตส่งออก = ตัวกรองหน้ารายงาน + ช่วงวันที่จากโมดัล */
export function buildExportDocumentScope(
  allRows: ReportRow[],
  baseFilter: Omit<FilterParams, "dateRange">,
  dateRange: DateRange,
): ReportRow[] {
  return filterReportDocuments(allRows, { ...baseFilter, dateRange });
}

/** ประเภทรายงานในโมดัลส่งออก */
export type ExportReportType =
  | "document_list"
  | "profit_loss"
  | "sales_tax"
  | "purchase_tax";

export const EXPORT_APP_BRAND_LINE = "รายงาน — Grid Doc";

/** เอกสารภาษีขาย (VAT ขาย) */
export const SALES_TAX_DOC_TYPES = new Set<DocumentType>([
  "tax_invoice",
  "invoice",
  "receipt",
]);

/** เอกสารภาษีซื้อ (VAT ซื้อ) */
export const PURCHASE_TAX_DOC_TYPES = new Set<DocumentType>([
  "goods_receipt",
  "purchase_order",
  "payment_voucher",
]);

export function fmtExportNum(n: number): string {
  return n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function csvEscapeCell(value: string | number): string {
  const s = String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function rowToCsvLine(cells: (string | number)[]): string {
  return cells.map(csvEscapeCell).join(",");
}

export function getDateRangeLabel(from: string | null, to: string | null): string {
  return formatRangeLabel(from, to);
}

/** ใช้จาก preset + วันที่กำหนดเอง */
export function resolveDateRangeFromModal(
  preset: DateQuickPreset,
  customFrom: string,
  customTo: string,
  getPresetRange: (p: DateQuickPreset) => DateRange,
): DateRange {
  if (preset === "custom") {
    return {
      from: customFrom.trim() || null,
      to: customTo.trim() || null,
    };
  }
  return getPresetRange(preset);
}

/**
 * ช่วงวันที่สำหรับชื่อไฟล์ — ถ้าไม่มี from/to ใช้ min–max จากเอกสารในชุด
 */
export function resolveFilenameDateRange(
  range: DateRange,
  docs: ReportRow[],
): { from: string; to: string } {
  if (range.from && range.to) return { from: range.from, to: range.to };
  if (docs.length === 0) {
    const t = ymdToday();
    return { from: t, to: t };
  }
  let min = "";
  let max = "";
  for (const d of docs) {
    const id = (d.issueDate ?? "").trim();
    if (!id) continue;
    if (!min || id < min) min = id;
    if (!max || id > max) max = id;
  }
  const t = ymdToday();
  return { from: min || t, to: max || min || t };
}

const REPORT_FILENAME_KEY: Record<ExportReportType, string> = {
  document_list: "รายการเอกสาร",
  profit_loss: "งบกำไรขาดทุน",
  sales_tax: "รายงานภาษีขาย",
  purchase_tax: "รายงานภาษีซื้อ",
};

export function buildExportFilename(
  reportType: ExportReportType,
  from: string,
  to: string,
  ext: "csv" | "pdf",
): string {
  const base = REPORT_FILENAME_KEY[reportType];
  return `${base}_${from}_${to}.${ext}`;
}

function sortDocsByDate(docs: ReportRow[]): ReportRow[] {
  return [...docs].sort((a, b) => {
    const c = (a.issueDate ?? "").localeCompare(b.issueDate ?? "");
    if (c !== 0) return c;
    return (a.docNumber ?? "").localeCompare(b.docNumber ?? "", "en");
  });
}

function partnerTaxIdSnap(d: ReportRow): string {
  const snap = d.partnerSnapshot as
    | { taxId?: string }
    | null
    | undefined;
  return (snap?.taxId ?? "").trim() || "—";
}

function partnerBranchLabel(d: ReportRow): string {
  const snap = d.partnerSnapshot as {
    officeType?: string;
    branchName?: string;
    branchCode?: string;
  } | null | undefined;
  if (!snap || snap.officeType === "none" || !snap.officeType) {
    return "สำนักงานใหญ่";
  }
  if (snap.officeType === "branch") {
    return (
      [snap.branchName, snap.branchCode].filter(Boolean).join(" ") || "สาขา"
    );
  }
  return "สำนักงานใหญ่";
}

function effectivePaymentKeyExport(d: ReportRow): string {
  const ps = (d.paymentStatus ?? "unpaid") as string;
  if (ps === "paid" || d.status === "paid") return "paid";
  if (ps === "partial") return "partial";
  return ps;
}

function buildPaidByDocumentId(payments: Payment[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of payments) {
    const id = p.documentId;
    if (!id) continue;
    m.set(id, (m.get(id) ?? 0) + (p.amount ?? 0));
  }
  return m;
}

export function computePaidAndBalance(
  d: ReportRow,
  paidByDoc: Map<string, number>,
): { paid: number; balance: number; statusLabel: string } {
  if (!documentTypeSupportsPaymentStatus(d.type)) {
    return {
      paid: 0,
      balance: 0,
      statusLabel: "—",
    };
  }
  const total = d.total ?? 0;
  let paid = paidByDoc.get(d.id) ?? 0;
  const key = effectivePaymentKeyExport(d);
  if (paid <= 0 && key === "paid") paid = total;
  if (key === "paid" && paid < total) paid = total;
  const balance = Math.max(0, total - paid);
  const label = paymentStatusLabels[key] ?? key;
  return { paid, balance, statusLabel: label };
}

function partnerNameForTax(d: ReportRow, flow: "sales" | "purchase"): string {
  if (flow === "sales") return d.customerName?.trim() || "—";
  return d.vendorName?.trim() || "—";
}

// ─── CSV: รายการเอกสาร ─────────────────────────────────────────────────────

export function exportDocumentListCSV(
  docs: ReportRow[],
  payments: Payment[],
): string {
  const sorted = sortDocsByDate(docs);
  const paidMap = buildPaidByDocumentId(payments);
  const header = [
    "ลำดับ",
    "เลขที่เอกสาร",
    "ประเภท",
    "วันที่",
    "ลูกค้า/ผู้ขาย",
    "เลขผู้เสียภาษี",
    "ยอดก่อนภาษี",
    "VAT",
    "หัก ณ ที่จ่าย",
    "ยอดรวม",
    "ชำระแล้ว",
    "คงเหลือ",
    "สถานะชำระ",
  ];
  const lines: string[] = [rowToCsvLine(header)];
  let sumSub = 0;
  let sumVat = 0;
  let sumWht = 0;
  let sumTotal = 0;
  let sumPaid = 0;
  let sumBal = 0;

  sorted.forEach((d, i) => {
    const sub = docSubtotalBeforeTax(d);
    const wht = docWithholdingTaxAmount(d);
    const vat = d.vatAmount ?? 0;
    const total = d.total ?? 0;
    const { paid, balance, statusLabel } = computePaidAndBalance(d, paidMap);
    const role = DOC_TYPE_CONFIG[d.type as ExtDocType]?.partnerRole;
    const partner =
      role === "vendor"
        ? d.vendorName?.trim() || "—"
        : d.customerName?.trim() || "—";

    sumSub += sub;
    sumVat += vat;
    sumWht += wht;
    sumTotal += total;
    if (documentTypeSupportsPaymentStatus(d.type)) {
      sumPaid += paid;
      sumBal += balance;
    }

    lines.push(
      rowToCsvLine([
        i + 1,
        d.docNumber,
        DOC_TYPE_CONFIG[d.type as ExtDocType]?.label ?? d.type,
        d.issueDate ?? "",
        partner,
        partnerTaxIdSnap(d),
        fmtExportNum(sub),
        fmtExportNum(vat),
        fmtExportNum(wht),
        fmtExportNum(total),
        documentTypeSupportsPaymentStatus(d.type) ? fmtExportNum(paid) : "—",
        documentTypeSupportsPaymentStatus(d.type) ? fmtExportNum(balance) : "—",
        statusLabel,
      ]),
    );
  });

  lines.push(
    rowToCsvLine([
      "",
      "",
      "",
      "",
      "",
      "รวม",
      fmtExportNum(sumSub),
      fmtExportNum(sumVat),
      fmtExportNum(sumWht),
      fmtExportNum(sumTotal),
      fmtExportNum(sumPaid),
      fmtExportNum(sumBal),
      "",
    ]),
  );

  return lines.join("\r\n");
}

// ─── CSV: ภาษีขาย / ภาษีซื้อ ───────────────────────────────────────────────

export function exportSalesTaxCSV(docs: ReportRow[]): string {
  const rows = sortDocsByDate(
    docs.filter((d) => SALES_TAX_DOC_TYPES.has(d.type)),
  );
  const header = [
    "ลำดับ",
    "วันที่",
    "เลขที่ใบกำกับภาษี",
    "ชื่อผู้ซื้อสินค้า/ผู้รับบริการ",
    "เลขประจำตัวผู้เสียภาษีอากร",
    "สำนักงานใหญ่/สาขา",
    "มูลค่าสินค้า/บริการ",
    "จำนวนภาษีมูลค่าเพิ่ม",
  ];
  const lines: string[] = [rowToCsvLine(header)];
  let sumBase = 0;
  let sumVat = 0;
  rows.forEach((d, i) => {
    const base = docSubtotalBeforeTax(d);
    const vat = d.vatAmount ?? 0;
    sumBase += base;
    sumVat += vat;
    lines.push(
      rowToCsvLine([
        i + 1,
        d.issueDate ?? "",
        d.docNumber,
        partnerNameForTax(d, "sales"),
        partnerTaxIdSnap(d) === "—" ? "" : partnerTaxIdSnap(d),
        partnerBranchLabel(d),
        fmtExportNum(base),
        fmtExportNum(vat),
      ]),
    );
  });
  lines.push(
    rowToCsvLine([
      "",
      "",
      "",
      "",
      "",
      "รวม",
      fmtExportNum(sumBase),
      fmtExportNum(sumVat),
    ]),
  );
  return lines.join("\r\n");
}

export function exportPurchaseTaxCSV(docs: ReportRow[]): string {
  const rows = sortDocsByDate(
    docs.filter((d) => PURCHASE_TAX_DOC_TYPES.has(d.type)),
  );
  const header = [
    "ลำดับ",
    "วันที่",
    "เลขที่ใบกำกับภาษี",
    "ชื่อผู้ขายสินค้า/ผู้ให้บริการ",
    "เลขประจำตัวผู้เสียภาษีอากร",
    "สำนักงานใหญ่/สาขา",
    "มูลค่าสินค้า/บริการ",
    "จำนวนภาษีมูลค่าเพิ่ม",
  ];
  const lines: string[] = [rowToCsvLine(header)];
  let sumBase = 0;
  let sumVat = 0;
  rows.forEach((d, i) => {
    const base = docSubtotalBeforeTax(d);
    const vat = d.vatAmount ?? 0;
    sumBase += base;
    sumVat += vat;
    lines.push(
      rowToCsvLine([
        i + 1,
        d.issueDate ?? "",
        d.docNumber,
        partnerNameForTax(d, "purchase"),
        partnerTaxIdSnap(d) === "—" ? "" : partnerTaxIdSnap(d),
        partnerBranchLabel(d),
        fmtExportNum(base),
        fmtExportNum(vat),
      ]),
    );
  });
  lines.push(
    rowToCsvLine([
      "",
      "",
      "",
      "",
      "",
      "รวม",
      fmtExportNum(sumBase),
      fmtExportNum(sumVat),
    ]),
  );
  return lines.join("\r\n");
}

// ─── CSV: งบกำไรขาดทุน ─────────────────────────────────────────────────────

export function exportProfitLossCSV(docs: ReportRow[]): string {
  const pnl = calculatePnL(docs);
  const header = ["รายการ", "จำนวนเงิน (บาท)"];
  const lines: string[] = [rowToCsvLine(header)];
  const push = (label: string, val: number) =>
    lines.push(rowToCsvLine([label, fmtExportNum(val)]));
  push("รายได้จากการขาย", pnl.revenueSales);
  push("หักส่วนลด/ลดหนี้", -pnl.lessDiscountCredit);
  push("รายได้สุทธิ", pnl.netRevenue);
  push("ต้นทุนขาย/จัดซื้อ", -pnl.costPurchase);
  push("กำไรขั้นต้น", pnl.grossProfit);
  push("ค่าใช้จ่ายดำเนินงาน", -pnl.operatingExpenses);
  push("กำไร (ขาดทุน) สุทธิ", pnl.netProfit);
  lines.push(rowToCsvLine(["", ""]));
  lines.push(rowToCsvLine(["สรุปภาษี", ""]));
  push("ภาษีขาย (VAT)", pnl.vatOutput);
  push("ภาษีซื้อ (VAT)", -pnl.vatInput);
  push("VAT สุทธิ", pnl.netVatPayable);
  push("ภาษีหัก ณ ที่จ่าย (WHT)", pnl.whtTotal);
  return lines.join("\r\n");
}

// ─── Print HTML helpers ───────────────────────────────────────────────────

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function printShell(
  inner: string,
  title: string,
  page: "portrait" | "landscape" = "portrait",
): string {
  const pageSizeCss = page === "landscape" ? "A4 landscape" : "A4 portrait";
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${htmlEscape(title)}</title>
  <style>
    * { box-sizing: border-box; }
    @page {
      size: ${pageSizeCss};
      margin: 10mm;
    }
    body { font-family: system-ui, "Segoe UI", sans-serif; margin: 0; padding: 24px 32px; color: #111; font-size: 12px; }
    .topbar { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; font-size: 11px; color: #666; }
    .brand { color: #666; }
    h1 { text-align: center; font-size: 20px; margin: 8px 0 4px; }
    .sub { text-align: center; color: #666; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; vertical-align: top; }
    th { background: #f4f4f5; font-weight: 600; text-align: left; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    .totals td { font-weight: 700; }
    .neg { color: #dc2626; }
    .pl-main .label-bold { font-weight: 700; }
    .pl-main .net-pos { font-size: 16px; font-weight: 700; color: #15803d; }
    .pl-main .net-neg { font-size: 16px; font-weight: 700; color: #dc2626; }
    .divider { border: none; border-top: 1px dashed #bbb; margin: 16px 0; }
    .tax-h { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: .04em; margin: 8px 0; }
    @media print {
      body { padding: 0; }
      .topbar { font-size: 10px; }
    }
  </style>
</head>
<body>
  ${inner}
</body>
</html>`;
}

export function renderDocumentListPrintView(
  docs: ReportRow[],
  payments: Payment[],
  rangeLabel: string,
): string {
  const sorted = sortDocsByDate(docs);
  const paidMap = buildPaidByDocumentId(payments);
  const rows = sorted
    .map((d, i) => {
      const sub = docSubtotalBeforeTax(d);
      const wht = docWithholdingTaxAmount(d);
      const vat = d.vatAmount ?? 0;
      const total = d.total ?? 0;
      const { paid, balance, statusLabel } = computePaidAndBalance(d, paidMap);
      const role = DOC_TYPE_CONFIG[d.type as ExtDocType]?.partnerRole;
      const partner =
        role === "vendor"
          ? d.vendorName?.trim() || "—"
          : d.customerName?.trim() || "—";
      const paidCell = documentTypeSupportsPaymentStatus(d.type)
        ? fmtExportNum(paid)
        : "—";
      const balCell = documentTypeSupportsPaymentStatus(d.type)
        ? fmtExportNum(balance)
        : "—";
      return `<tr>
  <td class="num">${i + 1}</td>
  <td>${htmlEscape(d.docNumber)}</td>
  <td>${htmlEscape(DOC_TYPE_CONFIG[d.type as ExtDocType]?.label ?? d.type)}</td>
  <td>${htmlEscape(d.issueDate ?? "")}</td>
  <td>${htmlEscape(partner)}</td>
  <td class="num">${fmtExportNum(sub)}</td>
  <td class="num">${fmtExportNum(vat)}</td>
  <td class="num">${fmtExportNum(wht)}</td>
  <td class="num">${fmtExportNum(total)}</td>
  <td class="num">${htmlEscape(paidCell)}</td>
  <td class="num">${htmlEscape(balCell)}</td>
  <td>${htmlEscape(statusLabel)}</td>
</tr>`;
    })
    .join("\n");

  const inner = `
  <div class="topbar">
    <span>${htmlEscape(new Date().toLocaleString("th-TH"))}</span>
    <span class="brand">${htmlEscape(EXPORT_APP_BRAND_LINE)}</span>
  </div>
  <h1>รายงานสรุปเอกสาร</h1>
  <p class="sub">ช่วงเวลา: ${htmlEscape(rangeLabel)} · จำนวน ${sorted.length} รายการ</p>
  <table>
    <thead>
      <tr>
        <th class="num">#</th>
        <th>เลขที่</th>
        <th>ประเภท</th>
        <th>วันที่</th>
        <th>ลูกค้า</th>
        <th class="num">ยอดก่อนภาษี</th>
        <th class="num">VAT</th>
        <th class="num">WHT</th>
        <th class="num">ยอดรวม</th>
        <th class="num">ชำระแล้ว</th>
        <th class="num">คงเหลือ</th>
        <th>สถานะ</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
  return printShell(inner, "รายงานสรุปเอกสาร", "landscape");
}

export function renderSalesTaxPrintView(
  docs: ReportRow[],
  rangeLabel: string,
): string {
  const rows_list = sortDocsByDate(
    docs.filter((d) => SALES_TAX_DOC_TYPES.has(d.type)),
  );
  let sumBase = 0;
  let sumVat = 0;
  const body = rows_list
    .map((d, i) => {
      const base = docSubtotalBeforeTax(d);
      const vat = d.vatAmount ?? 0;
      sumBase += base;
      sumVat += vat;
      return `<tr>
  <td class="num">${i + 1}</td>
  <td>${htmlEscape(d.issueDate ?? "")}</td>
  <td>${htmlEscape(d.docNumber)}</td>
  <td>${htmlEscape(partnerNameForTax(d, "sales"))}</td>
  <td>${htmlEscape(partnerTaxIdSnap(d))}</td>
  <td>${htmlEscape(partnerBranchLabel(d))}</td>
  <td class="num">${fmtExportNum(base)}</td>
  <td class="num">${fmtExportNum(vat)}</td>
</tr>`;
    })
    .join("\n");
  const foot = `<tr class="totals">
  <td colspan="6">รวม</td>
  <td class="num">${fmtExportNum(sumBase)}</td>
  <td class="num">${fmtExportNum(sumVat)}</td>
</tr>`;

  const inner = `
  <div class="topbar">
    <span>${htmlEscape(new Date().toLocaleString("th-TH"))}</span>
    <span class="brand">${htmlEscape(EXPORT_APP_BRAND_LINE)}</span>
  </div>
  <h1>รายงานภาษีขาย</h1>
  <p class="sub">ช่วงเวลา: ${htmlEscape(rangeLabel)}</p>
  <table>
    <thead>
      <tr>
        <th class="num">ลำดับ</th>
        <th>วันที่</th>
        <th>เลขที่ใบกำกับภาษี</th>
        <th>ชื่อผู้ซื้อ</th>
        <th>เลขผู้เสียภาษี</th>
        <th>สาขา</th>
        <th class="num">มูลค่าสินค้า/บริการ</th>
        <th class="num">ภาษีมูลค่าเพิ่ม</th>
      </tr>
    </thead>
    <tbody>${body}${foot}</tbody>
  </table>`;
  return printShell(inner, "รายงานภาษีขาย", "landscape");
}

export function renderPurchaseTaxPrintView(
  docs: ReportRow[],
  rangeLabel: string,
): string {
  const rows_list = sortDocsByDate(
    docs.filter((d) => PURCHASE_TAX_DOC_TYPES.has(d.type)),
  );
  let sumBase = 0;
  let sumVat = 0;
  const body = rows_list
    .map((d, i) => {
      const base = docSubtotalBeforeTax(d);
      const vat = d.vatAmount ?? 0;
      sumBase += base;
      sumVat += vat;
      return `<tr>
  <td class="num">${i + 1}</td>
  <td>${htmlEscape(d.issueDate ?? "")}</td>
  <td>${htmlEscape(d.docNumber)}</td>
  <td>${htmlEscape(partnerNameForTax(d, "purchase"))}</td>
  <td>${htmlEscape(partnerTaxIdSnap(d))}</td>
  <td>${htmlEscape(partnerBranchLabel(d))}</td>
  <td class="num">${fmtExportNum(base)}</td>
  <td class="num">${fmtExportNum(vat)}</td>
</tr>`;
    })
    .join("\n");
  const foot = `<tr class="totals">
  <td colspan="6">รวม</td>
  <td class="num">${fmtExportNum(sumBase)}</td>
  <td class="num">${fmtExportNum(sumVat)}</td>
</tr>`;

  const inner = `
  <div class="topbar">
    <span>${htmlEscape(new Date().toLocaleString("th-TH"))}</span>
    <span class="brand">${htmlEscape(EXPORT_APP_BRAND_LINE)}</span>
  </div>
  <h1>รายงานภาษีซื้อ</h1>
  <p class="sub">ช่วงเวลา: ${htmlEscape(rangeLabel)}</p>
  <table>
    <thead>
      <tr>
        <th class="num">ลำดับ</th>
        <th>วันที่</th>
        <th>เลขที่ใบกำกับภาษี</th>
        <th>ชื่อผู้ขาย</th>
        <th>เลขผู้เสียภาษี</th>
        <th>สาขา</th>
        <th class="num">มูลค่าสินค้า/บริการ</th>
        <th class="num">ภาษีมูลค่าเพิ่ม</th>
      </tr>
    </thead>
    <tbody>${body}${foot}</tbody>
  </table>`;
  return printShell(inner, "รายงานภาษีซื้อ", "landscape");
}

function plPdfAmount(
  n: number,
  opts?: {
    bold?: boolean;
    largeGreen?: boolean;
    largeNeg?: boolean;
    taxNeutralNeg?: boolean;
  },
): string {
  if (n === 0) return `<td class="num">${fmtExportNum(0)}</td>`;
  if (n < 0) {
    const inner = `(${fmtExportNum(Math.abs(n))})`;
    if (opts?.largeNeg) {
      return `<td class="num net-neg">${inner}</td>`;
    }
    if (opts?.taxNeutralNeg) {
      return `<td class="num">${inner}</td>`;
    }
    return `<td class="num neg">${inner}</td>`;
  }
  if (opts?.largeGreen) {
    return `<td class="num net-pos">${fmtExportNum(n)}</td>`;
  }
  return `<td class="num">${fmtExportNum(n)}</td>`;
}

export function renderProfitLossPrintView(
  docs: ReportRow[],
  rangeLabel: string,
): string {
  const p: PnLResult = calculatePnL(docs);
  const inner = `
  <div class="topbar">
    <span>${htmlEscape(new Date().toLocaleString("th-TH"))}</span>
    <span class="brand">${htmlEscape(EXPORT_APP_BRAND_LINE)}</span>
  </div>
  <h1>งบกำไรขาดทุน</h1>
  <p class="sub">ช่วงเวลา: ${htmlEscape(rangeLabel)}</p>
  <table class="pl-main">
    <tbody>
      <tr><td>รายได้จากการขาย</td>${plPdfAmount(p.revenueSales)}</tr>
      <tr><td>หักส่วนลด/ลดหนี้</td>${plPdfAmount(-p.lessDiscountCredit)}</tr>
      <tr><td class="label-bold">รายได้สุทธิ</td>${plPdfAmount(p.netRevenue, { bold: true })}</tr>
      <tr><td>ต้นทุนขาย/จัดซื้อ</td>${plPdfAmount(-p.costPurchase)}</tr>
      <tr><td class="label-bold">กำไรขั้นต้น</td>${plPdfAmount(p.grossProfit, { bold: true })}</tr>
      <tr><td>ค่าใช้จ่ายดำเนินงาน</td>${plPdfAmount(-p.operatingExpenses)}</tr>
      <tr><td class="label-bold">กำไร (ขาดทุน) สุทธิ</td>${
        p.netProfit >= 0
          ? plPdfAmount(p.netProfit, { largeGreen: true })
          : plPdfAmount(p.netProfit, { largeNeg: true })
      }</tr>
    </tbody>
  </table>
  <div class="divider"></div>
  <p class="tax-h">สรุปภาษี</p>
  <table class="pl-main">
    <tbody>
      <tr><td>ภาษีขาย (VAT)</td>${plPdfAmount(p.vatOutput)}</tr>
      <tr><td>ภาษีซื้อ (VAT)</td>${plPdfAmount(-p.vatInput, { taxNeutralNeg: true })}</tr>
      <tr><td class="label-bold">VAT สุทธิ</td>${plPdfAmount(p.netVatPayable, { bold: true })}</tr>
      <tr><td>ภาษีหัก ณ ที่จ่าย (WHT)</td>${plPdfAmount(p.whtTotal)}</tr>
    </tbody>
  </table>`;
  return printShell(inner, "งบกำไรขาดทุน");
}
