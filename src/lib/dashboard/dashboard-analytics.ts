import {
  DOC_TYPE_CONFIG,
  documentTypeSupportsPaymentStatus,
  type ExtDocType,
  type FlowType,
} from "@/lib/doc-types";
import { getNextDocumentActions } from "@/lib/document-flow";
import { paymentStatusLabels } from "@/lib/navigation";
import {
  calcRowTotal,
  type ItemRow,
  type Step2FormValues,
} from "@/lib/schemas/document-step2";
import type { BusinessDocument, DocumentType } from "@/types";

export type DashboardDatePreset =
  | "today"
  | "this_week"
  | "this_month"
  | "last_3m"
  | "this_year"
  | "custom";

export type DashboardFlowFilter = FlowType;

export type DashboardFilterState = {
  datePreset: DashboardDatePreset;
  customFrom: string;
  customTo: string;
  flow: DashboardFlowFilter;
  docType: DocumentType | "all";
};

export type DashDoc = BusinessDocument & { id: string };

export const DASHBOARD_PRESET_LABELS: Record<DashboardDatePreset, string> = {
  today: "วันนี้",
  this_week: "อาทิตย์นี้",
  this_month: "เดือนนี้",
  last_3m: "3 เดือน",
  this_year: "ปีนี้",
  custom: "กำหนดเอง",
};

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfWeekMonday(ref: Date): Date {
  const day = ref.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const x = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  x.setDate(x.getDate() + diff);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function getDashboardRange(
  preset: DashboardDatePreset,
  customFrom: string,
  customTo: string,
): { from: string; to: string } {
  const now = new Date();
  if (preset === "custom") {
    return {
      from: customFrom.trim() || ymd(now),
      to: customTo.trim() || ymd(now),
    };
  }
  if (preset === "today") {
    const t = ymd(now);
    return { from: t, to: t };
  }
  if (preset === "this_week") {
    const a = startOfWeekMonday(now);
    return { from: ymd(a), to: ymd(now) };
  }
  if (preset === "this_month") {
    const a = startOfMonth(now);
    const b = endOfMonth(now);
    return { from: ymd(a), to: ymd(b) };
  }
  if (preset === "last_3m") {
    const start = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 2, 1));
    return { from: ymd(start), to: ymd(now) };
  }
  if (preset === "this_year") {
    const a = new Date(now.getFullYear(), 0, 1);
    const b = new Date(now.getFullYear(), 11, 31);
    return { from: ymd(a), to: ymd(b) };
  }
  const t = ymd(now);
  return { from: t, to: t };
}

export function getPeriodHintLabel(
  preset: DashboardDatePreset,
  customFrom: string,
  customTo: string,
): string {
  if (preset === "custom" && customFrom.trim() && customTo.trim()) {
    return `${customFrom.trim()} — ${customTo.trim()}`;
  }
  return DASHBOARD_PRESET_LABELS[preset];
}

function inDateRange(iso: string | undefined, from: string, to: string): boolean {
  const id = (iso ?? "").trim();
  if (!id) return false;
  if (id < from) return false;
  if (id > to) return false;
  return true;
}

function docMatchesFlowType(d: DashDoc, flow: DashboardFlowFilter): boolean {
  const cfg = DOC_TYPE_CONFIG[d.type as ExtDocType];
  return cfg?.flow === flow;
}

export function filterDashboardDocuments(
  docs: DashDoc[],
  flow: DashboardFlowFilter,
  docType: DocumentType | "all",
  from: string,
  to: string,
): DashDoc[] {
  return docs.filter((d) => {
    if (d.status === "cancelled") return false;
    if (!docMatchesFlowType(d, flow)) return false;
    if (docType !== "all" && d.type !== docType) return false;
    if (!inDateRange(d.issueDate, from, to)) return false;
    return true;
  });
}

