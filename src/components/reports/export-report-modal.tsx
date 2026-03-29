"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownCircle,
  Calendar,
  Download,
  FileText,
  LineChart,
  Printer,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  buildExportDocumentScope,
  buildExportFilename,
  exportDocumentListCSV,
  exportProfitLossCSV,
  exportPurchaseTaxCSV,
  exportSalesTaxCSV,
  getDateRangeLabel,
  renderDocumentListPrintView,
  renderProfitLossPrintView,
  renderPurchaseTaxPrintView,
  renderSalesTaxPrintView,
  resolveDateRangeFromModal,
  resolveFilenameDateRange,
  type ExportReportType,
} from "@/lib/reports/report-export";
import {
  getDateRangeFromPreset,
  type DateQuickPreset,
  type FilterParams,
  type ReportRow,
} from "@/lib/reports/document-summary-report";
import { cn } from "@/lib/utils";
import type { Payment } from "@/types";

// ─── QuickRangeSelector ─────────────────────────────────────────────────────

const RANGE_PILLS: { key: DateQuickPreset; label: string }[] = [
  { key: "this_month", label: "เดือนนี้" },
  { key: "last_3m", label: "3 เดือน" },
  { key: "this_year", label: "ปีนี้" },
  { key: "all", label: "ทั้งหมด" },
  { key: "custom", label: "กำหนดเอง" },
];

