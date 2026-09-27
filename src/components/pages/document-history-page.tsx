"use client";

import { createRoot } from "react-dom/client";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import type { Timestamp } from "firebase/firestore";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FileDown,
  Link2,
  List,
  Printer,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { DataTable } from "@/components/business/data-table";
import { DocumentPreviewRenderer } from "@/components/business/document-preview-renderer";
import { StatusBadge } from "@/components/business/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCompanyStore } from "@/stores/company-store";
import { useDocuments } from "@/hooks/use-workspace-data";
import {
  DOC_TYPE_CONFIG,
  documentTypeSupportsPaymentStatus,
  type ExtDocType,
} from "@/lib/doc-types";
import {
  documentTypeLabels,
  getDashboardDocumentStatusDisplay,
  getDocumentStatusDisplay,
  paymentStatusLabels,
} from "@/lib/navigation";
import {
  exportPreviewContainerToPdf,
  printPreviewContainer,
} from "@/lib/document-preview-export";
import type { Step1FormValues } from "@/lib/schemas/document-draft";
import type { Step2FormValues } from "@/lib/schemas/document-step2";
import type { Step3FormValues } from "@/lib/schemas/document-step3";
import { cn } from "@/lib/utils";
import type { BusinessDocument, DocumentType } from "@/types";

type Row = BusinessDocument & { id: string };
type ViewMode = "list" | "group";
type TimeRange =
  | "all"
  | "today"
  | "this_week"
  | "this_month"
  | "last_3m"
  | "last_6m"
  | "this_year"
  | "custom";

/** สถานะชำระเงินตาม UI ประวัติเอกสาร */
type HistoryStatusFilter = "all" | "unpaid" | "partial" | "paid";

const HISTORY_PAYMENT_STATUS_FILTERS: HistoryStatusFilter[] = [
  "all",
  "unpaid",
  "partial",
  "paid",
];

const TIME_RANGE_VALUES: TimeRange[] = [
  "all",
  "today",
  "this_week",
  "this_month",
  "last_3m",
  "last_6m",
  "this_year",
  "custom",
];

function isTimeRange(v: string): v is TimeRange {
  return (TIME_RANGE_VALUES as string[]).includes(v);
}

const ALL_DOC_TYPES = Object.keys(documentTypeLabels) as DocumentType[];

const DOC_TYPE_BADGE: Record<string, string> = {
  quotation: "border bg-sky-50 text-sky-900 border-sky-200",
  sales_order: "border bg-violet-50 text-violet-900 border-violet-200",
  invoice: "border bg-indigo-50 text-indigo-900 border-indigo-200",
  billing_note: "border bg-pink-50 text-pink-900 border-pink-200",
  tax_invoice: "border bg-orange-50 text-orange-900 border-orange-200",
  receipt: "border bg-emerald-50 text-emerald-900 border-emerald-200",
  delivery_order: "border bg-purple-50 text-purple-900 border-purple-200",
  credit_note: "border bg-red-50 text-red-900 border-red-200",
  purchase_order: "border bg-cyan-50 text-cyan-900 border-cyan-200",
  purchase_request: "border bg-amber-50 text-amber-900 border-amber-200",
  goods_receipt: "border bg-teal-50 text-teal-900 border-teal-200",
  payment_voucher: "border bg-rose-50 text-rose-900 border-rose-200",
};

function selectTypeFilterLabel(value: unknown): string {
  if (value == null || value === "") return "ทุกประเภท";
  const v = String(value);
  if (v === "all") return "ทุกประเภท";
  return documentTypeLabels[v] ?? v;
}

function selectStatusFilterLabel(value: unknown): string {
  if (value == null || value === "") return "ทุกสถานะ";
  const v = String(value);
  if (v === "all") return "ทุกสถานะ";
  return paymentStatusLabels[v] ?? v;
}

function selectTimeRangeLabel(value: unknown): string {
  const v = String(value ?? "all");
  switch (v as TimeRange) {
    case "all":
      return "ทุกช่วงเวลา";
    case "today":
      return "วันนี้";
    case "this_week":
      return "สัปดาห์นี้";
    case "this_month":
      return "เดือนนี้";
    case "last_3m":
      return "3 เดือน";
    case "last_6m":
      return "6 เดือน";
    case "this_year":
      return "ปีนี้";
    case "custom":
      return "กำหนดเอง…";
    default:
      return "ทุกช่วงเวลา";
  }
}