/** ประเภทเอกสารในโฟลว์ที่มีอยู่ในข้อมูลจริง */
export function getExistingTypesForFlow(
  docs: DashDoc[],
  flow: DashboardFlowFilter,
): DocumentType[] {
  const s = new Set<DocumentType>();
  for (const d of docs) {
    if (d.status === "cancelled") continue;
    if (!docMatchesFlowType(d, flow)) continue;
    s.add(d.type);
  }
  return Array.from(s).sort((a, b) => {
    const la = DOC_TYPE_CONFIG[a as ExtDocType]?.label ?? a;
    const lb = DOC_TYPE_CONFIG[b as ExtDocType]?.label ?? b;
    return la.localeCompare(lb, "th");
  });
}

export function ymdToday(): string {
  return ymd(new Date());
}

export function effectivePaymentKey(d: DashDoc): string {
  const ps = (d.paymentStatus ?? "unpaid") as string;
  if (ps === "paid" || d.status === "paid") return "paid";
  if (ps === "partial") return "partial";
  if (ps === "overdue") return "overdue";
  const due = d.dueDate?.trim();
  if (due && due < ymdToday()) return "overdue";
  return ps === "unpaid" ? "unpaid" : ps;
}

export type DashboardKpis = {
  salesTotal: number;
  paidTotal: number;
  outstandingTotal: number;
  documentCount: number;
};

export function computeKpis(docs: DashDoc[]): DashboardKpis {
  let salesTotal = 0;
  let paidTotal = 0;
  let outstandingTotal = 0;
  let documentCount = docs.length;

  for (const d of docs) {
    salesTotal += d.total ?? 0;
    if (!documentTypeSupportsPaymentStatus(d.type)) continue;
    const k = effectivePaymentKey(d);
    const t = d.total ?? 0;
    if (k === "paid") paidTotal += t;
    else if (k === "unpaid" || k === "partial" || k === "overdue") {
      outstandingTotal += t;
    }
  }

  return { salesTotal, paidTotal, outstandingTotal, documentCount };
}

/** แนวโน้ม 6 เดือน — ไม่ใช้ตัวกรองวันที่ของแดชบอร์ด ใช้แค่ flow + ประเภท */
export function computeSixMonthTrend(
  allDocs: DashDoc[],
  flow: DashboardFlowFilter,
  docType: DocumentType | "all",
): { key: string; label: string; amount: number }[] {
  const now = new Date();
  const months: { y: number; m: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ y: dt.getFullYear(), m: dt.getMonth() });
  }

  const filtered = allDocs.filter((d) => {
    if (d.status === "cancelled") return false;
    if (!docMatchesFlowType(d, flow)) return false;
    if (docType !== "all" && d.type !== docType) return false;
    return true;
  });

  return months.map(({ y, m }) => {
    const from = ymd(new Date(y, m, 1));
    const to = ymd(new Date(y, m + 1, 0));
    let amount = 0;
    for (const d of filtered) {
      const id = (d.issueDate ?? "").trim();
      if (id >= from && id <= to) amount += d.total ?? 0;
    }
    const label = new Date(y, m, 15).toLocaleDateString("th-TH", {
      month: "short",
      year: "2-digit",
    });
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    return { key, label, amount };
  });
}

export type TopPartnerRow = { rank: number; name: string; amount: number };

export function computeTopPartners(
  docs: DashDoc[],
  flow: DashboardFlowFilter,
  limit = 5,
): TopPartnerRow[] {
  const m = new Map<string, number>();
  for (const d of docs) {
    const name =
      flow === "income"
        ? (d.customerName ?? "").trim() || "—"
        : (d.vendorName ?? "").trim() || "—";
    m.set(name, (m.get(name) ?? 0) + (d.total ?? 0));
  }
  const sorted = Array.from(m.entries())
    .filter(([n]) => n !== "—")
    .sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, limit).map(([name, amount], i) => ({
    rank: i + 1,
    name,
    amount,
  }));
}

function mergeStep2(raw: unknown): Step2FormValues | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.items)) return null;
  return o as unknown as Step2FormValues;
}

export type TopItemRow = { rank: number; title: string; amount: number };

