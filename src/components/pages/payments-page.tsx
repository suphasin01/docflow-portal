"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock,
  Info,
  Link2,
} from "lucide-react";
import type { Timestamp } from "firebase/firestore";
import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/business/status-badge";
import { useAuth } from "@/components/providers/auth-provider";
import { useCompanyStore } from "@/stores/company-store";
import { useDocuments } from "@/hooks/use-workspace-data";
import {
  DOC_TYPE_CONFIG,
  documentTypeSupportsPaymentStatus,
  type ExtDocType,
} from "@/lib/doc-types";
import { getDocumentTypeBadgeLabel } from "@/lib/document-flow";
import { updateDocumentPaymentStatus } from "@/lib/firebase/document-detail-mutations";
import { paymentStatusLabels } from "@/lib/navigation";
import { PAYMENT_METHODS } from "@/lib/schemas/document-step3";
import { cn } from "@/lib/utils";
import type {
  BusinessDocument,
  PaymentStatus,
  PaymentStatusHistoryEntry,
} from "@/types";
import { toast } from "sonner";

type RowDoc = BusinessDocument & { id: string };
type FlowTab = "all" | "income" | "expense";

const PAYMENT_TRACKING_TYPES: ExtDocType[] = [
  "receipt",
  "invoice",
  "payment_voucher",
  "sales_order",
  "purchase_order",
  "goods_receipt",
  "billing_note",
  "tax_invoice",
];

const TYPE_BADGE: Record<string, string> = {
  invoice: "border bg-sky-50 text-sky-800 border-sky-200",
  receipt: "border bg-emerald-50 text-emerald-800 border-emerald-200",
  tax_invoice: "border bg-orange-50 text-orange-800 border-orange-200",
  purchase_order: "border bg-cyan-50 text-cyan-800 border-cyan-200",
  goods_receipt: "border bg-teal-50 text-teal-900 border-teal-200",
  sales_order: "border bg-violet-50 text-violet-800 border-violet-200",
  payment_voucher: "border bg-rose-50 text-rose-800 border-rose-200",
  billing_note: "border bg-indigo-50 text-indigo-800 border-indigo-200",
};

const PAYMENT_STATUSES: PaymentStatus[] = [
  "unpaid",
  "partial",
  "paid",
  "overdue",
];

/** Base UI Select แสดง trigger จาก value ดิบ — ใช้กับ SelectValue แบบ (v) => … */
function selectTypeFilterLabel(value: unknown): string {
  if (value == null || value === "") return "ทุกประเภท";
  const v = String(value);
  if (v === "all") return "ทุกประเภท";
  return DOC_TYPE_CONFIG[v as ExtDocType]?.label ?? v;
}

function selectPaymentStatusFilterLabel(value: unknown): string {
  if (value == null || value === "") return "ทุกสถานะ";
  const v = String(value);
  if (v === "all") return "ทุกสถานะ";
  return paymentStatusLabels[v] ?? v;
}

function selectChannelFilterLabel(value: unknown): string {
  if (value == null || value === "") return "ทุกช่องทาง";
  const v = String(value);
  if (v === "all") return "ทุกช่องทาง";
  if (v === "none") return "ยังไม่ระบุช่องทาง";
  return paymentMethodLabel(v);
}

function selectPaymentMethodChoiceLabel(value: unknown): string {
  if (value == null || value === "") return "เลือกช่องทาง";
  return paymentMethodLabel(String(value));
}

function selectRowPaymentStatusLabel(value: unknown): string {
  if (value == null || value === "") return "—";
  const v = String(value);
  return paymentStatusLabels[v] ?? v;
}

