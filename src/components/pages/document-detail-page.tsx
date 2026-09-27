"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Eye,
  FileDown,
  FileText,
  Link2,
  Pencil,
  Printer,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { StatusBadge } from "@/components/business/status-badge";
import { DocumentPreviewRenderer } from "@/components/business/document-preview-renderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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
import { useCompanyStore } from "@/stores/company-store";
import { useDocuments } from "@/hooks/use-workspace-data";
import { useAuth } from "@/components/providers/auth-provider";
import {
  documentTypeLabels,
  getDocumentStatusDisplay,
  paymentStatusLabels,
} from "@/lib/navigation";
import {
  DOC_TYPE_CONFIG,
  documentTypeSupportsPaymentStatus,
  type ExtDocType,
} from "@/lib/doc-types";
import { updateDocumentPaymentStatus } from "@/lib/firebase/document-detail-mutations";
import {
  exportPreviewContainerToPdf,
  printPreviewContainer,
} from "@/lib/document-preview-export";
import { getNextDocumentActions } from "@/lib/document-flow";
import { Timestamp } from "firebase/firestore";
import type { BusinessDocument, PaymentStatus } from "@/types";
import type { Step1FormValues } from "@/lib/schemas/document-draft";
import type { Step2FormValues } from "@/lib/schemas/document-step2";
import type { Step3FormValues } from "@/lib/schemas/document-step3";

const PAYMENT_STATUS_ORDER: PaymentStatus[] = [
  "unpaid",
  "partial",
  "paid",
  "overdue",
];

function timestampToMs(at: unknown): number {
  if (!at) return 0;
  if (at instanceof Timestamp) return at.toMillis();
  if (
    typeof at === "object" &&
    at !== null &&
    typeof (at as { toDate?: () => Date }).toDate === "function"
  ) {
    const d = (at as { toDate: () => Date }).toDate();
    return d.getTime();
  }
  const s = (at as { seconds?: number }).seconds;
  return typeof s === "number" ? s * 1000 : 0;
}