export function computeTopItems(docs: DashDoc[], limit = 5): TopItemRow[] {
  const m = new Map<string, number>();
  for (const d of docs) {
    const step2 = mergeStep2(d.previewData?.step2Data);
    if (!step2?.items?.length) continue;
    for (const row of step2.items as ItemRow[]) {
      const title = (row.title ?? "").trim() || "ไม่มีชื่อรายการ";
      const amt = calcRowTotal(row);
      m.set(title, (m.get(title) ?? 0) + amt);
    }
  }
  const sorted = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, limit).map(([title, amount], i) => ({
    rank: i + 1,
    title,
    amount,
  }));
}

export type UnpaidRow = {
  id: string;
  docNumber: string;
  type: DocumentType;
  issueDate: string;
  total: number;
  paymentKey: string;
};

export function computeUnpaidDocuments(docs: DashDoc[], limit = 5): UnpaidRow[] {
  const rows: UnpaidRow[] = [];
  for (const d of docs) {
    if (!documentTypeSupportsPaymentStatus(d.type)) continue;
    const k = effectivePaymentKey(d);
    if (k !== "unpaid" && k !== "partial" && k !== "overdue") continue;
    rows.push({
      id: d.id,
      docNumber: d.docNumber,
      type: d.type,
      issueDate: d.issueDate ?? "",
      total: d.total ?? 0,
      paymentKey: k,
    });
  }
  rows.sort((a, b) => {
    const ao = a.paymentKey === "overdue" ? 0 : 1;
    const bo = b.paymentKey === "overdue" ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return (b.issueDate ?? "").localeCompare(a.issueDate ?? "");
  });
  return rows.slice(0, limit);
}

export type PendingWorkflowRow = {
  id: string;
  docNumber: string;
  type: DocumentType;
  total: number;
  paymentKey: string;
  paymentLabel: string;
  nextType: ExtDocType;
  nextLabel: string;
};

export function computePendingWorkflow(
  docs: DashDoc[],
  allCompanyDocs: DashDoc[],
  limit = 5,
): PendingWorkflowRow[] {
  const rows: PendingWorkflowRow[] = [];

  const byChain = new Map<string, DashDoc[]>();
  for (const d of allCompanyDocs) {
    if (d.status === "cancelled") continue;
    const cid = (d.chainId ?? d.id) as string;
    if (!byChain.has(cid)) byChain.set(cid, []);
    byChain.get(cid)!.push(d);
  }

  function chainHasType(chainKey: string, t: ExtDocType): boolean {
    const list = byChain.get(chainKey) ?? [];
    return list.some((x) => x.type === t);
  }

  for (const d of docs) {
    if (d.status === "draft") continue;
    const actions = getNextDocumentActions(d.type as ExtDocType);
    let nextType: ExtDocType | null = null;
    const created = new Set(d.nextDocumentsCreated ?? []);
    const chainKey = (d.chainId ?? d.id) as string;
    for (const a of actions) {
      if (a.hint === "special") continue;
      if (created.has(a.nextType)) continue;
      if (chainHasType(chainKey, a.nextType)) continue;
      nextType = a.nextType;
      break;
    }
    if (!nextType) continue;

    let paymentKey: string;
    let paymentLabel: string;
    if (documentTypeSupportsPaymentStatus(d.type)) {
      paymentKey = effectivePaymentKey(d);
      paymentLabel = paymentStatusLabels[paymentKey] ?? paymentKey;
    } else {
      paymentKey = "na";
      paymentLabel = "—";
    }

    rows.push({
      id: d.id,
      docNumber: d.docNumber,
      type: d.type,
      total: d.total ?? 0,
      paymentKey,
      paymentLabel,
      nextType,
      nextLabel: DOC_TYPE_CONFIG[nextType]?.label ?? nextType,
    });
  }

  const issueById = new Map(docs.map((d) => [d.id, d.issueDate ?? ""]));
  rows.sort(
    (a, b) =>
      (issueById.get(b.id) ?? "").localeCompare(issueById.get(a.id) ?? "") ||
      b.docNumber.localeCompare(a.docNumber, "en"),
  );

  return rows.slice(0, limit);
}

export function fmtBaht(n: number): string {
  return `${n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ฿`;
}