function todayYmd(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function currentMonthRange(): { from: string; to: string } {
  const n = new Date();
  const y = n.getFullYear();
  const mo = n.getMonth();
  const first = new Date(y, mo, 1);
  const last = new Date(y, mo + 1, 0);
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  return { from: fmt(first), to: fmt(last) };
}

function createdAtMs(d: RowDoc): number {
  const c = d.createdAt as Timestamp | undefined;
  if (c && typeof c.toMillis === "function") return c.toMillis();
  return 0;
}

/** แสดงผล / สรุป — ครบกำหนดแล้วและยังไม่ชำระครบ → เกินกำหนด (คง partial ไว้) */
function effectivePaymentStatus(d: BusinessDocument): PaymentStatus {
  const ps = (d.paymentStatus ?? "unpaid") as PaymentStatus;
  if (ps === "paid") return "paid";
  if (ps === "partial") return "partial";
  const due = d.dueDate?.trim();
  if (due && due < todayYmd()) return "overdue";
  return ps;
}

function chainKey(d: RowDoc): string {
  return d.chainId && d.chainId.trim() ? d.chainId.trim() : d.id;
}

function partnerName(d: BusinessDocument): string {
  const role = DOC_TYPE_CONFIG[d.type as ExtDocType]?.partnerRole;
  if (role === "vendor") return d.vendorName?.trim() || "—";
  return d.customerName?.trim() || "—";
}

function paymentMethodLabel(key: string | null | undefined): string {
  if (!key) return "—";
  const m = PAYMENT_METHODS.find((p) => p.key === key);
  return m?.label ?? key;
}

function formatThaiShort(ts: Timestamp): string {
  try {
    const d = ts.toDate();
    return d.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  } catch {
    return "—";
  }
}

/** หลังชำระแล้ว — เสนอสร้างเอกสารถัดไปในโซ่ (ใบแจ้งหนี้ → ใบกำกับภาษี → ใบเสร็จ) */
function paidFollowUpNextType(docType: string): ExtDocType | null {
  if (docType === "invoice") return "tax_invoice";
  if (docType === "tax_invoice") return "receipt";
  if (docType === "purchase_order") return "goods_receipt";
  if (docType === "goods_receipt") return "payment_voucher";
  return null;
}

function chainHasOtherOfType(
  allDocs: RowDoc[],
  sourceDoc: RowDoc,
  nextType: ExtDocType,
): boolean {
  const k = chainKey(sourceDoc);
  return allDocs.some(
    (d) => chainKey(d) === k && d.id !== sourceDoc.id && d.type === nextType,
  );
}

function historyDisplayName(
  e: PaymentStatusHistoryEntry,
  fallbackUid: string,
): string {
  const raw = e.userEmail?.trim();
  if (raw) return raw.includes("@") ? raw.split("@")[0]! : raw;
  return e.userId ? e.userId.slice(0, 8) : fallbackUid.slice(0, 8);
}

type ChainGroup = {
  key: string;
  docs: RowDoc[];
  main: RowDoc;
  children: RowDoc[];
};

function buildChains(docs: RowDoc[]): ChainGroup[] {
  const m = new Map<string, RowDoc[]>();
  for (const d of docs) {
    const k = chainKey(d);
    m.set(k, [...(m.get(k) ?? []), d]);
  }
  const out: ChainGroup[] = [];
  for (const [key, arr] of m) {
    const sorted = [...arr].sort((a, b) => createdAtMs(b) - createdAtMs(a));
    const main = sorted[0]!;
    const children = sorted.slice(1);
    out.push({ key, docs: sorted, main, children });
  }
  out.sort((a, b) => createdAtMs(b.main) - createdAtMs(a.main));
  return out;
}

/** ประวัติชำระเงิน: ใช้เฉพาะเอกสารล่าสุดในโซ่ (main) ไม่รวมจากเอกสารอื่น — เฉพาะรายการที่สถานะเปลี่ยนจริง */
function latestDocPaymentStatusHistory(
  main: RowDoc,
): PaymentStatusHistoryEntry[] {
  const list = (main.paymentStatusHistory ?? []).filter(
    (h) => h.from !== h.to,
  );
  return list.sort((a, b) => b.at.toMillis() - a.at.toMillis());
}

export function PaymentsPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const { data: documents, loading } = useDocuments(companyId);

  const [flowTab, setFlowTab] = useState<FlowTab>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  const [paidModal, setPaidModal] = useState<{
    doc: RowDoc;
    method: string;
  } | null>(null);
  const [followUpModal, setFollowUpModal] = useState<{
    doc: RowDoc;
    nextType: ExtDocType;
  } | null>(null);

  const displayName =
    profile?.displayName?.trim() ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "";

  /** เอกสารจาก wizard ยังคง `status: draft` — หน้าติดตามชำระเงินต้องแสดงได้ (ยกเว้นยกเลิก) */
  const baseDocs = useMemo(() => {
    return documents.filter(
      (d) =>
        documentTypeSupportsPaymentStatus(d.type) && d.status !== "cancelled",
    ) as RowDoc[];
  }, [documents]);

  const filteredFlat = useMemo(() => {
    return baseDocs.filter((d) => {
      const flow = DOC_TYPE_CONFIG[d.type as ExtDocType]?.flow;
      if (flowTab === "income" && flow !== "income") return false;
      if (flowTab === "expense" && flow !== "expense") return false;

      if (typeFilter !== "all" && d.type !== typeFilter) return false;

      const eff = effectivePaymentStatus(d);
      if (statusFilter !== "all" && eff !== statusFilter) return false;

      if (channelFilter !== "all") {
        const m = d.paymentMethod?.trim();
        if (channelFilter === "none") {
          if (m) return false;
        } else if (m !== channelFilter) return false;
      }

      const hay = `${d.docNumber} ${partnerName(d)}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;

      const idate = d.issueDate ?? "";
      if (fromDate && idate && idate < fromDate) return false;
      if (toDate && idate && idate > toDate) return false;
      if (fromDate && !idate) return false;

      return true;
    });
  }, [
    baseDocs,
    channelFilter,
    flowTab,
    fromDate,
    q,
    statusFilter,
    toDate,
    typeFilter,
  ]);

  const chains = useMemo(() => buildChains(filteredFlat), [filteredFlat]);

  /** สรุปตาม chain — นับ 1 ครั้งต่อโซ่ ใช้สถานะ/ยอดจากเอกสารหลักเท่านั้น (ไม่รวมเอกสารลูกใน chain) */
  const summary = useMemo(() => {
    let outstanding = 0;
    let outstandingCount = 0;
    let partial = 0;
    let partialCount = 0;
    let paid = 0;
    let paidCount = 0;

    for (const group of chains) {
      const d = group.main;
      const eff = effectivePaymentStatus(d);
      const amt = d.total ?? 0;
      if (eff === "paid") {
        paid += amt;
        paidCount += 1;
      } else if (eff === "partial") {
        partial += amt;
        partialCount += 1;
      } else {
        outstanding += amt;
        outstandingCount += 1;
      }
    }

    return {
      outstanding,
      outstandingCount,
      partial,
      partialCount,
      paid,
      paidCount,
    };
  }, [chains]);

  const toggleExpand = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const applyThisMonth = useCallback(() => {
    const { from, to } = currentMonthRange();
    setFromDate(from);
    setToDate(to);
  }, []);

  const persistStatus = useCallback(
    async (
      doc: RowDoc,
      next: PaymentStatus,
      paymentMethod?: string | null,
    ): Promise<boolean> => {
      if (!companyId || !user) {
        toast.error("ยังไม่เข้าสู่ระบบ");
        return false;
      }
      setSavingId(doc.id);
      try {
        await updateDocumentPaymentStatus({
          documentId: doc.id,
          companyId,
          userId: user.uid,
          userEmail: user.email ?? null,
          nextStatus: next,
          ...(next === "paid" ? { paymentMethod } : {}),
        });
        toast.success("อัปเดตสถานะการชำระเงินแล้ว");
        return true;
      } catch (e) {
        console.error(e);
        toast.error("ไม่สามารถอัปเดตสถานะได้");
        return false;
      } finally {
        setSavingId(null);
      }
    },
    [companyId, user],
  );

  const maybeOfferPaidFollowUp = useCallback(
    (doc: RowDoc) => {
      const nextType = paidFollowUpNextType(doc.type);
      if (!nextType) return;
      if (chainHasOtherOfType(documents as RowDoc[], doc, nextType)) return;
      setFollowUpModal({ doc, nextType });
    },
    [documents],
  );

  const onStatusSelect = useCallback(
    (doc: RowDoc, value: string) => {
      const next = value as PaymentStatus;
      if (next === "paid") {
        setPaidModal({ doc, method: PAYMENT_METHODS[0]!.key });
        return;
      }
      void persistStatus(doc, next);
    },
    [persistStatus],
  );

  const confirmPaid = useCallback(async () => {
    if (!paidModal) return;
    const { doc, method } = paidModal;
    const ok = await persistStatus(doc, "paid", method);
    setPaidModal(null);
    if (ok) maybeOfferPaidFollowUp(doc);
  }, [paidModal, persistStatus, maybeOfferPaidFollowUp]);

  const skipPaid = useCallback(async () => {
    if (!paidModal) return;
    const doc = paidModal.doc;
    const ok = await persistStatus(doc, "paid", null);
    setPaidModal(null);
    if (ok) maybeOfferPaidFollowUp(doc);
  }, [paidModal, persistStatus, maybeOfferPaidFollowUp]);

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-transparent">
      <AppHeader title="ติดตามชำระเงิน" subtitle="จัดการสถานะการชำระเงิน" />

      <div className="space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <Card className="rounded-2xl border-border/80 bg-surface shadow-sm">
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <span>ช่วงวันที่</span>
                  <button
                    type="button"
                    title="กรองตามวันที่ออกเอกสารภายในช่วงที่เลือก"
                    className="inline-flex rounded-full p-0.5 text-muted-foreground hover:bg-surface-secondary"
                    aria-label="คำอธิบายช่วงวันที่"
                  >
                    <Info className="size-4" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    className="h-10 w-[155px] rounded-xl bg-surface"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                  <span className="text-sm text-muted-foreground">ถึง</span>
                  <Input
                    type="date"
                    className="h-10 w-[155px] rounded-xl bg-surface"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 rounded-xl"
                    onClick={applyThisMonth}
                  >
                    เดือนนี้
                  </Button>
                </div>
              </div>
            </div>

            <Tabs
              value={flowTab}
              onValueChange={(v) => {
                if (v === "all" || v === "income" || v === "expense")
                  setFlowTab(v);
              }}
            >
              <TabsList className="h-10 rounded-xl bg-surface-secondary p-1">
                <TabsTrigger
                  value="all"
                  className="rounded-lg data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
                >
                  ทั้งหมด
                </TabsTrigger>
                <TabsTrigger
                  value="income"
                  className="rounded-lg data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
                >
                  รายรับ
                </TabsTrigger>
                <TabsTrigger
                  value="expense"
                  className="rounded-lg data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
                >
                  รายจ่าย
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="mt-5 space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <SummaryCard
                  title="ค้างชำระ"
                  amount={summary.outstanding}
                  count={summary.outstandingCount}
                  variant="red"
                />
                <SummaryCard
                  title="ชำระบางส่วน"
                  amount={summary.partial}
                  count={summary.partialCount}
                  variant="amber"
                  sub={
                    summary.partialCount > 0
                      ? `${summary.partialCount} โซ่ · รับแล้ว —`
                      : undefined
                  }
                />
                <SummaryCard
                  title="ชำระแล้ว"
                  amount={summary.paid}
                  count={summary.paidCount}
                  variant="green"
                />
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-surface/90 p-4 shadow-sm md:flex-row md:flex-wrap md:items-center md:justify-between">
                <Input
                  className="h-10 max-w-md rounded-xl"
                  placeholder="ค้นหาเลขที่ / ชื่อลูกค้า..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={typeFilter}
                    onValueChange={(v) => {
                      if (v) setTypeFilter(v);
                    }}
                  >
                    <SelectTrigger className="h-10 w-[170px] rounded-xl">
                      <SelectValue placeholder="ประเภท">
                        {(v) => selectTypeFilterLabel(v)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกประเภท</SelectItem>
                      {PAYMENT_TRACKING_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {DOC_TYPE_CONFIG[t].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => {
                      if (v) setStatusFilter(v);
                    }}
                  >
                    <SelectTrigger className="h-10 w-[160px] rounded-xl">
                      <SelectValue placeholder="สถานะ">
                        {(v) => selectPaymentStatusFilterLabel(v)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกสถานะ</SelectItem>
                      {PAYMENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {paymentStatusLabels[s] ?? s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={channelFilter}
                    onValueChange={(v) => {
                      if (v) setChannelFilter(v);
                    }}
                  >
                    <SelectTrigger className="h-10 w-[170px] rounded-xl">
                      <SelectValue placeholder="ช่องทาง">
                        {(v) => selectChannelFilterLabel(v)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกช่องทาง</SelectItem>
                      {PAYMENT_METHODS.map((p) => (
                        <SelectItem key={p.key} value={p.key}>
                          {p.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="none">ยังไม่ระบุช่องทาง</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Card className="overflow-hidden rounded-2xl border-border/80 bg-surface shadow-sm">
                <CardContent className="p-0">
                  {loading ? (
                    <p className="p-6 text-sm text-muted-foreground">
                      กำลังโหลด…
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1100px] text-left text-sm">
                        <thead className="sticky top-0 z-10 border-b border-border/80 bg-surface shadow-[0_1px_0_0_hsl(var(--border))]">
                          <tr className="text-xs font-medium text-muted-foreground">
                            <th className="whitespace-nowrap px-4 py-3">
                              เลขที่
                            </th>
                            <th className="whitespace-nowrap px-4 py-3">
                              ประเภท
                            </th>
                            <th className="whitespace-nowrap px-4 py-3">
                              วันที่
                            </th>
                            <th className="whitespace-nowrap px-4 py-3">
                              ครบกำหนด
                            </th>
                            <th className="whitespace-nowrap px-4 py-3">
                              ลูกค้า
                            </th>
                            <th className="whitespace-nowrap px-4 py-3 text-right">
                              ยอด
                            </th>
                            <th className="whitespace-nowrap px-4 py-3">
                              ช่องทาง
                            </th>
                            <th className="whitespace-nowrap px-4 py-3">
                              สถานะ
                            </th>
                            <th className="whitespace-nowrap px-4 py-3">
                              เปลี่ยนสถานะ
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {chains.length === 0 ? (
                            <tr>
                              <td
                                colSpan={9}
                                className="py-12 text-center text-muted-foreground"
                              >
                                ไม่พบรายการในช่วงนี้
                              </td>
                            </tr>
                          ) : (
                            chains.map((group) => (
                              <ChainTableBlock
                                key={group.key}
                                group={group}
                                expanded={expanded.has(group.key)}
                                onToggleExpand={() => toggleExpand(group.key)}
                                displayName={displayName}
                                savingId={savingId}
                                onStatusSelect={onStatusSelect}
                              />
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!paidModal}
        onOpenChange={(open) => {
          if (!open) setPaidModal(null);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>บันทึกช่องทางชำระเงิน</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <p className="text-sm text-muted-foreground">ช่องทางการชำระเงิน</p>
            <Select
              value={paidModal?.method ?? PAYMENT_METHODS[0]!.key}
              onValueChange={(v) => {
                if (v && paidModal) setPaidModal({ ...paidModal, method: v });
              }}
            >
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="เลือกช่องทาง">
                  {(v) => selectPaymentMethodChoiceLabel(v)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => void skipPaid()}
              disabled={
                !paidModal ||
                !companyId ||
                !user ||
                savingId === paidModal.doc.id
              }
            >
              ข้าม
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              onClick={() => void confirmPaid()}
              disabled={
                !paidModal ||
                !companyId ||
                !user ||
                savingId === paidModal.doc.id
              }
            >
              {savingId === paidModal?.doc.id ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!followUpModal}
        onOpenChange={(open) => {
          if (!open) setFollowUpModal(null);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>สร้างเอกสารต่อเนื่อง?</DialogTitle>
          </DialogHeader>
          {followUpModal ? (
            <>
              <p className="text-sm leading-relaxed text-foreground">
                เอกสาร{" "}
                <span className="font-semibold text-sky-800">
                  {DOC_TYPE_CONFIG[followUpModal.doc.type as ExtDocType]
                    ?.label ?? followUpModal.doc.type}{" "}
                  {followUpModal.doc.docNumber}
                </span>{" "}
                ชำระแล้ว ต้องการสร้าง{" "}
                <span className="font-semibold text-orange-700">
                  {getDocumentTypeBadgeLabel(followUpModal.nextType)}
                </span>{" "}
                ต่อเลยไหม?
              </p>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setFollowUpModal(null)}
                >
                  ไม่ ขอบคุณ
                </Button>
                <Button
                  type="button"
                  className="rounded-xl"
                  onClick={() => {
                    const { doc, nextType } = followUpModal;
                    setFollowUpModal(null);
                    router.push(
                      `/documents/create?fromDoc=${encodeURIComponent(doc.id)}&next=${encodeURIComponent(nextType)}`,
                    );
                  }}
                >
                  สร้างเลย
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  title,
  amount,
  count,
  sub,
  variant,
}: {
  title: string;
  amount: number;
  count: number;
  sub?: string;
  variant: "red" | "amber" | "green";
}) {
  const ring =
    variant === "red"
      ? "text-red-600"
      : variant === "amber"
        ? "text-amber-600"
        : "text-emerald-600";
  const iconBg =
    variant === "red"
      ? "bg-red-50 text-red-600"
      : variant === "amber"
        ? "bg-amber-50 text-amber-600"
        : "bg-emerald-50 text-emerald-600";

  return (
    <div className="rounded-2xl border border-border/70 bg-surface p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-xl",
            iconBg,
          )}
        >
          <span className="text-lg font-semibold leading-none">฿</span>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className={cn("text-sm font-semibold", ring)}>{title}</p>
          <p
            className={cn(
              "text-2xl font-bold tabular-nums tracking-tight",
              ring,
            )}
          >
            {amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground">
            {sub ?? `${count} เอกสาร`}
          </p>
        </div>
      </div>
    </div>
  );
}

function ChainTableBlock({
  group,
  expanded,
  onToggleExpand,
  displayName,
  savingId,
  onStatusSelect,
}: {
  group: ChainGroup;
  expanded: boolean;
  onToggleExpand: () => void;
  displayName: string;
  savingId: string | null;
  onStatusSelect: (doc: RowDoc, value: string) => void;
}) {
  const main = group.main;
  const hasChildren = group.children.length > 0;
  const chainHistory = useMemo(
    () => latestDocPaymentStatusHistory(main),
    [main],
  );

  const eff = effectivePaymentStatus(main);
  const typeCls =
    TYPE_BADGE[main.type] ??
    "border bg-surface-secondary text-foreground border-border";

  return (
    <>
      <tr
        className={cn(
          "border-b border-border/60 transition-colors hover:bg-surface-secondary",
          expanded && "bg-surface-secondary",
        )}
      >
        <td className="px-4 py-3 align-middle">
          <div className="flex items-center gap-1.5">
            {hasChildren ? (
              <button
                type="button"
                onClick={onToggleExpand}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-secondary"
                aria-expanded={expanded}
              >
                {expanded ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </button>
            ) : (
              <span className="inline-block size-8 shrink-0" />
            )}
            <Link
              href={`/documents/detail?id=${encodeURIComponent(main.id)}`}
              className="font-medium tabular-nums text-primary underline-offset-2 hover:underline"
            >
              {main.docNumber}
            </Link>
            {hasChildren ? (
              <Badge
                variant="outline"
                className="ml-1 gap-1 rounded-full border-sky-200 bg-sky-50 px-1.5 py-0 text-[11px] font-medium text-sky-800"
              >
                <Link2 className="size-3" />
                {group.docs.length}
              </Badge>
            ) : null}
          </div>
        </td>
        <td className="px-4 py-3 align-middle">
          <Badge
            variant="outline"
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-medium",
              typeCls,
            )}
          >
            {DOC_TYPE_CONFIG[main.type as ExtDocType]?.label ?? main.type}
          </Badge>
        </td>
        <td className="px-4 py-3 text-muted-foreground tabular-nums align-middle">
          {main.issueDate ?? "—"}
        </td>
        <td className="px-4 py-3 text-muted-foreground tabular-nums align-middle">
          {main.dueDate ?? "—"}
        </td>
        <td className="max-w-[200px] truncate px-4 py-3 align-middle">
          {partnerName(main)}
        </td>
        <td className="px-4 py-3 text-right font-medium tabular-nums align-middle">
          {(main.total ?? 0).toLocaleString("th-TH", {
            minimumFractionDigits: 2,
          })}
        </td>
        <td className="px-4 py-3 text-muted-foreground align-middle">
          {paymentMethodLabel(main.paymentMethod)}
        </td>
        <td className="px-4 py-3 align-middle">
          <StatusBadge status={eff} label={paymentStatusLabels[eff] ?? eff} />
        </td>
        <td className="px-4 py-3 align-middle">
          <Select
            value={eff}
            disabled={!!savingId && savingId === main.id}
            onValueChange={(v) => {
              if (v) onStatusSelect(main, v);
            }}
          >
            <SelectTrigger className="h-9 w-[150px] rounded-lg">
              <SelectValue placeholder="สถานะ">
                {(v) => selectRowPaymentStatusLabel(v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {paymentStatusLabels[s] ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
      </tr>
      {expanded && hasChildren ? (
        <>
          {group.children.map((child) => {
            const cEff = effectivePaymentStatus(child);
            const cTypeCls =
              TYPE_BADGE[child.type] ??
              "border bg-surface-secondary text-foreground border-border";
            return (
              <tr
                key={child.id}
                className="border-b border-border/40 bg-surface-secondary animate-in fade-in-0 duration-200"
              >
                <td className="px-4 py-2 align-middle">
                  <div className="flex items-start gap-1">
                    <div className="flex w-8 shrink-0 flex-col items-center pt-1">
                      <div className="min-h-3 w-px flex-1 bg-border" />
                      <div className="h-3 w-3 shrink-0 border-b border-l border-border" />
                    </div>
                    <Link
                      href={`/documents/detail?id=${encodeURIComponent(child.id)}`}
                      className="pt-1 font-medium tabular-nums text-primary underline-offset-2 hover:underline"
                    >
                      {child.docNumber}
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-2 align-middle">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-medium",
                        cTypeCls,
                      )}
                    >
                      {DOC_TYPE_CONFIG[child.type as ExtDocType]?.label ??
                        child.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      ออกเอกสารต่อแล้ว
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2 text-muted-foreground tabular-nums align-middle">
                  {child.issueDate ?? "—"}
                </td>
                <td className="px-4 py-2 text-muted-foreground tabular-nums align-middle">
                  {child.dueDate ?? "—"}
                </td>
                <td className="max-w-[180px] truncate px-4 py-2 align-middle">
                  {partnerName(child)}
                </td>
                <td className="px-4 py-2 text-right text-sm font-medium tabular-nums align-middle">
                  {(child.total ?? 0).toLocaleString("th-TH", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="px-4 py-2 text-muted-foreground align-middle">
                  {paymentMethodLabel(child.paymentMethod)}
                </td>
                <td className="px-4 py-2 align-middle">
                  <StatusBadge
                    status={cEff}
                    label={paymentStatusLabels[cEff] ?? cEff}
                  />
                </td>
                <td className="px-4 py-2 align-middle">
                  <Select
                    value={cEff}
                    disabled={!!savingId && savingId === child.id}
                    onValueChange={(v) => {
                      if (v) onStatusSelect(child, v);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[140px] rounded-lg text-xs">
                      <SelectValue placeholder="สถานะ">
                        {(v) => selectRowPaymentStatusLabel(v)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {paymentStatusLabels[s] ?? s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            );
          })}
          <tr className="border-b border-border/60 bg-surface-secondary animate-in fade-in-0 duration-200">
            <td colSpan={9} className="px-4 py-4 align-top">
              <div className="ml-10 rounded-xl border border-border/60 bg-surface/90 p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Clock className="size-4 text-muted-foreground" />
                  ประวัติการชำระเงิน
                </div>
                {chainHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    ยังไม่มีบันทึกการเปลี่ยนสถานะ
                  </p>
                ) : (
                  <ul className="space-y-2.5 border-l-2 border-border/80 pl-4">
                    {chainHistory.map((h, i) => {
                      const by = historyDisplayName(h, displayName);
                      const fromL =
                        paymentStatusLabels[h.from] ?? String(h.from);
                      const toL = paymentStatusLabels[h.to] ?? String(h.to);
                      const line =
                        h.from === h.to
                          ? `${formatThaiShort(h.at)} ${toL}`
                          : `${formatThaiShort(h.at)} ${fromL} → ${toL}`;
                      return (
                        <li
                          key={`${h.at.toMillis()}-${i}-${h.from}-${h.to}`}
                          className="relative text-xs text-muted-foreground"
                        >
                          <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-border" />
                          {line}
                          <span className="text-foreground"> โดย {by}</span>
                          {h.paymentMethod ? (
                            <span className="text-foreground">
                              {" "}
                              · {paymentMethodLabel(h.paymentMethod)}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </td>
          </tr>
        </>
      ) : null}
    </>
  );
}
