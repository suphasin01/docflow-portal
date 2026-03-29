"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Landmark,
  LineChart,
  Percent,
  Receipt,
  Wallet,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { StatusBadge } from "@/components/business/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportReportModal } from "@/components/reports/export-report-modal";
import { useCompanyStore } from "@/stores/company-store";
import { useDocuments, usePayments } from "@/hooks/use-workspace-data";
import {
  DOC_TYPE_CONFIG,
  documentTypeSupportsPaymentStatus,
  type ExtDocType,
} from "@/lib/doc-types";
import { paymentStatusLabels } from "@/lib/navigation";
import {
  activeSingleTypeFilter,
  calculatePnL,
  calculateSummaryStats,
  docSubtotalBeforeTax,
  docWithholdingTaxAmount,
  filterReportDocuments,
  getAvailableDocumentTypes,
  getDateRangeFromPreset,
  groupByTypeSummary,
  type DateQuickPreset,
  type DateRange,
  type FilterParams,
  type PnLResult,
  type ReportGroupTab,
  type ReportRow,
  type SummaryStats,
  type TypeSummaryRow,
  formatRangeLabel,
} from "@/lib/reports/document-summary-report";
import type { ExportReportType } from "@/lib/reports/report-export";
import { cn } from "@/lib/utils";
import type { DocumentType } from "@/types";

const DOC_TYPE_BADGE: Record<string, string> = {
  quotation: "border bg-indigo-50 text-indigo-900 border-indigo-200",
  sales_order: "border bg-violet-50 text-violet-900 border-violet-200",
  invoice: "border bg-sky-50 text-sky-900 border-sky-200",
  billing_note: "border bg-pink-50 text-pink-900 border-pink-200",
  tax_invoice: "border bg-orange-50 text-orange-900 border-orange-200",
  receipt: "border bg-emerald-50 text-emerald-900 border-emerald-200",
  delivery_order: "border bg-purple-50 text-purple-900 border-purple-200",
  credit_note: "border bg-rose-50 text-rose-900 border-rose-200",
  purchase_order: "border bg-cyan-50 text-cyan-900 border-cyan-200",
  goods_receipt: "border bg-green-50 text-green-900 border-green-200",
  payment_voucher: "border bg-amber-50 text-amber-900 border-amber-200",
};