function QuickRangeSelector({
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
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">ช่วงเวลา</p>
      <div className="flex flex-wrap items-center gap-2">
        <Calendar className="size-4 shrink-0 text-muted-foreground" />
        {RANGE_PILLS.map(({ key, label }) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={preset === key ? "default" : "outline"}
            className={cn(
              "rounded-full px-4",
              preset === key && "bg-slate-900 text-white hover:bg-slate-900",
            )}
            onClick={() => onPresetChange(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      {preset === "custom" ? (
        <div className="flex flex-wrap items-center gap-2 pl-7">
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

// ─── ReportTypeCardSelector ────────────────────────────────────────────────

const REPORT_CARDS: {
  id: ExportReportType;
  title: string;
  subtitle: string;
  icon: typeof FileText;
}[] = [
  {
    id: "document_list",
    title: "รายการเอกสาร",
    subtitle: "สรุปเอกสารทั้งหมดตามช่วงเวลา",
    icon: FileText,
  },
  {
    id: "profit_loss",
    title: "งบกำไรขาดทุน",
    subtitle: "รายได้ ต้นทุน ค่าใช้จ่าย กำไร",
    icon: LineChart,
  },
  {
    id: "sales_tax",
    title: "รายงานภาษีขาย",
    subtitle: "ตามรูปแบบ ภ.พ.30 สรรพากร",
    icon: Receipt,
  },
  {
    id: "purchase_tax",
    title: "รายงานภาษีซื้อ",
    subtitle: "ตามรูปแบบ ภ.พ.30 สรรพากร",
    icon: ArrowDownCircle,
  },
];

function ReportTypeCardSelector({
  value,
  onChange,
}: {
  value: ExportReportType;
  onChange: (v: ExportReportType) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">ประเภทรายงาน</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {REPORT_CARDS.map(({ id, title, subtitle, icon: Icon }) => {
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                "flex gap-3 rounded-2xl border-2 p-4 text-left transition-colors",
                selected
                  ? "border-slate-900 bg-slate-50/80 shadow-sm"
                  : "border-border/80 bg-white hover:bg-muted/30",
              )}
            >
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl",
                  selected ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700",
                )}
              >
                <Icon className="size-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="font-semibold text-foreground">{title}</p>
                <p className="text-xs leading-snug text-muted-foreground">
                  {subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

function downloadTextFile(filename: string, content: string, mime: string) {
  const bom = "\uFEFF";
  const blob = new Blob([bom + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function openPrintPreview(html: string) {
  const w = window.open("", "_blank");
  if (!w) {
    toast.error("ไม่สามารถเปิดหน้าต่างพิมพ์ได้ — อนุญาตป๊อปอัปในเบราว์เซอร์");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 250);
}

export type ExportReportModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allRows: ReportRow[];
  payments: Payment[];
  pageFilterBase: Omit<FilterParams, "dateRange">;
  initialDatePreset: DateQuickPreset;
  initialCustomFrom: string;
  initialCustomTo: string;
  initialReportType: ExportReportType;
};

export function ExportReportModal({
  open,
  onOpenChange,
  allRows,
  payments,
  pageFilterBase,
  initialDatePreset,
  initialCustomFrom,
  initialCustomTo,
  initialReportType,
}: ExportReportModalProps) {
  const [datePreset, setDatePreset] =
    useState<DateQuickPreset>(initialDatePreset);
  const [customFrom, setCustomFrom] = useState(initialCustomFrom);
  const [customTo, setCustomTo] = useState(initialCustomTo);
  const [reportType, setReportType] =
    useState<ExportReportType>(initialReportType);

  useEffect(() => {
    if (!open) return;
    setDatePreset(initialDatePreset);
    setCustomFrom(initialCustomFrom);
    setCustomTo(initialCustomTo);
    setReportType(initialReportType);
  }, [
    open,
    initialDatePreset,
    initialCustomFrom,
    initialCustomTo,
    initialReportType,
  ]);

  const exportRange = useMemo(
    () =>
      resolveDateRangeFromModal(
        datePreset,
        customFrom,
        customTo,
        getDateRangeFromPreset,
      ),
    [datePreset, customFrom, customTo],
  );

  const scopedDocs = useMemo(
    () => buildExportDocumentScope(allRows, pageFilterBase, exportRange),
    [allRows, pageFilterBase, exportRange],
  );

  const rangeLabel = getDateRangeLabel(exportRange.from, exportRange.to);
  const { from: fnameFrom, to: fnameTo } = resolveFilenameDateRange(
    exportRange,
    scopedDocs,
  );

  const runCsvExport = () => {
    if (datePreset === "custom" && (!customFrom.trim() || !customTo.trim())) {
      toast.error("กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด");
      return;
    }

    let csv = "";
    switch (reportType) {
      case "document_list":
        csv = exportDocumentListCSV(scopedDocs, payments);
        break;
      case "profit_loss":
        csv = exportProfitLossCSV(scopedDocs);
        break;
      case "sales_tax":
        csv = exportSalesTaxCSV(scopedDocs);
        break;
      case "purchase_tax":
        csv = exportPurchaseTaxCSV(scopedDocs);
        break;
    }
    const name = buildExportFilename(reportType, fnameFrom, fnameTo, "csv");
    downloadTextFile(name, csv, "text/csv;charset=utf-8");
    toast.success("ดาวน์โหลด CSV แล้ว");
  };

  const runPrintExport = () => {
    if (datePreset === "custom" && (!customFrom.trim() || !customTo.trim())) {
      toast.error("กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด");
      return;
    }

    let html = "";
    switch (reportType) {
      case "document_list":
        html = renderDocumentListPrintView(scopedDocs, payments, rangeLabel);
        break;
      case "profit_loss":
        html = renderProfitLossPrintView(scopedDocs, rangeLabel);
        break;
      case "sales_tax":
        html = renderSalesTaxPrintView(scopedDocs, rangeLabel);
        break;
      case "purchase_tax":
        html = renderPurchaseTaxPrintView(scopedDocs, rangeLabel);
        break;
    }
    openPrintPreview(html);
    toast.message("เปิดหน้าพิมพ์แล้ว — เลือก «บันทึกเป็น PDF» ในกล่องพิมพ์ได้");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-h-[min(90vh,900px)] gap-0 overflow-y-auto rounded-3xl border-border/80 p-0 sm:max-w-2xl"
      >
        <DialogHeader className="border-b border-border/70 px-6 py-5">
          <DialogTitle className="text-lg font-semibold">
            ส่งออกรายงาน
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-8 px-6 py-6">
          <QuickRangeSelector
            preset={datePreset}
            onPresetChange={setDatePreset}
            customFrom={customFrom}
            customTo={customTo}
            onCustomChange={(from, to) => {
              setCustomFrom(from);
              setCustomTo(to);
            }}
          />

          <ReportTypeCardSelector value={reportType} onChange={setReportType} />
        </div>

        <div className="flex flex-col gap-3 border-t border-border/70 bg-muted/30 px-6 py-5 sm:flex-row sm:justify-stretch">
          <Button
            type="button"
            size="lg"
            className="h-12 flex-1 gap-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
            onClick={runCsvExport}
          >
            <Download className="size-4 shrink-0" />
            ดาวน์โหลด CSV
          </Button>
          <Button
            type="button"
            size="lg"
            variant="secondary"
            className="h-12 flex-1 gap-2 rounded-xl border border-border bg-white"
            onClick={runPrintExport}
          >
            <Printer className="size-4 shrink-0" />
            พิมพ์ / PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