function formatPaymentHistoryAt(at: unknown): string {
  const ms = timestampToMs(at);
  if (!ms) return "—";
  return new Date(ms).toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDocumentCreatedAt(doc: BusinessDocument): string {
  const raw = doc.createdAt as unknown;
  if (!raw) return "—";
  try {
    const d =
      raw instanceof Timestamp
        ? raw.toDate()
        : typeof (raw as { toDate?: () => Date }).toDate === "function"
          ? (raw as { toDate: () => Date }).toDate()
          : typeof (raw as { seconds?: number }).seconds === "number"
            ? new Date((raw as { seconds: number }).seconds * 1000)
            : null;
    if (!d || Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/** ใช้เทียบเลขที่เอกสารกับข้อความในช่องอ้างอิง (ละเว้นช่องว่างคั่น) */
function normalizeDocNumberKey(s: string): string {
  return s.trim().replace(/\s+/g, "");
}

/** เลขที่ที่กรอกในช่อง «เลขที่เอกสารอ้างอิง» ของ step1 (ไม่ใช่ refDocumentId ใน Firestore) */
function getStep1ReferenceDocNumber(doc: BusinessDocument): string {
  const s1 = doc.previewData?.step1Data as Partial<Step1FormValues> | undefined;
  if (!s1?.showReferenceNumber) return "";
  return (s1.referenceNumber ?? "").trim();
}

function step1ReferenceEqualsDocNumber(
  doc: BusinessDocument,
  docNumber: string,
): boolean {
  const ref = getStep1ReferenceDocNumber(doc);
  if (!ref || !docNumber?.trim()) return false;
  return normalizeDocNumberKey(ref) === normalizeDocNumberKey(docNumber);
}

type Row = BusinessDocument & { id: string };

function PreviewStack({
  docs,
  innerRef,
  docVariant,
}: {
  docs: Row[];
  innerRef: React.RefObject<HTMLDivElement | null>;
  docVariant: "original" | "copy";
}) {
  return (
    <div ref={innerRef} className="space-y-0 bg-surface">
      {docs.map((doc) => {
        const preview = doc.previewData;
        return (
          <DocumentPreviewRenderer
            key={doc.id}
            step1Data={(preview?.step1Data as Step1FormValues | null) ?? null}
            step2Data={(preview?.step2Data as Step2FormValues | null) ?? null}
            step3Data={(preview?.step3Data as Step3FormValues | null) ?? null}
            docVariant={docVariant}
            className="overflow-visible rounded-none bg-surface p-0"
            pageClassName="border-0 shadow-none"
          />
        );
      })}
    </div>
  );
}

export function DocumentDetailPage({
  documentId: initialDocumentId,
}: {
  documentId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = initialDocumentId ?? searchParams.get("id") ?? "";
  const { user } = useAuth();
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const { data: documents, loading } = useDocuments(companyId);
  const previewSectionRef = useRef<HTMLDivElement>(null);
  const currentPrintRef = useRef<HTMLDivElement>(null);
  const multiPrintRef = useRef<HTMLDivElement>(null);
  const [selectedChainIds, setSelectedChainIds] = useState<string[]>([]);
  const [exporting, setExporting] = useState<
    "current-pdf" | "current-print" | "multi-pdf" | "multi-print" | null
  >(null);
  const [docVariant, setDocVariant] = useState<"original" | "copy">("copy");
  const [variantPickerAction, setVariantPickerAction] = useState<
    "current-pdf" | "current-print" | "multi-pdf" | "multi-print" | null
  >(null);
  const [pendingPdfAction, setPendingPdfAction] = useState<
    "current-pdf" | "multi-pdf" | null
  >(null);
  const [showFilenameDialog, setShowFilenameDialog] = useState(false);
  const [pdfFilename, setPdfFilename] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);

  useEffect(() => {
    setSelectedChainIds([]);
  }, [documentId]);

  const currentDocument = useMemo(
    () => documents.find((doc) => doc.id === documentId) ?? null,
    [documentId, documents],
  );

  /** โซ่จริง: ref/source / nextDocumentsCreated / พ่อ — ไม่รวมแค่เลขอ้างอิง step1 */
  const chainDocumentsCore = useMemo(() => {
    if (!currentDocument) return [];

    const currentId = currentDocument.id;
    const byId = new Map(documents.map((d) => [d.id, d as Row]));
    const out = new Map<string, Row>();

    function add(doc: Row | undefined) {
      if (doc) out.set(doc.id, doc);
    }

    add(currentDocument as Row);

    for (const d of documents) {
      if (d.id === currentId) continue;
      const pointsHere =
        d.refDocumentId === currentId || d.sourceDocumentId === currentId;
      const fromNextList =
        currentDocument.nextDocumentsCreated?.includes(d.id) ?? false;
      if (pointsHere || fromNextList) add(d as Row);
    }

    for (const rid of [
      currentDocument.refDocumentId,
      currentDocument.sourceDocumentId,
    ]) {
      if (rid && rid !== currentId) add(byId.get(rid));
    }

    return Array.from(out.values()).sort((a, b) =>
      String(a.issueDate ?? "").localeCompare(String(b.issueDate ?? "")),
    );
  }, [currentDocument, documents]);

  /**
   * เอกสารที่แสดงเพิ่มจากช่องเลขที่อ้างอิง step1 เท่านั้น — ไม่ถือเป็นโซ่เดียวกัน
   * (ใช้แค่หยิบมาโชว์ + พิมพ์รวมได้ แต่ไม่เอาไปตัดสินใจซ่อนปุ่มสร้างต่อ)
   */
  const referenceDisplayDocuments = useMemo(() => {
    if (!currentDocument) return [];

    const coreIds = new Set(chainDocumentsCore.map((d) => d.id));
    const currentId = currentDocument.id;
    const extra = new Map<string, Row>();
    const myDocNumber = currentDocument.docNumber;

    for (const d of documents) {
      if (d.id === currentId || coreIds.has(d.id)) continue;
      if (step1ReferenceEqualsDocNumber(d, myDocNumber))
        extra.set(d.id, d as Row);
    }

    const refToOther = getStep1ReferenceDocNumber(currentDocument);
    if (refToOther) {
      const key = normalizeDocNumberKey(refToOther);
      for (const d of documents) {
        if (d.id === currentId || coreIds.has(d.id)) continue;
        if (normalizeDocNumberKey(d.docNumber) === key)
          extra.set(d.id, d as Row);
      }
    }

    return Array.from(extra.values()).sort((a, b) =>
      String(a.issueDate ?? "").localeCompare(String(b.issueDate ?? "")),
    );
  }, [currentDocument, documents, chainDocumentsCore]);

  const referenceLinkOnlyIds = useMemo(
    () => new Set(referenceDisplayDocuments.map((d) => d.id)),
    [referenceDisplayDocuments],
  );

  const paymentHistorySorted = useMemo(() => {
    const raw = currentDocument?.paymentStatusHistory;
    if (!raw?.length) return [];
    return [...raw].sort((a, b) => timestampToMs(b.at) - timestampToMs(a.at));
  }, [currentDocument?.paymentStatusHistory]);

  /** รายการรวมบนการ์ด: โซ่จริง + อ้างอิงเลขที่ (แสดงอย่างเดียว) */
  const chainDocuments = useMemo(() => {
    const byId = new Map<string, Row>();
    for (const d of chainDocumentsCore) byId.set(d.id, d);
    for (const d of referenceDisplayDocuments) byId.set(d.id, d);
    return Array.from(byId.values()).sort((a, b) =>
      String(a.issueDate ?? "").localeCompare(String(b.issueDate ?? "")),
    );
  }, [chainDocumentsCore, referenceDisplayDocuments]);

  const nextActions = useMemo(() => {
    if (!currentDocument) return [];
    return getNextDocumentActions(currentDocument.type as ExtDocType);
  }, [currentDocument]);

  /** ซ่อนปุ่มสร้างต่อเฉพาะเมื่อมีประเภทนั้นในโซ่จริง — ไม่นับแค่อ้างอิงเลขที่ */
  const nextActionsToShow = useMemo(() => {
    if (!currentDocument) return [];
    const cid = currentDocument.id;
    return nextActions.filter(
      (action) =>
        !chainDocumentsCore.some(
          (doc) => doc.id !== cid && doc.type === action.nextType,
        ),
    );
  }, [nextActions, chainDocumentsCore, currentDocument]);

  const previewData = currentDocument?.previewData;
  const step1Data = (previewData?.step1Data as Step1FormValues | null) ?? null;
  const step2Data = (previewData?.step2Data as Step2FormValues | null) ?? null;
  const step3Data = (previewData?.step3Data as Step3FormValues | null) ?? null;
  const partnerName =
    currentDocument?.customerName ||
    currentDocument?.vendorName ||
    ((currentDocument?.partnerSnapshot as { name?: string } | undefined)
      ?.name ??
      "—");
  const itemCount =
    (step2Data?.items?.filter(
      (item) => item.title.trim() || item.selectedItemCode.trim(),
    ).length ??
      0) ||
    0;

  /**
   * ส่งออกหลายฉบับ: เอกสารปัจจุบันอยู่หน้าแรกเสมอ ตามด้วยเอกสารอื่นตามลำดับที่เลือก (selectedChainIds)
   */
  const selectedDocumentsOrdered = useMemo(() => {
    if (!currentDocument || selectedChainIds.length === 0) return [];

    const byId = new Map(chainDocuments.map((d) => [d.id, d]));
    const currentRow = byId.get(currentDocument.id);
    if (!currentRow) return [];

    const relatedRows = selectedChainIds
      .filter((id) => id !== currentDocument.id)
      .map((id) => byId.get(id))
      .filter((d): d is Row => d != null);

    return [currentRow, ...relatedRows];
  }, [chainDocuments, currentDocument, selectedChainIds]);

  function toggleSelected(documentRow: Row, checked: boolean) {
    setSelectedChainIds((current) =>
      checked
        ? current.includes(documentRow.id)
          ? current
          : [...current, documentRow.id]
        : current.filter((id) => id !== documentRow.id),
    );
  }

  function handleCreateNext(nextType: ExtDocType) {
    if (!currentDocument || !companyId || !user) return;
    const cid = currentDocument.id;
    if (
      chainDocumentsCore.some((doc) => doc.id !== cid && doc.type === nextType)
    ) {
      toast.error("มีเอกสารประเภทนี้ในโซ่แล้ว");
      return;
    }

    router.push(
      `/documents/create?fromDoc=${encodeURIComponent(currentDocument.id)}&next=${encodeURIComponent(nextType)}`,
    );
  }

  async function runExport(
    mode: "current-pdf" | "current-print" | "multi-pdf" | "multi-print",
    preparedPrintWindow?: Window | null,
  ) {
    const target = mode.startsWith("current")
      ? currentPrintRef.current
      : multiPrintRef.current;
    if (!target || !currentDocument) return;

    try {
      setExporting(mode);
      if (mode.endsWith("pdf")) {
        await exportPreviewContainerToPdf(
          target,
          pdfFilename.trim() ||
            (mode.startsWith("current")
              ? currentDocument.docNumber
              : `documents-${selectedDocumentsOrdered.map((doc) => doc.docNumber).join("-")}`),
        );
      } else {
        await printPreviewContainer(target, preparedPrintWindow);
      }
    } catch (error) {
      console.error(error);
      toast.error("ไม่สามารถส่งออกเอกสารได้");
    } finally {
      setExporting(null);
    }
  }

  function openExportAction(
    mode: "current-pdf" | "current-print" | "multi-pdf" | "multi-print",
  ) {
    setVariantPickerAction(mode);
  }

  function handleVariantSelect(variant: "original" | "copy") {
    const action = variantPickerAction;
    if (!action || !currentDocument) return;
    setDocVariant(variant);
    setVariantPickerAction(null);

    if (action.endsWith("pdf")) {
      setPendingPdfAction(
        action === "current-pdf" || action === "multi-pdf" ? action : null,
      );
      setPdfFilename(
        action.startsWith("current")
          ? currentDocument.docNumber || "document"
          : selectedDocumentsOrdered.map((doc) => doc.docNumber).join("-") ||
              "documents",
      );
      setShowFilenameDialog(true);
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต pop-up");
      return;
    }
    setTimeout(() => {
      void runExport(action, printWindow);
    }, 120);
  }

  async function handlePdfConfirm() {
    const action = pendingPdfAction ?? "current-pdf";
    setShowFilenameDialog(false);
    setPendingPdfAction(null);
    await runExport(action);
  }

  async function handlePaymentStatusChange(next: PaymentStatus) {
    if (!user || !companyId || !currentDocument) return;
    const cur = (currentDocument.paymentStatus ?? "unpaid") as PaymentStatus;
    if (next === cur) return;
    setPaymentSaving(true);
    try {
      await updateDocumentPaymentStatus({
        documentId: currentDocument.id,
        companyId,
        userId: user.uid,
        userEmail: user.email ?? null,
        nextStatus: next,
      });
      toast.success("อัปเดตสถานะการชำระเงินแล้ว");
    } catch (error) {
      console.error(error);
      toast.error("ไม่สามารถอัปเดตสถานะได้");
    } finally {
      setPaymentSaving(false);
    }
  }

  if (loading || !currentDocument) {
    return (
      <div className="min-h-screen bg-transparent">
        <AppHeader
          title="รายละเอียดเอกสาร"
          subtitle="กำลังโหลดข้อมูลเอกสาร..."
          titleClassName="text-xl"
          subtitleClassName="text-xs"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <AppHeader
        title={`${documentTypeLabels[currentDocument.type] ?? currentDocument.type} ${currentDocument.docNumber}`}
        titleClassName="text-xl font-semibold"
        actions={
          <>
            <StatusBadge {...getDocumentStatusDisplay(currentDocument)} />
            {documentTypeSupportsPaymentStatus(currentDocument.type) ? (
              <StatusBadge
                status={currentDocument.paymentStatus ?? "unpaid"}
                label={
                  paymentStatusLabels[
                    currentDocument.paymentStatus ?? "unpaid"
                  ] ??
                  currentDocument.paymentStatus ??
                  "unpaid"
                }
              />
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-xs"
              onClick={() =>
                previewSectionRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
            >
              <Eye className="size-3.5" />
              พรีวิว
            </Button>
          </>
        }
      />

      <div className="px-5 py-6 text-sm">
        <div className="mx-auto max-w-[1680px] space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-fit rounded-lg text-xs"
              onClick={() => router.back()}
            >
              <ArrowLeft className="size-3.5" />
              กลับ
            </Button>
            <div className="flex w-full flex-col items-stretch gap-2 sm:ml-auto sm:w-auto sm:items-end">
              {documentTypeSupportsPaymentStatus(currentDocument.type) &&
              user &&
              companyId ? (
                <div className="flex w-full flex-col gap-1 sm:w-[min(100%,220px)]">
                  <Select
                    value={
                      (currentDocument.paymentStatus ?? "unpaid") as string
                    }
                    onValueChange={(v) =>
                      void handlePaymentStatusChange(v as PaymentStatus)
                    }
                    disabled={paymentSaving || exporting !== null}
                  >
                    <SelectTrigger className="h-8 w-full rounded-lg text-xs">
                      <SelectValue>
                        {paymentStatusLabels[
                          currentDocument.paymentStatus ?? "unpaid"
                        ] ??
                          currentDocument.paymentStatus ??
                          "unpaid"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUS_ORDER.map((key) => (
                        <SelectItem key={key} value={key} className="text-xs">
                          {paymentStatusLabels[key] ?? key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg text-xs"
                  disabled={exporting !== null}
                  onClick={() => openExportAction("current-print")}
                >
                  <Printer className="size-3.5" />
                  พิมพ์
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg text-xs"
                  disabled={exporting !== null}
                  onClick={() => openExportAction("current-pdf")}
                >
                  <FileDown className="size-3.5" />
                  ดาวน์โหลด PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg text-xs"
                  onClick={() =>
                    router.push(
                      `/documents/create?edit=${encodeURIComponent(documentId)}`,
                    )
                  }
                >
                  <Pencil className="size-3.5" />
                  แก้ไข
                </Button>
              </div>
            </div>
          </div>

          {documentTypeSupportsPaymentStatus(currentDocument.type) ? (
            <Card className="rounded-2xl border-border/80 bg-surface py-0">
              <CardHeader className="border-b border-border/80 py-3">
                <CardTitle className="text-sm font-semibold text-foreground">
                  ประวัติการเปลี่ยนสถานะชำระเงิน
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 py-4">
                {paymentHistorySorted.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    ยังไม่มีการเปลี่ยนสถานะจากหน้านี้
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {paymentHistorySorted.map((entry, i) => (
                      <li
                        key={`${timestampToMs(entry.at)}-${entry.userId}-${entry.to}-${i}`}
                        className="border-b border-separator pb-3 text-[13px] leading-snug text-foreground last:border-0 last:pb-0"
                      >
                        <div className="font-medium text-foreground">
                          {formatPaymentHistoryAt(entry.at)}
                        </div>
                        <div className="mt-0.5">
                          {paymentStatusLabels[entry.from] ?? entry.from} →{" "}
                          {paymentStatusLabels[entry.to] ?? entry.to}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          โดย{" "}
                          {entry.userEmail?.trim() ||
                            (entry.userId.length > 12
                              ? `${entry.userId.slice(0, 8)}…`
                              : entry.userId)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card className="rounded-2xl bg-surface py-0">
            <CardHeader className="border-b border-border/80 py-3.5">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Link2 className="size-4 text-[#274690]" />
                เอกสารต่อเนื่อง
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 px-5 py-5">
              {chainDocuments
                .filter((doc) => doc.id !== currentDocument.id)
                .map((doc) => {
                  const isSelected = selectedChainIds.includes(doc.id);
                  return (
                    <div
                      key={doc.id}
                      onClick={() => toggleSelected(doc, !isSelected)}
                      className="group flex w-full cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface px-3 py-3 text-left text-[13px] transition hover:border-border hover:bg-surface-secondary"
                    >
                      <div
                        className="shrink-0 pt-0.5"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            toggleSelected(doc, checked === true)
                          }
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="rounded-full border border-border bg-surface-secondary px-2 py-0.5 text-xs font-medium text-foreground">
                            {documentTypeLabels[doc.type]}
                          </span>
                          <span className="font-medium text-foreground">
                            {doc.docNumber}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            สร้าง {formatDocumentCreatedAt(doc)}
                          </span>
                          {referenceLinkOnlyIds.has(doc.id) ? (
                            <span className="rounded-full border border-dashed border-border bg-surface-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              อ้างอิงเลขที่
                            </span>
                          ) : null}
                          <Button
                            type="button"
                            variant="link"
                            className="hidden h-auto p-0 text-xs font-semibold text-[#3559C7] underline-offset-2 group-hover:inline-flex"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(
                                `/documents/detail?id=${encodeURIComponent(doc.id)}`,
                              );
                            }}
                          >
                            ดูเพิ่มเติม
                          </Button>
                        </div>
                        <div className="mt-2">
                          <StatusBadge {...getDocumentStatusDisplay(doc)} />
                        </div>
                      </div>
                      <div className="shrink-0 pt-0.5 text-right text-xs font-semibold text-foreground">
                        {(doc.total ?? 0).toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  );
                })}

              <div className="rounded-xl border border-accent/20 bg-accent-soft p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <CheckCircle2 className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-accent/20 bg-surface px-2 py-0.5 text-xs font-semibold text-accent-soft-foreground">
                        {documentTypeLabels[currentDocument.type]}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {currentDocument.docNumber}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        สร้าง {formatDocumentCreatedAt(currentDocument)}
                      </span>
                      <span className="text-xs text-muted-foreground">◀ ปัจจุบัน</span>
                    </div>
                    <div className="mt-2">
                      <StatusBadge
                        {...getDocumentStatusDisplay(currentDocument)}
                      />
                    </div>
                  </div>
                  <div className="text-right text-base font-semibold text-[#274690]">
                    {(currentDocument.total ?? 0).toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              </div>

              {nextActionsToShow.map((action) => (
                <button
                  key={`${action.hint}-${action.nextType}`}
                  type="button"
                  onClick={() => handleCreateNext(action.nextType)}
                  className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-surface px-3 py-3 text-left text-[13px] transition hover:border-accent/30 hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                    {action.hint === "skip" ? (
                      <span className="text-xs font-medium text-muted-foreground">
                        {"ข้าม ->"}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-border bg-surface-secondary px-2 py-0.5 text-xs font-medium text-foreground">
                      {documentTypeLabels[action.nextType]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {action.hint === "special" ? "เอกสารพิเศษ" : action.label}
                    </span>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted" />
                </button>
              ))}

              {selectedDocumentsOrdered.length > 0 ? (
                <div className="flex items-center justify-end gap-3 pt-2">
                  <span className="text-xs text-muted-foreground">
                    เลือกแล้ว {selectedDocumentsOrdered.length} ฉบับ
                    (รวมเอกสารนี้)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg text-xs"
                    disabled={exporting !== null}
                    onClick={() => openExportAction("multi-print")}
                  >
                    <Printer className="size-3.5" />
                    พิมพ์ที่เลือก
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg text-xs"
                    disabled={exporting !== null}
                    onClick={() => openExportAction("multi-pdf")}
                  >
                    <FileDown className="size-3.5" />
                    ดาวน์โหลด PDF
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-4">
            <Card className="rounded-2xl bg-surface py-0">
              <CardContent className="px-5 py-5">
                <div className="text-xs text-muted-foreground">ยอดรวมสุทธิ</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-[#274690]">
                  {(currentDocument.total ?? 0).toLocaleString("th-TH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl bg-surface py-0">
              <CardContent className="px-5 py-5">
                <div className="text-xs text-muted-foreground">
                  {DOC_TYPE_CONFIG[currentDocument.type as ExtDocType]
                    ?.partnerRole === "vendor"
                    ? "ผู้ขาย"
                    : "ลูกค้า"}
                </div>
                <div className="mt-2 text-lg font-semibold leading-snug text-foreground">
                  {partnerName || "—"}
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl bg-surface py-0">
              <CardContent className="px-5 py-5">
                <div className="text-xs text-muted-foreground">รายการ</div>
                <div className="mt-2 text-lg font-semibold text-foreground">
                  {itemCount} รายการ
                </div>
              </CardContent>
            </Card>
          </div>

          <div ref={previewSectionRef}>
            <Card className="rounded-2xl bg-surface py-0">
              <CardHeader className="border-b border-border/80 py-3.5">
                <CardTitle className="text-base font-semibold text-foreground">
                  พรีวิวเอกสาร
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 py-5">
                <DocumentPreviewRenderer
                  step1Data={step1Data}
                  step2Data={step2Data}
                  step3Data={step3Data}
                />
              </CardContent>
            </Card>
          </div>

          <div className="pointer-events-none fixed left-[-10000px] top-0">
            <PreviewStack
              docs={[currentDocument]}
              innerRef={currentPrintRef}
              docVariant={docVariant}
            />
            <PreviewStack
              docs={selectedDocumentsOrdered}
              innerRef={multiPrintRef}
              docVariant={docVariant}
            />
          </div>
        </div>
      </div>

      <Dialog
        open={variantPickerAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setVariantPickerAction(null);
            setPendingPdfAction(null);
          }
        }}
      >
        <DialogContent className="max-w-sm gap-4">
          <DialogHeader>
            <DialogTitle>
              เลือกรูปแบบก่อน
              {variantPickerAction?.includes("print")
                ? "พิมพ์"
                : "ดาวน์โหลด PDF"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleVariantSelect("original")}
              className="flex w-full items-center gap-4 rounded-xl border border-border/60 bg-background px-4 py-3 text-left transition hover:border-primary/50 hover:bg-primary/5"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-foreground">
                <FileText className="size-5" />
              </div>
              <div>
                <div className="font-semibold leading-tight">ต้นฉบับ</div>
                <div className="text-sm text-muted-foreground">
                  เอกสารฉบับจริง
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleVariantSelect("copy")}
              className="flex w-full items-center gap-4 rounded-xl border border-border/60 bg-background px-4 py-3 text-left transition hover:border-orange-300 hover:bg-orange-50"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-500">
                <Copy className="size-5" />
              </div>
              <div>
                <div className="font-semibold leading-tight">สำเนา</div>
                <div className="text-sm text-muted-foreground">สำเนาเอกสาร</div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showFilenameDialog}
        onOpenChange={(open) => {
          setShowFilenameDialog(open);
          if (!open) setPendingPdfAction(null);
        }}
      >
        <DialogContent className="max-w-sm gap-6">
          <button
            type="button"
            onClick={() => setShowFilenameDialog(false)}
            className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground opacity-70 hover:opacity-100"
          >
            <X className="size-4" />
          </button>
          <div className="flex flex-col items-center gap-4 pt-2">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-surface-secondary">
              <FileDown className="size-8 text-[#334FA3]" />
            </div>
            <DialogTitle className="text-lg">ตั้งชื่อไฟล์ PDF</DialogTitle>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">ชื่อไฟล์</label>
            <div className="flex items-center overflow-hidden rounded-lg border border-[#334FA3] bg-background ring-1 ring-[#334FA3]/40 focus-within:ring-[#334FA3]">
              <Input
                value={pdfFilename}
                onChange={(event) => setPdfFilename(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handlePdfConfirm();
                }}
                className="flex-1 border-0 shadow-none focus-visible:ring-0"
                autoFocus
              />
              <span className="shrink-0 pr-3 text-sm text-muted-foreground">
                .pdf
              </span>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setShowFilenameDialog(false)}
            >
              ยกเลิก
            </Button>
            <Button
              className="gap-2 rounded-xl"
              onClick={() => void handlePdfConfirm()}
            >
              <FileDown className="size-4" />
              ดาวน์โหลด
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