function ymdLocal(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function startOfWeekMonday(ref: Date): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addCalendarMonths(ref: Date, deltaMonths: number): Date {
  const d = new Date(
    ref.getFullYear(),
    ref.getMonth() + deltaMonths,
    ref.getDate(),
  );
  return d;
}

function historyRowStatusKey(d: Row): string {
  const disp = documentTypeSupportsPaymentStatus(d.type)
    ? getDashboardDocumentStatusDisplay(d)
    : getDocumentStatusDisplay(d);
  return disp.status;
}

function partnerLabel(d: Row): string {
  const role = DOC_TYPE_CONFIG[d.type as ExtDocType]?.partnerRole;
  if (role === "vendor") return d.vendorName?.trim() || "—";
  return d.customerName?.trim() || "—";
}

function createdAtMs(d: Row): number {
  const c = d.createdAt as Timestamp | undefined;
  if (c && typeof c.toMillis === "function") return c.toMillis();
  return 0;
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

function chainKey(d: Row): string {
  return d.chainId?.trim() ? d.chainId.trim() : d.id;
}

type ChainGroup = {
  key: string;
  docs: Row[];
  oldestFirst: Row[];
  latest: Row;
};

function buildChainGroups(docs: Row[]): ChainGroup[] {
  const m = new Map<string, Row[]>();
  for (const d of docs) {
    const k = chainKey(d);
    m.set(k, [...(m.get(k) ?? []), d]);
  }
  const out: ChainGroup[] = [];
  for (const [key, arr] of m) {
    const oldestFirst = [...arr].sort(
      (a, b) => createdAtMs(a) - createdAtMs(b),
    );
    const latest = oldestFirst[oldestFirst.length - 1]!;
    out.push({ key, docs: arr, oldestFirst, latest });
  }
  out.sort((a, b) => createdAtMs(b.latest) - createdAtMs(a.latest));
  return out;
}

function timeRangeBounds(
  range: TimeRange,
  custom: { from: string; to: string },
): { from?: string; to?: string } {
  const n = new Date();
  const today = ymdLocal(n);
  if (range === "all") return {};
  if (range === "today") return { from: today, to: today };
  if (range === "this_week") {
    const start = startOfWeekMonday(n);
    return { from: ymdLocal(start), to: today };
  }
  if (range === "this_month") {
    const first = new Date(n.getFullYear(), n.getMonth(), 1);
    return { from: ymdLocal(first), to: today };
  }
  if (range === "last_3m") {
    const fromD = addCalendarMonths(n, -3);
    return { from: ymdLocal(fromD), to: today };
  }
  if (range === "last_6m") {
    const fromD = addCalendarMonths(n, -6);
    return { from: ymdLocal(fromD), to: today };
  }
  if (range === "this_year") {
    const first = new Date(n.getFullYear(), 0, 1);
    return { from: ymdLocal(first), to: today };
  }
  if (range === "custom") {
    let cf = custom.from.trim();
    let ct = custom.to.trim();
    if (!cf || !ct) return {};
    if (cf > ct) [cf, ct] = [ct, cf];
    return { from: cf, to: ct };
  }
  return {};
}

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportCsv(rows: Row[]) {
  const headers = ["เลขที่", "ประเภท", "วันที่", "ลูกค้า", "ยอดรวม", "สถานะ"];
  const lines = [
    headers.join(","),
    ...rows.map((r) => {
      const disp = documentTypeSupportsPaymentStatus(r.type)
        ? getDashboardDocumentStatusDisplay(r)
        : getDocumentStatusDisplay(r);
      return [
        csvEscape(r.docNumber),
        csvEscape(documentTypeLabels[r.type] ?? r.type),
        csvEscape(r.issueDate ?? ""),
        csvEscape(partnerLabel(r)),
        csvEscape(String(r.total ?? 0)),
        csvEscape(disp.label),
      ].join(",");
    }),
  ];
  const blob = new Blob(["\ufeff" + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ประวัติเอกสาร-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast.success("ส่งออก CSV แล้ว");
}

async function flushPaint(): Promise<void> {
  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );
}

async function exportRowsPreview(
  rows: Row[],
  mode: "pdf" | "print",
): Promise<{ okCount: number; missing: Row[] }> {
  const exportable = rows.filter((row) => row.previewData?.step1Data);
  const missing = rows.filter((row) => !row.previewData?.step1Data);
  if (exportable.length === 0) {
    return { okCount: 0, missing };
  }

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-12000px;top:0;z-index:-1;";
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    root.render(
      <div className="space-y-0 bg-surface">
        {exportable.map((row) => {
          const p = row.previewData;
          return (
            <DocumentPreviewRenderer
              key={row.id}
              step1Data={p?.step1Data as Step1FormValues}
              step2Data={(p?.step2Data as unknown as Step2FormValues) ?? null}
              step3Data={(p?.step3Data as unknown as Step3FormValues) ?? null}
              className="overflow-visible rounded-none bg-surface p-0"
              pageClassName="document-history-export-page border-0 shadow-none"
            />
          );
        })}
      </div>,
    );
    await flushPaint();
    const target = host.firstElementChild as HTMLElement | null;
    if (!target) return { okCount: 0, missing };
    if (mode === "pdf") {
      const filename =
        exportable.length === 1
          ? exportable[0]?.docNumber || "document"
          : `documents-${new Date().toISOString().slice(0, 10)}`;
      await exportPreviewContainerToPdf(target, filename);
    } else {
      await printPreviewContainer(target);
    }
    return { okCount: exportable.length, missing };
  } finally {
    root.unmount();
    host.remove();
  }
}

function HistoryStatusCell({ doc }: { doc: Row }) {
  const disp = documentTypeSupportsPaymentStatus(doc.type)
    ? getDashboardDocumentStatusDisplay(doc)
    : getDocumentStatusDisplay(doc);
  return <StatusBadge status={disp.status} label={disp.label} />;
}

export function DocumentHistoryPage() {
  const router = useRouter();
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const { data, loading } = useDocuments(companyId);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [customRangeFrom, setCustomRangeFrom] = useState("");
  const [customRangeTo, setCustomRangeTo] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [expandedChains, setExpandedChains] = useState<Set<string>>(
    () => new Set(),
  );
  const [bulkBusy, setBulkBusy] = useState(false);

  const { from: trFrom, to: trTo } = timeRangeBounds(timeRange, {
    from: customRangeFrom,
    to: customRangeTo,
  });

  const filtered = useMemo(() => {
    const passesNonType = (d: Row) => {
      const hay = `${d.docNumber} ${partnerLabel(d)}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (statusFilter !== "all" && historyRowStatusKey(d) !== statusFilter)
        return false;
      const idate = d.issueDate ?? "";
      if (trFrom && idate && idate < trFrom) return false;
      if (trTo && idate && idate > trTo) return false;
      if (trFrom && !idate) return false;
      return true;
    };

    if (typeFilter === "all") {
      return data.filter(passesNonType) as Row[];
    }

    const hits = data.filter(
      (d) => passesNonType(d) && d.type === typeFilter,
    );
    const keys = new Set(hits.map(chainKey));
    return data.filter((d) => keys.has(chainKey(d))) as Row[];
  }, [data, q, statusFilter, trFrom, trTo, typeFilter]);

  const chainGroups = useMemo(() => buildChainGroups(filtered), [filtered]);

  const linkedChainCount = useMemo(() => {
    return chainGroups.filter((g) => g.docs.length >= 2).length;
  }, [chainGroups]);

  const summaryList = useMemo(() => {
    const count = filtered.length;
    const totalSum = filtered.reduce((s, d) => s + (d.total ?? 0), 0);
    return { count, totalSum };
  }, [filtered]);

  const summaryGroup = useMemo(() => {
    const docCount = filtered.length;
    const chainCount = chainGroups.length;
    const totalSum = chainGroups.reduce((s, g) => s + (g.latest.total ?? 0), 0);
    return { docCount, chainCount, totalSum };
  }, [chainGroups, filtered.length]);

  const selectedRows = useMemo(() => {
    return filtered.filter((r) => rowSelection[r.id]);
  }, [filtered, rowSelection]);

  const selectedCount = selectedRows.length;

  const toggleChain = useCallback((key: string) => {
    setExpandedChains((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleExportCsv = useCallback(() => exportCsv(filtered), [filtered]);

  const handleBulkPdf = useCallback(async () => {
    if (selectedRows.length === 0) return;
    setBulkBusy(true);
    try {
      const { okCount, missing } = await exportRowsPreview(selectedRows, "pdf");
      for (const row of missing) {
        toast.error(
          `${row.docNumber}: ไม่มีข้อมูลพรีวิว — เปิดหน้ารายละเอียดเพื่อส่งออก`,
        );
      }
      if (okCount > 0) {
        toast.success(
          okCount > 1
            ? `ดาวน์โหลด PDF รวมแล้ว ${okCount} เอกสาร`
            : "ดาวน์โหลด PDF แล้ว",
        );
      }
    } catch (e) {
      console.error(e);
      toast.error("ส่งออก PDF ไม่สำเร็จ");
    } finally {
      setBulkBusy(false);
    }
  }, [selectedRows]);

  const handleBulkPrint = useCallback(async () => {
    if (selectedRows.length === 0) return;
    setBulkBusy(true);
    try {
      const { missing } = await exportRowsPreview(selectedRows, "print");
      for (const row of missing) {
        toast.error(
          `${row.docNumber}: ไม่มีข้อมูลพรีวิว — เปิดหน้ารายละเอียดเพื่อพิมพ์`,
        );
      }
    } catch (e) {
      console.error(e);
      toast.error("พิมพ์ไม่สำเร็จ");
    } finally {
      setBulkBusy(false);
    }
  }, [selectedRows]);

  const handleBulkDelete = useCallback(() => {
    toast.message("ลบเอกสารหมู่ — ยังไม่เปิดใช้งานในระบบ");
  }, []);

  const columns: ColumnDef<Row>[] = useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={
              table.getIsSomePageRowsSelected() &&
              !table.getIsAllPageRowsSelected()
            }
            onCheckedChange={(c) => table.toggleAllPageRowsSelected(c === true)}
            aria-label="เลือกทั้งหมดในหน้านี้"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(c) => row.toggleSelected(c === true)}
            aria-label={`เลือก ${row.original.docNumber}`}
          />
        ),
        size: 40,
      },
      {
        accessorKey: "docNumber",
        header: "เลขที่",
        cell: ({ row }) => (
          <Link
            href={`/documents/detail?id=${encodeURIComponent(row.original.id)}`}
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            {row.original.docNumber}
          </Link>
        ),
      },
      {
        accessorKey: "type",
        header: "ประเภท",
        cell: ({ row }) => {
          const t = row.original.type;
          const cls =
            DOC_TYPE_BADGE[t] ??
            "border bg-surface-secondary text-foreground border-border";
          return (
            <Badge
              variant="outline"
              className={cn("rounded-md px-2 py-0.5 text-xs font-medium", cls)}
            >
              {documentTypeLabels[t] ?? t}
            </Badge>
          );
        },
      },
      {
        accessorKey: "issueDate",
        header: "วันที่",
        cell: ({ row }) => formatIssueDateShort(row.original.issueDate),
      },
      {
        accessorKey: "customerName",
        header: "ลูกค้า",
        cell: ({ row }) => partnerLabel(row.original),
      },
      {
        accessorKey: "total",
        header: () => <div className="text-right">ยอดรวม</div>,
        cell: ({ row }) => (
          <div className="text-right font-medium tabular-nums">
            {(row.original.total ?? 0).toLocaleString("th-TH", {
              minimumFractionDigits: 2,
            })}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "สถานะ",
        cell: ({ row }) => <HistoryStatusCell doc={row.original} />,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const id = row.original.id;
          const detail = `/documents/detail?id=${encodeURIComponent(id)}`;
          return (
            <div className="flex items-center justify-end gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 rounded-lg text-muted-foreground"
                aria-label="ดูรายละเอียด"
                onClick={() => router.push(detail)}
              >
                <Eye className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 rounded-lg text-muted-foreground"
                aria-label="พิมพ์"
                disabled={bulkBusy}
                onClick={() => void exportRowsPreview([row.original], "print")}
              >
                <Printer className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 rounded-lg text-muted-foreground"
                aria-label="ดาวน์โหลด PDF"
                disabled={bulkBusy}
                onClick={() => void exportRowsPreview([row.original], "pdf")}
              >
                <FileDown className="size-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    [bulkBusy, router],
  );

  return (
    <div className="min-h-screen bg-transparent">
      <AppHeader
        title="ประวัติเอกสาร"
        subtitle="ดูและจัดการเอกสารที่บันทึกไว้"
      />

      <div className="space-y-6 px-6 py-8">
        <Card className="rounded-2xl border-border/80 bg-surface shadow-sm">
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative max-w-xl flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ค้นหาเลขที่ / ชื่อลูกค้า…"
                  className="h-11 rounded-xl border-border/80 bg-field pr-3 pl-10"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={typeFilter}
                  onValueChange={(v) => {
                    if (v) setTypeFilter(v);
                  }}
                >
                  <SelectTrigger className="h-11 w-[160px] rounded-xl">
                    <SelectValue placeholder="ประเภท">
                      {(v) => selectTypeFilterLabel(v)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกประเภท</SelectItem>
                    {ALL_DOC_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {documentTypeLabels[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    if (
                      v === "all" ||
                      v === "unpaid" ||
                      v === "partial" ||
                      v === "paid"
                    )
                      setStatusFilter(v);
                  }}
                >
                  <SelectTrigger className="h-11 w-[160px] rounded-xl">
                    <SelectValue placeholder="สถานะ">
                      {(v) => selectStatusFilterLabel(v)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {HISTORY_PAYMENT_STATUS_FILTERS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k === "all"
                          ? "ทุกสถานะ"
                          : (paymentStatusLabels[k] ?? k)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={timeRange}
                  onValueChange={(v) => {
                    if (v && isTimeRange(v)) setTimeRange(v);
                  }}
                >
                  <SelectTrigger className="h-11 w-[172px] rounded-xl">
                    <SelectValue placeholder="ช่วงเวลา">
                      {(v) => selectTimeRangeLabel(v)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกช่วงเวลา</SelectItem>
                    <SelectItem value="today">วันนี้</SelectItem>
                    <SelectItem value="this_week">สัปดาห์นี้</SelectItem>
                    <SelectItem value="this_month">เดือนนี้</SelectItem>
                    <SelectItem value="last_3m">3 เดือน</SelectItem>
                    <SelectItem value="last_6m">6 เดือน</SelectItem>
                    <SelectItem value="this_year">ปีนี้</SelectItem>
                    <SelectItem value="custom">กำหนดเอง…</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 gap-2 rounded-xl"
                  onClick={handleExportCsv}
                  disabled={filtered.length === 0}
                >
                  <Download className="size-4" />
                  ส่งออก CSV
                </Button>
              </div>
            </div>

            {timeRange === "custom" ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border/70 bg-field px-3 py-2.5">
                <span className="text-xs font-medium text-muted-foreground">
                  ช่วงกำหนดเอง
                </span>
                <Input
                  type="date"
                  className="h-9 w-[155px] rounded-lg bg-surface"
                  value={customRangeFrom}
                  onChange={(e) => setCustomRangeFrom(e.target.value)}
                  aria-label="วันที่เริ่ม"
                />
                <span className="text-xs text-muted-foreground">ถึง</span>
                <Input
                  type="date"
                  className="h-9 w-[155px] rounded-lg bg-surface"
                  value={customRangeTo}
                  onChange={(e) => setCustomRangeTo(e.target.value)}
                  aria-label="วันที่สิ้นสุด"
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
                เลขที่รันแยกตามประเภทเอกสาร (เช่น
                ใบกำกับภาษีกับใบเสร็จ/ใบกำกับเป็นคนละชุด) —
                รายการเรียงตามวันที่เอกสาร ไม่ใช่ตามเลขลำดับ
              </p>
              <div className="flex shrink-0 items-center gap-1 rounded-xl border border-border/80 bg-surface-secondary p-1">
                <Button
                  type="button"
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-9 gap-2 rounded-lg",
                    viewMode === "list" &&
                      "bg-accent text-accent-foreground hover:bg-accent-hover",
                  )}
                  onClick={() => setViewMode("list")}
                >
                  <List className="size-4" />
                  รายการ
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "group" ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-9 gap-2 rounded-lg",
                    viewMode === "group" &&
                      "bg-accent text-accent-foreground hover:bg-accent-hover",
                  )}
                  onClick={() => setViewMode("group")}
                >
                  <Link2 className="size-4" />
                  ชุดเอกสาร
                  {chainGroups.length > 0 ? (
                    <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-surface/20 text-[11px] font-semibold">
                      {chainGroups.length}
                    </span>
                  ) : null}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div
          className={cn(
            "grid gap-4",
            viewMode === "group" ? "md:grid-cols-3" : "md:grid-cols-2",
          )}
        >
          <div className="rounded-2xl border border-border/70 bg-surface p-6 shadow-sm">
            <p className="text-3xl font-bold tabular-nums">
              {viewMode === "list" ? summaryList.count : summaryGroup.docCount}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">เอกสารทั้งหมด</p>
          </div>
          {viewMode === "group" ? (
            <div className="rounded-2xl border border-border/70 bg-surface p-6 shadow-sm">
              <p className="text-3xl font-bold tabular-nums">
                {summaryGroup.chainCount}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">ชุดเอกสาร</p>
            </div>
          ) : null}
          <div
            className={cn(
              "rounded-2xl border border-border/70 bg-surface p-6 shadow-sm",
              viewMode === "list" && "md:col-span-1",
            )}
          >
            <p className="text-3xl font-bold tabular-nums text-success">
              {(viewMode === "list"
                ? summaryList.totalSum
                : summaryGroup.totalSum
              ).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">ยอดรวม</p>
          </div>
        </div>

        {viewMode === "list" && linkedChainCount > 0 ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-accent/20 bg-accent-soft px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-accent-soft-foreground">
              คุณมี {linkedChainCount} ชุดเอกสารเชื่อมโยง — ลองเปลี่ยนมุมมองเป็น
              &quot;ชุดเอกสาร&quot; เพื่อดูเอกสารที่สร้างต่อเนื่องกัน
            </p>
            <Button
              type="button"
              size="sm"
              className="shrink-0 gap-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent-hover"
              onClick={() => setViewMode("group")}
            >
              <Link2 className="size-4" />
              ดูชุดเอกสาร
            </Button>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : viewMode === "list" ? (
          <DataTable
            columns={columns}
            data={filtered}
            pageSize={8}
            enableRowSelection
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
          />
        ) : (
          <div className="space-y-3">
            {chainGroups.length === 0 ? (
              <div className="rounded-2xl border border-border/80 bg-surface py-16 text-center text-sm text-muted-foreground shadow-sm">
                ไม่พบข้อมูล
              </div>
            ) : (
              chainGroups.map((group) => {
                const open = expandedChains.has(group.key);
                const { latest, oldestFirst } = group;
                return (
                  <div
                    key={group.key}
                    className="overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex w-full items-center gap-3 border-b border-border/60 bg-surface-secondary px-4 py-4">
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={`chain-panel-${group.key}`}
                        id={`chain-heading-${group.key}`}
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        onClick={() => toggleChain(group.key)}
                      >
                        {open ? (
                          <ChevronDown className="size-5" />
                        ) : (
                          <ChevronRight className="size-5" />
                        )}
                      </button>
                      <button
                        type="button"
                        className="min-w-0 flex-1 rounded-lg py-0.5 text-left transition-colors hover:bg-surface-secondary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        onClick={() => toggleChain(group.key)}
                      >
                        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm font-medium">
                          {oldestFirst.map((d, i) => (
                            <span
                              key={d.id}
                              className="flex items-center gap-1"
                            >
                              {i > 0 ? (
                                <ArrowRight className="mx-0.5 size-3.5 shrink-0 text-muted-foreground" />
                              ) : null}
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-md px-2 py-0.5 text-xs font-medium",
                                  DOC_TYPE_BADGE[d.type] ??
                                    "border bg-surface-secondary text-foreground border-border",
                                )}
                              >
                                {documentTypeLabels[d.type]} {d.docNumber}
                              </Badge>
                            </span>
                          ))}
                        </div>
                      </button>
                      <div className="hidden shrink-0 items-center gap-6 text-sm sm:flex">
                        <span className="max-w-[140px] truncate text-muted-foreground">
                          {partnerLabel(latest)}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatIssueDateShort(latest.issueDate)}
                        </span>
                        <span className="text-right font-semibold tabular-nums">
                          {(latest.total ?? 0).toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-9"
                          aria-label="ดูเอกสารล่าสุด"
                          onClick={() =>
                            router.push(
                              `/documents/detail?id=${encodeURIComponent(latest.id)}`,
                            )
                          }
                        >
                          <Eye className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <div
                      id={`chain-panel-${group.key}`}
                      role="region"
                      aria-labelledby={`chain-heading-${group.key}`}
                      className={cn(
                        "grid transition-[grid-template-rows] duration-200 ease-out",
                        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="overflow-x-auto border-t border-border/60">
                          <table className="w-full min-w-[720px] text-left text-sm">
                            <thead className="sticky top-0 z-10 bg-surface text-xs font-medium text-muted-foreground shadow-[0_1px_0_0_hsl(var(--border))]">
                              <tr>
                                <th className="px-4 py-3">เลขที่</th>
                                <th className="px-4 py-3">ประเภท</th>
                                <th className="px-4 py-3">วันที่</th>
                                <th className="px-4 py-3 text-right">ยอดรวม</th>
                                <th className="px-4 py-3">สถานะ</th>
                                <th className="px-4 py-3 text-right" />
                              </tr>
                            </thead>
                            <tbody>
                              {oldestFirst.map((d) => (
                                <tr
                                  key={d.id}
                                  className="border-b border-border/50 transition-colors hover:bg-surface-secondary"
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      {d.id === latest.id ? (
                                        <Link2 className="size-3.5 shrink-0 text-sky-600" />
                                      ) : (
                                        <span className="inline-block w-3.5" />
                                      )}
                                      <Link
                                        href={`/documents/detail?id=${encodeURIComponent(d.id)}`}
                                        className="font-medium text-primary underline-offset-2 hover:underline"
                                      >
                                        {d.docNumber}
                                      </Link>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "rounded-md px-2 py-0.5 text-xs font-medium",
                                        DOC_TYPE_BADGE[d.type] ??
                                          "border bg-surface-secondary text-foreground border-border",
                                      )}
                                    >
                                      {documentTypeLabels[d.type] ?? d.type}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                                    {formatIssueDateShort(d.issueDate)}
                                  </td>
                                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                                    {(d.total ?? 0).toLocaleString("th-TH", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </td>
                                  <td className="px-4 py-3">
                                    <HistoryStatusCell doc={d} />
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex justify-end gap-0.5">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-9 text-muted-foreground"
                                        onClick={() =>
                                          router.push(
                                            `/documents/detail?id=${encodeURIComponent(d.id)}`,
                                          )
                                        }
                                      >
                                        <Eye className="size-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-9 text-muted-foreground"
                                        disabled={bulkBusy}
                                        onClick={() =>
                                          void exportRowsPreview([d], "print")
                                        }
                                      >
                                        <Printer className="size-4" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {viewMode === "list" && selectedCount > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-full border border-separator bg-overlay px-5 py-3 text-sm text-overlay-foreground shadow-overlay">
            <span className="font-medium">
              เลือกแล้ว {selectedCount} รายการ
            </span>
            <div className="mx-1 hidden h-5 w-px bg-surface/20 sm:block" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2 rounded-full text-white hover:bg-surface/10 hover:text-white"
              disabled={bulkBusy}
              onClick={() => void handleBulkPrint()}
            >
              <Printer className="size-4" />
              พิมพ์
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2 rounded-full text-white hover:bg-surface/10 hover:text-white"
              disabled={bulkBusy}
              onClick={() => void handleBulkPdf()}
            >
              <FileDown className="size-4" />
              ดาวน์โหลด PDF
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-2 rounded-full bg-red-600 text-white hover:bg-red-600/90"
              onClick={handleBulkDelete}
            >
              <Trash2 className="size-4" />
              ลบที่เลือก
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