function fmt(n: number) {
  return n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function todayYmd(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function effectivePaymentKey(d: ReportRow): string {
  const ps = (d.paymentStatus ?? "unpaid") as string;
  if (ps === "paid" || d.status === "paid") return "paid";
  if (ps === "partial") return "partial";
  const due = d.dueDate?.trim();
  if (due && due < todayYmd()) return "overdue";
  return ps;
}

/** คอลัมน์รายงาน: แสดงเฉพาะสถานะการชำระเงิน (ประเภทที่ระบบติดตามได้) */
function reportPaymentStatusDisplay(d: ReportRow): {
  key: string;
  label: string;
  showBadge: boolean;
} {
  if (!documentTypeSupportsPaymentStatus(d.type)) {
    return { key: "na", label: "—", showBadge: false };
  }
  const k = effectivePaymentKey(d);
  return {
    key: k,
    label: paymentStatusLabels[k] ?? k,
    showBadge: true,
  };
}

function formatIssueDateShort(iso: string | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function partnerLabel(d: ReportRow): string {
  const role = DOC_TYPE_CONFIG[d.type as ExtDocType]?.partnerRole;
  if (role === "vendor") return d.vendorName?.trim() || "—";
  return d.customerName?.trim() || "—";
}

type SortColumn = "issueDate" | "docNumber" | "total";
type SortDir = "asc" | "desc";

// ─── DateRangeQuickFilter ───────────────────────────────────────────────────

function DateRangeQuickFilter({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomChange,
}: {
  preset: DateQuickPreset;
  onPresetChange: (p: DateQuickPreset) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
}) {
  const pills: { key: DateQuickPreset; label: string }[] = [
    { key: "this_month", label: "เดือนนี้" },
    { key: "last_3m", label: "3 เดือน" },
    { key: "this_year", label: "ปีนี้" },
    { key: "all", label: "ทั้งหมด" },
    { key: "custom", label: "กำหนดเอง" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Calendar className="size-4 shrink-0 text-muted-foreground" />
        {pills.map(({ key, label }) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={preset === key ? "default" : "secondary"}
            className={cn(
              "rounded-xl",
              preset === key && "bg-slate-900 text-white hover:bg-slate-900",
            )}
            onClick={() => onPresetChange(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      {preset === "custom" ? (
        <div className="flex flex-wrap items-center gap-2 pl-6">
          <Input
            type="date"
            className="h-10 w-[160px] rounded-xl"
            value={customFrom}
            onChange={(e) => onCustomChange(e.target.value, customTo)}
          />
          <span className="text-sm text-muted-foreground">ถึง</span>
          <Input
            type="date"
            className="h-10 w-[160px] rounded-xl"
            value={customTo}
            onChange={(e) => onCustomChange(customFrom, e.target.value)}
          />
        </div>
      ) : null}
    </div>
  );
}

// ─── DocumentGroupTabs ───────────────────────────────────────────────────────

function DocumentGroupTabs({
  value,
  onChange,
}: {
  value: ReportGroupTab;
  onChange: (v: ReportGroupTab) => void;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => {
        if (v === "all" || v === "sales" || v === "purchase" || v === "finance")
          onChange(v);
      }}
    >
      <TabsList className="h-10 flex-wrap rounded-xl bg-slate-100/90 p-1">
        <TabsTrigger
          value="all"
          className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white"
        >
          ทั้งหมด
        </TabsTrigger>
        <TabsTrigger
          value="sales"
          className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white"
        >
          เอกสารขาย
        </TabsTrigger>
        <TabsTrigger
          value="purchase"
          className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white"
        >
          เอกสารจัดซื้อ
        </TabsTrigger>
        <TabsTrigger
          value="finance"
          className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white"
        >
          เอกสารการเงิน
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

// ─── ReportSummaryCards ───────────────────────────────────────────────────────

function ReportSummaryCards({ stats }: { stats: SummaryStats }) {
  const cards = [
    {
      title: "จำนวนเอกสาร (ชำระแล้ว)",
      value: String(stats.docCount),
      icon: FileText,
      iconBg: "bg-sky-50 text-sky-700",
    },
    {
      title: "ยอดรวม (ชำระแล้ว)",
      value: `฿${fmt(stats.grandTotal)}`,
      icon: Wallet,
      iconBg: "bg-violet-50 text-violet-700",
    },
    {
      title: "VAT",
      value: `฿${fmt(stats.vatSum)}`,
      icon: Landmark,
      iconBg: "bg-slate-100 text-slate-700",
    },
    {
      title: "หัก ณ ที่จ่าย",
      value: `฿${fmt(stats.whtSum)}`,
      icon: Percent,
      iconBg: "bg-amber-50 text-amber-800",
    },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        สรุปยอด VAT / หัก ณ ที่จ่าย และตารางประเภทด้านล่าง นับเฉพาะเอกสารที่
        <span className="font-medium text-foreground"> ชำระแล้ว </span>
        (ประเภทที่ติดตามการชำระเงินในระบบ)
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.title}
            className="rounded-2xl border border-border/70 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  c.iconBg,
                )}
              >
                <c.icon className="size-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {c.title}
                </p>
                <p className="text-xl font-bold tabular-nums tracking-tight text-foreground">
                  {c.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SummaryByTypeTable ──────────────────────────────────────────────────────

function SummaryByTypeTable({
  rows,
  onTypeClick,
}: {
  rows: TypeSummaryRow[];
  onTypeClick: (t: DocumentType) => void;
}) {
  const totals = rows.reduce(
    (a, r) => ({
      count: a.count + r.count,
      sub: a.sub + r.subtotalBeforeTax,
      vat: a.vat + r.vat,
      wht: a.wht + r.wht,
      total: a.total + r.total,
    }),
    { count: 0, sub: 0, vat: 0, wht: 0, total: 0 },
  );

  return (
    <Card className="rounded-2xl border-border/80 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          สรุปตามประเภทเอกสาร
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          สรุปตามช่วงเวลาและตัวกรองที่เลือก (ทุกเอกสารในรายการยกเว้นที่ยกเลิก)
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border/80 bg-slate-50/80">
              <tr className="text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">ประเภท</th>
                <th className="px-4 py-3 text-right">จำนวน</th>
                <th className="px-4 py-3 text-right">ยอดก่อนภาษี</th>
                <th className="px-4 py-3 text-right">VAT</th>
                <th className="px-4 py-3 text-right">หัก ณ ที่จ่าย</th>
                <th className="px-4 py-3 text-right">ยอดรวม</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cls =
                  DOC_TYPE_BADGE[r.type] ??
                  "border bg-slate-50 text-slate-800 border-slate-200";
                const label =
                  DOC_TYPE_CONFIG[r.type as ExtDocType]?.label ?? r.type;
                return (
                  <tr key={r.type} className="border-b border-border/60">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onTypeClick(r.type)}
                        className="text-left font-medium text-primary underline-offset-2 hover:underline"
                      >
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md px-2 py-0.5 text-xs font-medium",
                            cls,
                          )}
                        >
                          {label}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.count}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmt(r.subtotalBeforeTax)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmt(r.vat)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmt(r.wht)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {fmt(r.total)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-slate-50/60 font-semibold">
                <td className="px-4 py-3">รวม</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {totals.count}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmt(totals.sub)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmt(totals.vat)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmt(totals.wht)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmt(totals.total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── TypeDrilldownTagBar ──────────────────────────────────────────────────────

function TypeDrilldownTagBar({
  drillType,
  onClear,
  onBackAll,
}: {
  drillType: DocumentType | null;
  onClear: () => void;
  onBackAll: () => void;
}) {
  if (!drillType) return null;
  const label = DOC_TYPE_CONFIG[drillType as ExtDocType]?.label ?? drillType;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-white/90 px-4 py-3 shadow-sm">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-xl"
        onClick={onBackAll}
      >
        ← กลับ — แสดงทั้งหมด
      </Button>
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium">
        ประเภท: {label}
        <button
          type="button"
          onClick={onClear}
          className="ml-1 rounded-full p-0.5 hover:bg-muted"
          aria-label="ลบตัวกรอง"
        >
          ×
        </button>
      </span>
    </div>
  );
}

// ─── ProfitLossCard ───────────────────────────────────────────────────────────

function PlNeg({ n }: { n: number }) {
  if (n === 0) return <span className="tabular-nums">{fmt(0)}</span>;
  if (n < 0) return <span className="tabular-nums">{fmt(n)}</span>;
  return <span className="tabular-nums text-red-600">({fmt(n)})</span>;
}

function PlPosBold({ n }: { n: number }) {
  return <span className="font-semibold tabular-nums">{fmt(n)}</span>;
}

function ProfitLossCard({
  pnl,
  rangeLabel,
}: {
  pnl: PnLResult;
  rangeLabel: string;
}) {
  const netClass =
    pnl.netProfit >= 0 ? "text-blue-950 dark:text-blue-100" : "text-red-600";

  return (
    <Card className="rounded-2xl border-border/80 bg-white shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-base font-semibold">
            งบกำไรขาดทุน
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            คำนวณจากเอกสารทั้งหมดในช่วงและตัวกรองนี้ (ไม่จำกัดเฉพาะชำระแล้ว)
          </p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {rangeLabel}
        </span>
      </CardHeader>
      <CardContent className="space-y-0 text-sm">
        <div className="flex justify-between gap-4 border-b border-border/50 py-2.5">
          <span>รายได้จากการขาย</span>
          <span className="tabular-nums">{fmt(pnl.revenueSales)}</span>
        </div>
        <div className="flex justify-between gap-4 border-b border-border/50 py-2.5">
          <span>หัก ส่วนลด/ลดหนี้</span>
          <PlNeg n={pnl.lessDiscountCredit} />
        </div>
        <div className="flex justify-between gap-4 border-b border-border/80 py-3">
          <span className="font-medium">รายได้สุทธิ</span>
          <PlPosBold n={pnl.netRevenue} />
        </div>
        <div className="flex justify-between gap-4 border-b border-border/50 py-2.5">
          <span>ต้นทุนขาย/จัดซื้อ</span>
          <PlNeg n={pnl.costPurchase} />
        </div>
        <div className="flex justify-between gap-4 border-b border-border/80 py-3">
          <span className="font-medium">กำไรขั้นต้น</span>
          <PlPosBold n={pnl.grossProfit} />
        </div>
        <div className="flex justify-between gap-4 border-b border-border/50 py-2.5">
          <span>ค่าใช้จ่ายดำเนินงาน</span>
          <PlNeg n={pnl.operatingExpenses} />
        </div>
        <div className="flex justify-between gap-4 border-b border-border/80 py-4">
          <span className="font-semibold">กำไร (ขาดทุน) สุทธิ</span>
          <span className={cn("text-lg font-bold tabular-nums", netClass)}>
            {fmt(pnl.netProfit)}
          </span>
        </div>

        <p className="pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          สรุปภาษี
        </p>
        <div className="flex justify-between gap-4 py-2">
          <span>ภาษีขาย (VAT)</span>
          <span className="tabular-nums">{fmt(pnl.vatOutput)}</span>
        </div>
        <div className="flex justify-between gap-4 py-2">
          <span>ภาษีซื้อ (VAT)</span>
          <PlNeg n={pnl.vatInput} />
        </div>
        <div className="flex justify-between gap-4 py-2">
          <span>VAT สุทธิ (ต้องนำส่ง)</span>
          <span className="tabular-nums">{fmt(pnl.netVatPayable)}</span>
        </div>
        <div className="flex justify-between gap-4 py-2">
          <span>ภาษีหัก ณ ที่จ่าย (WHT)</span>
          <span className="tabular-nums">{fmt(pnl.whtTotal)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── DocumentListCollapse ─────────────────────────────────────────────────────

function DocumentListCollapse({
  docs,
  expanded,
  onToggle,
  sortColumn,
  sortDir,
  onSort,
}: {
  docs: ReportRow[];
  expanded: boolean;
  onToggle: () => void;
  sortColumn: SortColumn;
  sortDir: SortDir;
  onSort: (c: SortColumn) => void;
}) {
  const sortIcon = (c: SortColumn) =>
    sortColumn === c ? (sortDir === "desc" ? " ↓" : " ↑") : "";

  return (
    <Card className="rounded-2xl border-border/80 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50/80"
      >
        <div>
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Receipt className="size-4 text-muted-foreground" />
            รายการเอกสาร ({docs.length})
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            ค่าเริ่มต้นเรียงตามวันที่เอกสาร · เลขที่รับแยกตามประเภทเอกสาร ·
            กดหัวคอลัมน์เพื่อเรียงตามเลขที่หรือยอด
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="size-5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-5 shrink-0 text-muted-foreground" />
        )}
      </button>
      {expanded ? (
        <CardContent className="border-t border-border/60 p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-border/80 bg-slate-50/80">
                <tr className="text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      className="font-medium hover:text-foreground"
                      onClick={() => onSort("docNumber")}
                    >
                      เลขที่{sortIcon("docNumber")}
                    </button>
                  </th>
                  <th className="px-4 py-3">ประเภท</th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      className="font-medium hover:text-foreground"
                      onClick={() => onSort("issueDate")}
                    >
                      วันที่{sortIcon("issueDate")}
                    </button>
                  </th>
                  <th className="px-4 py-3">ลูกค้า</th>
                  <th className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="ml-auto inline font-medium hover:text-foreground"
                      onClick={() => onSort("total")}
                    >
                      ยอดรวม{sortIcon("total")}
                    </button>
                  </th>
                  <th className="px-4 py-3">สถานะการชำระเงิน</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => {
                  const tlabel =
                    DOC_TYPE_CONFIG[d.type as ExtDocType]?.label ?? d.type;
                  const st = reportPaymentStatusDisplay(d);
                  return (
                    <tr key={d.id} className="border-b border-border/50">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/documents/detail?id=${encodeURIComponent(d.id)}`}
                          className="font-medium tabular-nums text-primary underline-offset-2 hover:underline"
                        >
                          {d.docNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md px-2 py-0.5 text-xs font-medium",
                            DOC_TYPE_BADGE[d.type] ??
                              "border bg-slate-50 text-slate-800 border-slate-200",
                          )}
                        >
                          {tlabel}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                        {formatIssueDateShort(d.issueDate)}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-2.5">
                        {partnerLabel(d)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                        ฿{fmt(d.total ?? 0)}
                      </td>
                      <td className="px-4 py-2.5">
                        {st.showBadge ? (
                          <StatusBadge status={st.key} label={st.label} />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {st.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

// ─── ReportPage (main) ───────────────────────────────────────────────────────

/** หน้ารายงานสรุปเอกสาร · งบกำไรขาดทุน */
export function ReportsPage() {
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const { data: documents, loading } = useDocuments(companyId);
  const { data: payments } = usePayments(companyId);

  const rows = useMemo(
    () => documents.filter((d) => d.status !== "cancelled") as ReportRow[],
    [documents],
  );

  const [datePreset, setDatePreset] = useState<DateQuickPreset>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [groupTab, setGroupTab] = useState<ReportGroupTab>("all");
  const [typeDropdown, setTypeDropdown] = useState<DocumentType | "all">("all");
  const [drilldownType, setDrilldownType] = useState<DocumentType | null>(null);
  const [plMode, setPlMode] = useState(false);
  const [listExpanded, setListExpanded] = useState(true);
  const [sortColumn, setSortColumn] = useState<SortColumn>("issueDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [exportOpen, setExportOpen] = useState(false);

  const dateRange: DateRange = useMemo(() => {
    if (datePreset === "custom") {
      return {
        from: customFrom.trim() || null,
        to: customTo.trim() || null,
      };
    }
    return getDateRangeFromPreset(datePreset);
  }, [datePreset, customFrom, customTo]);

  const rangeLabel = formatRangeLabel(
    datePreset === "custom" ? customFrom : dateRange.from,
    datePreset === "custom" ? customTo : dateRange.to,
  );

  const filterParams: FilterParams = useMemo(
    () => ({
      dateRange,
      groupTab,
      typeDropdown,
      drilldownType,
    }),
    [dateRange, groupTab, typeDropdown, drilldownType],
  );

  const filteredDocs = useMemo(
    () => filterReportDocuments(rows, filterParams),
    [rows, filterParams],
  );

  const availableTypes = useMemo(() => getAvailableDocumentTypes(rows), [rows]);

  const summaryStats = useMemo(
    () => calculateSummaryStats(filteredDocs),
    [filteredDocs],
  );

  const byTypeRows = useMemo(
    () => groupByTypeSummary(filteredDocs),
    [filteredDocs],
  );

  const pnl = useMemo(() => calculatePnL(filteredDocs), [filteredDocs]);

  const sortedList = useMemo(() => {
    const copy = [...filteredDocs];
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      if (sortColumn === "issueDate") {
        const cmp = (a.issueDate ?? "").localeCompare(b.issueDate ?? "");
        if (cmp !== 0) return cmp * dir;
        return (b.docNumber ?? "").localeCompare(a.docNumber ?? "", "en") * dir;
      }
      if (sortColumn === "docNumber") {
        const cmp = (a.docNumber ?? "").localeCompare(b.docNumber ?? "", "en");
        if (cmp !== 0) return cmp * dir;
        return (b.issueDate ?? "").localeCompare(a.issueDate ?? "") * dir;
      }
      const at = a.total ?? 0;
      const bt = b.total ?? 0;
      if (at !== bt) return at > bt ? dir : -dir;
      return (b.issueDate ?? "").localeCompare(a.issueDate ?? "") * dir;
    });
    return copy;
  }, [filteredDocs, sortColumn, sortDir]);

  const handleSort = useCallback((c: SortColumn) => {
    setSortColumn((prev) => {
      if (prev === c) {
        setSortDir((d) => (d === "desc" ? "asc" : "desc"));
        return prev;
      }
      setSortDir(c === "issueDate" ? "desc" : "desc");
      return c;
    });
  }, []);

  const backShowAll = useCallback(() => {
    setDrilldownType(null);
    setTypeDropdown("all");
  }, []);

  const activeDrillType = activeSingleTypeFilter(filterParams);

  const onTypeRowClick = useCallback((t: DocumentType) => {
    setDrilldownType(t);
    setTypeDropdown(t);
  }, []);

  const pageFilterBase = useMemo<Omit<FilterParams, "dateRange">>(
    () => ({
      groupTab,
      typeDropdown,
      drilldownType,
    }),
    [groupTab, typeDropdown, drilldownType],
  );

  const initialExportReportType: ExportReportType = plMode
    ? "profit_loss"
    : "document_list";

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        title="รายงานสรุปเอกสาร"
        subtitle="สรุปเอกสาร · งบกำไรขาดทุน"
        actions={
          <Button
            type="button"
            className="h-10 shrink-0 gap-2 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
            onClick={() => setExportOpen(true)}
          >
            <Download className="size-4 shrink-0" />
            ส่งออก
          </Button>
        }
      />
      <ExportReportModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        allRows={rows}
        payments={payments}
        pageFilterBase={pageFilterBase}
        initialDatePreset={datePreset}
        initialCustomFrom={customFrom}
        initialCustomTo={customTo}
        initialReportType={initialExportReportType}
      />
      <div className="space-y-6 px-6 py-8">
        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : (
          <>
            <Card className="rounded-2xl border-border/80 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-4">
                  <DateRangeQuickFilter
                    preset={datePreset}
                    onPresetChange={setDatePreset}
                    customFrom={customFrom}
                    customTo={customTo}
                    onCustomChange={(from, to) => {
                      setCustomFrom(from);
                      setCustomTo(to);
                    }}
                  />
                  <DocumentGroupTabs value={groupTab} onChange={setGroupTab} />
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                  <select
                    className="h-10 rounded-xl border border-border bg-white px-3 text-sm shadow-sm"
                    value={typeDropdown}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDrilldownType(null);
                      if (v === "all") setTypeDropdown("all");
                      else setTypeDropdown(v as DocumentType);
                    }}
                  >
                    <option value="all">ทุกประเภท</option>
                    {availableTypes.map((t) => (
                      <option key={t} value={t}>
                        {DOC_TYPE_CONFIG[t as ExtDocType]?.label ?? t}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant={plMode ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "gap-2 rounded-xl",
                      plMode && "bg-slate-900 text-white hover:bg-slate-900",
                    )}
                    onClick={() => setPlMode((v) => !v)}
                  >
                    <LineChart className="size-4" />
                    งบกำไรขาดทุน
                  </Button>
                </div>
              </div>
            </Card>

            {filteredDocs.length === 0 ? (
              <Card className="rounded-2xl border-dashed border-border bg-white p-12 text-center shadow-sm">
                <CardTitle className="text-base font-semibold">
                  ยังไม่มีข้อมูลในช่วงเวลานี้
                </CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  ลองเปลี่ยนช่วงเวลา หรือประเภทเอกสาร
                </p>
              </Card>
            ) : (
              <>
                <ReportSummaryCards stats={summaryStats} />
                {!plMode ? (
                  <>
                    {byTypeRows.length > 0 ? (
                      <SummaryByTypeTable
                        rows={byTypeRows}
                        onTypeClick={onTypeRowClick}
                      />
                    ) : null}
                    <TypeDrilldownTagBar
                      drillType={activeDrillType}
                      onClear={backShowAll}
                      onBackAll={backShowAll}
                    />
                    <DocumentListCollapse
                      docs={sortedList}
                      expanded={listExpanded}
                      onToggle={() => setListExpanded((e) => !e)}
                      sortColumn={sortColumn}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                  </>
                ) : (
                  <ProfitLossCard pnl={pnl} rangeLabel={rangeLabel} />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export { ReportsPage as ReportPage };
