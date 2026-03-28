"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import {
  Building2,
  Copy,
  Download,
  FileDown,
  FileText,
  Maximize2,
  Printer,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  COMPANY_NAME_FONT_SIZE,
  DOC_TYPE_CONFIG,
  type ExtDocType,
} from "@/lib/doc-types";
import type { Step1FormValues } from "@/lib/schemas/document-draft";
import type { Step2FormValues } from "@/lib/schemas/document-step2";
import {
  buildDefaultStep2Values,
  computeTotals,
  bahtToWords,
} from "@/lib/schemas/document-step2";
import {
  buildDefaultStep3Values,
  getPaymentTermLabel,
  PAYMENT_METHODS,
  SIGNATURE_ROLE_PREFIX,
  type SignatureRole,
  type Step3FormValues,
} from "@/lib/schemas/document-step3";
import { useCompanyStore } from "@/stores/company-store";

// ── แปลง oklch() → rgb() ก่อนส่งให้ html2canvas (v1.x ยังไม่รองรับ oklch) ──
function oklch2rgb(L: number, C: number, H: number, A = 1): string {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ ** 3,
    m3 = m_ ** 3,
    s3 = s_ ** 3;
  const rL = 4.076741662 * l3 - 3.307711591 * m3 + 0.230969929 * s3;
  const gL = -1.268438005 * l3 + 2.609757401 * m3 - 0.341319396 * s3;
  const bL = -0.004196086 * l3 - 0.703418615 * m3 + 1.695608672 * s3;
  const gc = (c: number) =>
    c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  const r = Math.round(Math.max(0, Math.min(1, gc(rL))) * 255);
  const g = Math.round(Math.max(0, Math.min(1, gc(gL))) * 255);
  const bv = Math.round(Math.max(0, Math.min(1, gc(bL))) * 255);
  return A < 1 ? `rgba(${r},${g},${bv},${A})` : `rgb(${r},${g},${bv})`;
}

function convertOklch(val: string): string {
  return val.replace(
    /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.%]+))?\s*\)/g,
    (_, L, C, H, Astr) => {
      const alpha = Astr
        ? Astr.includes("%")
          ? parseFloat(Astr) / 100
          : parseFloat(Astr)
        : 1;
      return oklch2rgb(parseFloat(L), parseFloat(C), parseFloat(H), alpha);
    },
  );
}

function fixOklchInClone(clonedDoc: Document) {
  // แปลง CSS custom properties ที่มี oklch บน :root ใน cloned document
  const rootStyle = window.getComputedStyle(document.documentElement);
  const overrides = ([...rootStyle] as string[])
    .filter((p) => p.startsWith("--"))
    .map((name) => {
      const val = rootStyle.getPropertyValue(name).trim();
      if (!val.includes("oklch")) return null;
      return `${name}: ${convertOklch(val)};`;
    })
    .filter(Boolean)
    .join("\n");

  if (overrides) {
    const style = clonedDoc.createElement("style");
    style.textContent = `:root { ${overrides} }`;
    clonedDoc.head.appendChild(style);
  }

  // แปลง inline style attribute ที่อาจมี oklch ด้วย
  clonedDoc.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    const s = el.getAttribute("style") ?? "";
    if (s.includes("oklch")) el.setAttribute("style", convertOklch(s));
  });
}

// ── lazy import เพื่อไม่ให้ bundle size โตตอนโหลดหน้า ──
async function renderToPdf(el: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    onclone: (_clonedDoc) => fixOklchInClone(_clonedDoc),
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const A4_W = 210; // mm
  const A4_H = 297; // mm

  // คำนวณ height จริงของเนื้อหา (proportional กับ A4 width)
  const pixelRatio = canvas.width / A4_W;
  const contentHeightMm = canvas.height / pixelRatio;

  const pdf = new jsPDF({
    orientation: contentHeightMm > A4_H ? "portrait" : "portrait",
    unit: "mm",
    format: "a4",
  });

  // ถ้าเนื้อหายาวกว่า 1 หน้า → ตัดหลายหน้า
  if (contentHeightMm <= A4_H) {
    pdf.addImage(imgData, "JPEG", 0, 0, A4_W, contentHeightMm);
  } else {
    let remainingHeight = canvas.height;
    let yOffset = 0;
    const pageHeightPx = A4_H * pixelRatio;

    while (remainingHeight > 0) {
      const sliceH = Math.min(pageHeightPx, remainingHeight);

      // สร้าง canvas ตัดเฉพาะส่วนของหน้านั้น
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH;
      const ctx = pageCanvas.getContext("2d")!;
      ctx.drawImage(canvas, 0, -yOffset);

      const sliceData = pageCanvas.toDataURL("image/jpeg", 0.95);
      const sliceHeightMm = sliceH / pixelRatio;

      if (yOffset > 0) pdf.addPage();
      pdf.addImage(sliceData, "JPEG", 0, 0, A4_W, sliceHeightMm);

      yOffset += pageHeightPx;
      remainingHeight -= pageHeightPx;
    }
  }

  pdf.save(`${filename}.pdf`);
}

async function printElement(el: HTMLElement) {
  const { default: html2canvas } = await import("html2canvas");

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    onclone: (_clonedDoc) => fixOklchInClone(_clonedDoc),
  });

  const imgData = canvas.toDataURL("image/png");
  const win = window.open("", "_blank");
  if (!win) return;

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          @page { margin: 0; size: A4 portrait; }
          body { margin: 0; padding: 0; background: white; }
          img { width: 210mm; display: block; }
        </style>
      </head>
      <body>
        <img src="${imgData}" />
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        <\/script>
      </body>
    </html>
  `);
  win.document.close();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatThaiDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getCompanyEnglishName(company: unknown): string {
  const c = company as Record<string, unknown> | null;
  if (!c) return "";
  const candidates = [
    c.nameEn,
    c.companyNameEn,
    c.englishName,
    c.nameEnglish,
    c.enName,
  ];
  const found = candidates.find((v) => typeof v === "string" && v.trim());
  return typeof found === "string" ? found.trim() : "";
}

/** แสดงชื่อตามประเภทสำนักงาน: สำนักงานใหญ่ / สาขา + ชื่อสาขา */
function formatNameWithOffice(
  name: string,
  office: {
    officeType: "none" | "hq" | "branch";
    branchName?: string | null;
  },
): string {
  const n = name.trim();
  if (!n) return n;
  if (office.officeType === "hq") return `${n} (สำนักงานใหญ่)`;
  if (office.officeType === "branch") {
    const bn = office.branchName?.trim();
    if (bn) return `${n} (สาขา${bn})`;
  }
  return n;
}

function isRenderablePreviewItem(item: Step2FormValues["items"][number]) {
  return Boolean(
    item.selectedItemCode.trim() ||
    item.title.trim() ||
    item.description.trim() ||
    item.unit.trim() ||
    item.unitPrice > 0 ||
    item.discountValue > 0,
  );
}

function SignaturePreview({
  title,
  signerName,
  signatureImageUrl,
  signatureDate,
}: {
  title: string;
  signerName: string;
  signatureImageUrl: string;
  signatureDate: string;
}) {
  return (
    <div className="w-[180px] text-center">
      <div className="mb-2 text-xs font-medium text-[#334FA3]">{title}</div>
      <div className="h-14 flex items-center justify-center">
        {signatureImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signatureImageUrl}
            alt="signature"
            className="h-12 object-contain"
          />
        ) : null}
      </div>
      <div className="border-t border-dashed border-[#D8DDEA] pt-1 text-xs text-[#4A5568]">
        ({signerName || "................................"})
      </div>
      <div className="text-[11px] text-[#8A94A6]">
        วันที่ {formatThaiDate(signatureDate) || "____/____/______"}
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step1Data: Step1FormValues | null;
  step2Data: Step2FormValues | null;
  step3Data?: Step3FormValues | null;
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const A4_WIDTH_PX = (A4_WIDTH_MM / 25.4) * 96;
const A4_HEIGHT_PX = (A4_HEIGHT_MM / 25.4) * 96;
/** ขนาดตราประทับบนเอกสาร / PDF — 50×50 mm */
const STAMP_SIZE_MM = 50;
const STAMP_SIZE_PX = (STAMP_SIZE_MM / 25.4) * 96;
const PREVIEW_MIN_SCALE = 0.55;
const PREVIEW_MAX_SCALE = 1.6;

// ─── Component ────────────────────────────────────────────────────────────────

export function PreviewDialog({
  open,
  onOpenChange,
  step1Data,
  step2Data,
  step3Data,
}: PreviewDialogProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stampBoxRef = useRef<HTMLDivElement>(null);
  const stampRotateDragRef = useRef<{
    cx: number;
    cy: number;
    startAngle: number;
    startRotation: number;
  } | null>(null);
  const [stampPos, setStampPos] = useState({ x: 430, y: 240 });
  /** องศาหมุนตราประทับ (รอบจุดศูนย์กลาง) — ตรงกับ PDF */
  const [stampRotation, setStampRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [fitScale, setFitScale] = useState(1);
  const [zoomScale, setZoomScale] = useState<number | null>(null);

  /** ต้นฉบับ หรือ สำเนา — กำหนดก่อนพิมพ์/ดาวน์โหลด */
  const [docVariant, setDocVariant] = useState<"original" | "copy">("copy");
  /** action ที่กำลังรอเลือก variant — null = ปิด picker */
  const [variantPickerAction, setVariantPickerAction] = useState<
    "print" | "download" | null
  >(null);
  const [showFilenameDialog, setShowFilenameDialog] = useState(false);
  const [pdfFilename, setPdfFilename] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  const fallbackStep2 = useMemo(() => {
    const defaults = buildDefaultStep2Values();
    return {
      ...defaults,
      items: [],
      visibleColumns: {
        index: true,
        code: true,
        itemName: true,
        description: false,
        quantity: true,
        unit: true,
        unitPrice: true,
        discount: true,
        vat: false,
      },
    };
  }, []);

  const previewStep2 = step2Data ?? fallbackStep2;
  const step3 = step3Data ?? buildDefaultStep3Values();

  const totals = useMemo(() => computeTotals(previewStep2), [previewStep2]);

  /** สำเนาใน snapshot อาจไม่มี logoUrl (zod omit / ฟอร์มไม่ได้ register) — ดึงจาก Firestore store */
  const previewCompanyId = step1Data?.selectedCompanyId ?? null;
  const liveCompanyLogoUrl = useCompanyStore((s) => {
    if (!previewCompanyId) return "";
    const c = s.companies.find((x) => x.id === previewCompanyId);
    return c?.logoUrl?.trim() ?? "";
  });

  // Hooks ต้องอยู่ก่อน early return ทุกตัว
  const handleDownloadConfirm = useCallback(async () => {
    if (!pageRef.current) return;
    setShowFilenameDialog(false);
    setPdfLoading(true);
    try {
      await renderToPdf(pageRef.current, pdfFilename.trim() || "document");
    } finally {
      setPdfLoading(false);
    }
  }, [pdfFilename]);

  useEffect(() => {
    if (!open) return;

    function updateScale() {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const nextScale = Math.min(
        (viewport.clientWidth - 32) / A4_WIDTH_PX,
        (viewport.clientHeight - 32) / A4_HEIGHT_PX,
      );

      setFitScale(
        Math.max(PREVIEW_MIN_SCALE, Math.min(PREVIEW_MAX_SCALE, nextScale)),
      );
    }

    updateScale();

    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateScale);
      return () => window.removeEventListener("resize", updateScale);
    }

    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    window.addEventListener("resize", updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setZoomScale(null);
    }
  }, [open]);

  // Guard: need at least step1
  if (!step1Data) return null;

  const docType = step1Data.documentType as ExtDocType;
  const docLabel = DOC_TYPE_CONFIG[docType]?.label ?? "เอกสาร";
  const docLabelEn = DOC_TYPE_CONFIG[docType]?.labelEn ?? "";
  const partnerRole = DOC_TYPE_CONFIG[docType]?.partnerRole ?? "customer";
  const company = step1Data.companySnapshot;
  const companyLogoUrl = company.logoUrl?.trim() || liveCompanyLogoUrl || "";
  /** ตราประทับแบบ logo: ใช้ stampImageUrl หรือ fallback โลโก้บริษัท (กรณี async ยังไม่ประมวลผล / snapshot ไม่มี data URL) */
  const stampDisplayUrl = !step3.stamp.enabled
    ? ""
    : step3.stamp.sourceType === "logo"
      ? step3.stamp.stampImageUrl?.trim() || companyLogoUrl
      : (step3.stamp.stampImageUrl?.trim() ?? "");
  const companyEnglishName = getCompanyEnglishName(company);
  const companyNameFontPx = COMPANY_NAME_FONT_SIZE[step1Data.companyNameSize];
  const partner = step1Data.partnerSnapshot;
  const cols = previewStep2.visibleColumns;
  const previewItems = previewStep2.items.filter(isRenderablePreviewItem);
  const visibleColCount = [
    cols.index,
    cols.code,
    cols.itemName,
    cols.description,
    cols.quantity,
    cols.unit,
    cols.unitPrice,
    cols.discount,
    cols.vat,
    true,
  ].filter(Boolean).length;
  const previewVatRate =
    previewStep2.vat.vatRate > 0 ? previewStep2.vat.vatRate : 7;
  const amountInWords =
    totals.netTotal > 0 ? bahtToWords(totals.netTotal) : "ศูนย์บาทถ้วน";
  const enabledSignatures = (
    Object.keys(step3.signatures) as SignatureRole[]
  ).filter((role) => step3.signatures[role].enabled);

  const paymentVisible = step3.paymentMethods.visibleMethods ?? [];
  const paymentChecked = step3.paymentMethods.checkedMethods ?? [];

  function onPrint() {
    setVariantPickerAction("print");
  }

  function onDownloadPdf() {
    setVariantPickerAction("download");
  }

  function handleVariantSelect(variant: "original" | "copy") {
    setDocVariant(variant);
    const action = variantPickerAction;
    setVariantPickerAction(null);
    if (action === "print") {
      // รอ React render badge ใหม่ก่อน capture
      setTimeout(() => {
        if (!pageRef.current) return;
        printElement(pageRef.current);
      }, 150);
    } else if (action === "download") {
      setPdfFilename(step1Data?.documentNumber || docLabel);
      setShowFilenameDialog(true);
    }
  }

  function dragStampStart(e: React.MouseEvent<HTMLDivElement>) {
    if (!step3.stamp.enabled || !stampDisplayUrl || !pageRef.current) return;
    e.preventDefault();
    const rect = pageRef.current.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    const ox = stampPos.x;
    const oy = stampPos.y;
    const scaleX = rect.width / A4_WIDTH_PX;
    const scaleY = rect.height / A4_HEIGHT_PX;
    setDragging(true);

    function onMove(ev: MouseEvent) {
      const w = STAMP_SIZE_PX;
      const h = STAMP_SIZE_PX;
      setStampPos({
        x: Math.max(
          0,
          Math.min(ox + (ev.clientX - sx) / scaleX, A4_WIDTH_PX - w),
        ),
        y: Math.max(
          0,
          Math.min(oy + (ev.clientY - sy) / scaleY, A4_HEIGHT_PX - h),
        ),
      });
    }
    function onUp() {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function stampRotatePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.preventDefault();
    const el = stampBoxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    stampRotateDragRef.current = {
      cx,
      cy,
      startAngle: Math.atan2(e.clientY - cy, e.clientX - cx),
      startRotation: stampRotation,
    };
    e.currentTarget.setPointerCapture(e.pointerId);

    function onRotateMove(ev: PointerEvent) {
      const r = stampRotateDragRef.current;
      if (!r) return;
      const angle = Math.atan2(ev.clientY - r.cy, ev.clientX - r.cx);
      let delta = angle - r.startAngle;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;
      const deg = r.startRotation + (delta * 180) / Math.PI;
      setStampRotation(((deg % 360) + 360) % 360);
    }

    function onRotateEnd() {
      stampRotateDragRef.current = null;
      window.removeEventListener("pointermove", onRotateMove);
      window.removeEventListener("pointerup", onRotateEnd);
      window.removeEventListener("pointercancel", onRotateEnd);
    }

    window.addEventListener("pointermove", onRotateMove);
    window.addEventListener("pointerup", onRotateEnd);
    window.addEventListener("pointercancel", onRotateEnd);
  }

  const previewScale = zoomScale ?? fitScale;
  const zoomPercent = Math.round(previewScale * 100);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="h-[92vh] w-[96vw] min-w-[900px] gap-0 overflow-hidden rounded-[28px] p-0"
        >
          <div
            className="flex h-full max-h-[92vh] flex-col"
            style={{ backgroundColor: "#d1d5db" }}
          >
            <DialogHeader className="m-0 border-b border-border/60 bg-white px-8 py-6">
              <DialogTitle className="pr-14 text-[20px] font-bold text-[#111827]">
                พรีวิว {docLabel}{" "}
                {step1Data.documentNumber
                  ? `· ${step1Data.documentNumber}`
                  : ""}
              </DialogTitle>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="absolute right-6 top-5 rounded-full p-2 text-[#6B7280] transition hover:bg-slate-100 hover:text-[#111827]"
                aria-label="ปิด"
              >
                <X className="size-7" />
              </button>
            </DialogHeader>

            <div
              ref={viewportRef}
              className="flex flex-1 items-start justify-center overflow-auto bg-[#D8DDE6] px-6 py-4"
            >
              <div
                className="relative flex justify-center"
                style={{
                  width: A4_WIDTH_PX * previewScale,
                  minWidth: A4_WIDTH_PX * previewScale,
                  height: A4_HEIGHT_PX * previewScale,
                }}
              >
                <div
                  className="absolute left-0 top-0"
                  style={{
                    transform: `scale(${previewScale})`,
                    transformOrigin: "top center",
                  }}
                >
                  <div
                    ref={pageRef}
                    className="print-document flex flex-col overflow-hidden border border-[#D6DBE7] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.10)]"
                    style={{
                      width: A4_WIDTH_PX,
                      minHeight: A4_HEIGHT_PX,
                    }}
                  >
                    <div className="flex-1 px-[52px] pb-[58px] pt-[56px] text-[#111827]">
                      {/* Preview badge */}
                      <div className="mb-4 flex justify-end">
                        {docVariant === "original" ? (
                          <div className="inline-flex items-center gap-1 rounded-md border border-[#C9D4EE] bg-[#EEF2FF] px-4 py-2 text-[13px] font-semibold text-[#334FA3]">
                            ต้นฉบับ
                          </div>
                        ) : (
                          <div className="inline-flex rounded-md bg-[#F1F3F6] px-4 py-2 text-[13px] font-medium text-[#7B8190]">
                            สำเนา
                          </div>
                        )}
                      </div>
                      {/* ── Header ── */}
                      <div className="flex justify-between gap-8">
                        <div className="flex min-w-0 flex-1 gap-6">
                          <div
                            className={cn(
                              "flex size-[88px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#F8FAFD]",
                            )}
                          >
                            {companyLogoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={companyLogoUrl}
                                alt=""
                                className="size-full object-cover"
                              />
                            ) : (
                              <div className="flex size-full flex-col items-center justify-center gap-1 bg-[#EEF2FF] text-[#334FA3]">
                                <Building2 className="size-8 shrink-0 opacity-80" />
                                <span className="text-[11px] font-semibold leading-none">
                                  บ.
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div
                              className="font-bold leading-tight text-[#2E4CB7]"
                              style={{ fontSize: companyNameFontPx }}
                            >
                              {formatNameWithOffice(company.name, company)}
                            </div>
                            {companyEnglishName ? (
                              <div className="mt-2 text-[12px] font-medium text-[#6B7280]">
                                {companyEnglishName}
                              </div>
                            ) : null}
                            {company.address ? (
                              <div className="mt-2 text-[11px] text-[#6B7280]">
                                {company.address}
                              </div>
                            ) : null}
                            {company.phone || company.email ? (
                              <div className="text-[11px] text-[#6B7280]">
                                {[
                                  company.phone && `โทรศัพท์: ${company.phone}`,
                                  company.email,
                                ]
                                  .filter(Boolean)
                                  .join(" | ")}
                              </div>
                            ) : null}
                            {company.taxId ? (
                              <div className="text-[11px] text-[#6B7280]">
                                เลขประจำตัวผู้เสียภาษี: {company.taxId}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[24px] font-bold leading-tight text-[#2E4CB7]">
                            {docLabel}
                          </div>
                          {docLabelEn ? (
                            <div className="mt-2 text-[14px] font-medium text-[#6B7280]">
                              {docLabelEn}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {/* ── Partner ── */}
                      <div className="mt-8 flex items-start justify-between gap-8">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 text-[11px] font-semibold text-[#4B5563] underline underline-offset-2">
                            {partnerRole === "vendor" ? "ผู้ขาย" : "ลูกค้า"}
                          </div>
                          {partner.name ? (
                            <div className="text-[12px] font-medium">
                              {formatNameWithOffice(partner.name, partner)}
                            </div>
                          ) : (
                            <div className="text-[12px] font-medium leading-6 text-[#9CA3AF]">
                              {partnerRole === "vendor"
                                ? "ยังไม่ได้เลือกผู้ขาย"
                                : "ยังไม่ได้เลือกลูกค้า"}
                            </div>
                          )}
                          {partner.address ? (
                            <div className="text-[11px] text-[#6B7280]">
                              {partner.address}
                            </div>
                          ) : null}
                          {partner.phone || partner.email ? (
                            <div className="text-[11px] text-[#6B7280]">
                              {[partner.phone, partner.email]
                                .filter(Boolean)
                                .join(" | ")}
                            </div>
                          ) : null}
                          {partner.taxId ? (
                            <div className="text-[11px] text-[#6B7280]">
                              เลขประจำตัวผู้เสียภาษี: {partner.taxId}
                            </div>
                          ) : null}
                          {partner.contactName?.trim() ? (
                            <div className="text-[11px] text-[#6B7280]">
                              ผู้ติดต่อ: {partner.contactName.trim()}
                            </div>
                          ) : null}
                        </div>

                        <table className="doc-meta-table border-collapse text-[11px]">
                          <tbody>
                            <tr>
                              <td className="doc-meta-label align-top font-semibold text-[#2E4CB7] pr-2">
                                เลขที่เอกสาร
                              </td>
                              <td className="doc-meta-value min-w-[120px] pl-2 align-top font-semibold text-[#111827]">
                                {step1Data.documentNumber || "________________"}
                              </td>
                            </tr>
                            <tr>
                              <td className="doc-meta-label align-top font-semibold text-[#2E4CB7] pr-2">
                                วันที่
                              </td>
                              <td className="doc-meta-value min-w-[120px] pl-2 align-top font-semibold text-[#111827]">
                                {formatThaiDate(step1Data.documentDate) ||
                                  "___ / ___ / ______"}
                              </td>
                            </tr>
                            {step1Data.extraDateValue ? (
                              <tr>
                                <td className="doc-meta-label align-top font-semibold text-[#2E4CB7] pr-2">
                                  {DOC_TYPE_CONFIG[docType]?.extraDateLabel}
                                </td>
                                <td className="doc-meta-value min-w-[120px] pl-2 align-top font-semibold text-[#111827]">
                                  {formatThaiDate(step1Data.extraDateValue)}
                                </td>
                              </tr>
                            ) : null}
                            {step1Data.showReferenceNumber &&
                            step1Data.referenceNumber ? (
                              <tr>
                                <td className="doc-meta-label align-top font-semibold text-[#2E4CB7] pr-2">
                                  เลขอ้างอิง
                                </td>
                                <td className="doc-meta-value min-w-[120px] pl-2 align-top font-semibold text-[#111827]">
                                  {step1Data.referenceNumber}
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>

                      {/* ── Items table ── */}
                      <div className="mt-8 border border-b-0 border-[#DEE3F3] bg-[#E9EDFB] px-4 py-2 text-[12px] font-semibold text-[#334FA3]">
                        รายการสินค้า / บริการ
                      </div>
                      <table className="mt-0 w-full table-fixed border border-[#DEE3F3] text-[11px]">
                        <thead className="bg-[#F8FAFD] text-[#4A5568]">
                          <tr>
                            {cols.index ? (
                              <th className="w-8 max-w-8 border border-[#DEE3F3] p-2 text-center">
                                #
                              </th>
                            ) : null}
                            {cols.code ? (
                              <th className="w-[4.5rem] max-w-[4.5rem] border border-[#DEE3F3] p-2 text-center">
                                รหัส
                              </th>
                            ) : null}
                            {cols.itemName ? (
                              <th className="min-w-0 border border-[#DEE3F3] p-2 text-left">
                                รายการ
                              </th>
                            ) : null}
                            {cols.description ? (
                              <th className="min-w-0 border border-[#DEE3F3] p-2 text-left">
                                รายละเอียด
                              </th>
                            ) : null}
                            {cols.quantity ? (
                              <th className="w-[3.25rem] max-w-[3.25rem] border border-[#DEE3F3] p-2 text-center">
                                จำนวน
                              </th>
                            ) : null}
                            {cols.unit ? (
                              <th className="w-12 max-w-[3rem] border border-[#DEE3F3] p-2 text-center">
                                หน่วย
                              </th>
                            ) : null}
                            {cols.unitPrice ? (
                              <th className="w-[4.5rem] max-w-[4.5rem] border border-[#DEE3F3] p-2 text-right">
                                ราคา/หน่วย
                              </th>
                            ) : null}
                            {cols.discount ? (
                              <th className="w-[4rem] max-w-[4rem] border border-[#DEE3F3] p-2 text-right">
                                ส่วนลด
                              </th>
                            ) : null}
                            {cols.vat ? (
                              <th className="w-[3.5rem] max-w-[3.5rem] border border-[#DEE3F3] p-2 text-center">
                                ภาษี
                              </th>
                            ) : null}
                            <th className="w-[4.5rem] max-w-[4.5rem] border border-[#DEE3F3] p-2 text-right">
                              รวม
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewItems.length > 0 ? (
                            previewItems.map((it, idx) => {
                              const base = it.quantity * it.unitPrice;
                              const dis =
                                it.discountType === "percent"
                                  ? base * (it.discountValue / 100)
                                  : Math.min(it.discountValue, base);
                              const lineTotal = base - dis;
                              return (
                                <tr key={it.id}>
                                  {cols.index ? (
                                    <td className="w-8 max-w-8 border border-[#DEE3F3] p-2 text-center whitespace-nowrap">
                                      {idx + 1}
                                    </td>
                                  ) : null}
                                  {cols.code ? (
                                    <td className="w-[4.5rem] max-w-[4.5rem] border border-[#DEE3F3] p-2 text-center break-words">
                                      {it.selectedItemCode || "-"}
                                    </td>
                                  ) : null}
                                  {cols.itemName ? (
                                    <td className="min-w-0 border border-[#DEE3F3] p-2 break-words">
                                      {it.title || "-"}
                                    </td>
                                  ) : null}
                                  {cols.description ? (
                                    <td className="min-w-0 border border-[#DEE3F3] p-2 break-words">
                                      {it.description || "-"}
                                    </td>
                                  ) : null}
                                  {cols.quantity ? (
                                    <td className="w-[3.25rem] max-w-[3.25rem] border border-[#DEE3F3] p-2 text-center whitespace-nowrap">
                                      {it.quantity}
                                    </td>
                                  ) : null}
                                  {cols.unit ? (
                                    <td className="w-12 max-w-[3rem] border border-[#DEE3F3] p-2 text-center break-words">
                                      {it.unit || "-"}
                                    </td>
                                  ) : null}
                                  {cols.unitPrice ? (
                                    <td className="w-[5.5rem] max-w-[5.5rem] border border-[#DEE3F3] p-2 text-right whitespace-nowrap">
                                      {fmt(it.unitPrice)}
                                    </td>
                                  ) : null}
                                  {cols.discount ? (
                                    <td className="w-[4rem] max-w-[4rem] border border-[#DEE3F3] p-2 text-right whitespace-nowrap">
                                      {it.discountValue > 0
                                        ? it.discountType === "percent"
                                          ? `${it.discountValue}%`
                                          : fmt(it.discountValue)
                                        : "-"}
                                    </td>
                                  ) : null}
                                  {cols.vat ? (
                                    <td className="w-[3.5rem] max-w-[3.5rem] border border-[#DEE3F3] p-2 text-center whitespace-nowrap">
                                      {it.vatRate === -1
                                        ? "ยกเว้น"
                                        : it.vatRate === 0
                                          ? "-"
                                          : `${it.vatRate}%`}
                                    </td>
                                  ) : null}
                                  <td className="w-[6rem] max-w-[6rem] border border-[#DEE3F3] p-2 text-right whitespace-nowrap">
                                    {fmt(lineTotal)}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td
                                className="h-20 border border-[#DEE3F3] p-4 text-center text-[#A0A7B5]"
                                colSpan={visibleColCount}
                              >
                                ไม่มีรายการ
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>

                      {/* ── Summary + Terms (หมายเหตุไว้ด้านล่างสุดหลังลายเซ็น) ── */}
                      <div className="mt-7 flex justify-between gap-8">
                        <div className="min-w-0 flex-1 text-[14px] leading-6">
                          {step3.terms.text.trim() ? (
                            <>
                              <div className="mb-1 font-semibold">
                                ข้อกำหนดและเงื่อนไข
                              </div>
                              <div className="whitespace-pre-wrap text-[#4B5563]">
                                {step3.terms.text}
                              </div>
                            </>
                          ) : null}
                        </div>
                        <div className="w-[280px] text-[12px] text-[#4A5568]">
                          <div className="flex justify-between py-1.5">
                            <span>รวมเงิน</span>
                            <span className="text-[#111827]">
                              {fmt(totals.itemSubtotal)}
                            </span>
                          </div>
                          {totals.rowDiscountTotal > 0 ? (
                            <div className="flex justify-between py-1.5">
                              <span>ส่วนลดรายการ</span>
                              <span className="text-[#111827]">
                                -{fmt(totals.rowDiscountTotal)}
                              </span>
                            </div>
                          ) : null}
                          {totals.documentDiscountTotal > 0 ? (
                            <div className="flex justify-between py-1.5">
                              <span>ส่วนลดรวม</span>
                              <span className="text-[#111827]">
                                -{fmt(totals.documentDiscountTotal)}
                              </span>
                            </div>
                          ) : null}
                          <div className="flex justify-between py-1.5">
                            <span>ภาษีมูลค่าเพิ่ม ({previewVatRate}%)</span>
                            <span className="text-[#111827]">
                              {fmt(totals.vatIncludedAmount || totals.vatTotal)}
                            </span>
                          </div>
                          {totals.whtTotal > 0 ? (
                            <div className="flex justify-between py-1.5">
                              <span>หัก ณ ที่จ่าย</span>
                              <span className="text-[#111827]">
                                -{fmt(totals.whtTotal)}
                              </span>
                            </div>
                          ) : null}
                          {totals.additionalFeeTotal > 0 ? (
                            <div className="flex justify-between py-1.5">
                              <span>ค่าใช้จ่ายเพิ่มเติม</span>
                              <span className="text-[#111827]">
                                {fmt(totals.additionalFeeTotal)}
                              </span>
                            </div>
                          ) : null}
                          <div className="mt-2 flex justify-between border border-[#DEE3F3] bg-[#E9EDFB] px-2 py-3 font-semibold text-[#334FA3]">
                            <span>ยอดสุทธิ</span>
                            <span className="text-[14px] leading-none">
                              {fmt(totals.netTotal)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-md border-2 border-[#4D67B0] bg-[#EEF2FF] px-4 py-3 text-center text-[14px] font-medium text-[#334FA3]">
                        ( {amountInWords} )
                      </div>

                      {/* ── Payment methods + term ── */}
                      {paymentVisible.length > 0 ||
                      step3.paymentTerm.enabled ? (
                        <div className="mt-4 text-[14px] leading-6">
                          {paymentVisible.length > 0 ? (
                            <>
                              <strong>ชำระโดย:</strong>{" "}
                              {paymentVisible
                                .map((k) => {
                                  const base =
                                    PAYMENT_METHODS.find((x) => x.key === k)
                                      ?.label ?? k;
                                  const label =
                                    k === "other" &&
                                    step3.paymentMethods.customOtherLabel.trim()
                                      ? step3.paymentMethods.customOtherLabel.trim()
                                      : base;
                                  return `${paymentChecked.includes(k) ? "[✓]" : "[ ]"} ${label}`;
                                })
                                .join(" ")}
                            </>
                          ) : null}
                          {step3.paymentTerm.enabled ? (
                            <>
                              {paymentVisible.length > 0 ? (
                                <span className="mx-2">|</span>
                              ) : null}
                              <strong>เงื่อนไขการชำระเงิน:</strong>{" "}
                              {step3.paymentTerm.paymentTermType === "custom"
                                ? step3.paymentTerm.customPaymentTermText
                                : getPaymentTermLabel(
                                    step3.paymentTerm.paymentTermType,
                                  )}
                            </>
                          ) : null}
                        </div>
                      ) : null}

                      {/* ── Signatures ── */}
                      <div className="pt-14">
                        {enabledSignatures.length > 0 ? (
                          <div
                            className={cn(
                              "flex w-full gap-5",
                              enabledSignatures.length === 1
                                ? "justify-start"
                                : "justify-between",
                            )}
                          >
                            {enabledSignatures.map((role) => {
                              const s = step3.signatures[role];
                              return (
                                <SignaturePreview
                                  key={role}
                                  title={
                                    s.titleText.trim() ||
                                    `${SIGNATURE_ROLE_PREFIX[role]}${docLabel}`
                                  }
                                  signerName={s.signerName}
                                  signatureImageUrl={s.signatureImageUrl}
                                  signatureDate={s.signatureDate}
                                />
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex w-full justify-start gap-5">
                            <SignaturePreview
                              title={`${SIGNATURE_ROLE_PREFIX.issuer}${docLabel}`}
                              signerName=""
                              signatureImageUrl=""
                              signatureDate=""
                            />
                          </div>
                        )}
                      </div>

                      {/* ── หมายเหตุ — ด้านล่างสุดของเนื้อหา (หลังลายเซ็น) ── */}
                      {step3.note.text.trim() ? (
                        <div className="mt-8 border-t border-[#E5E7EB] pt-4 text-[14px] leading-6">
                          <div className="mb-1 font-semibold text-[#111827]">
                            หมายเหตุ:
                          </div>
                          <div className="whitespace-pre-wrap text-[#4B5563]">
                            {step3.note.text}
                          </div>
                        </div>
                      ) : null}

                      {/* ── Stamp (draggable) ── */}
                      {step3.stamp.enabled && stampDisplayUrl ? (
                        <div
                          ref={stampBoxRef}
                          className={cn(
                            "absolute h-[50mm] w-[50mm] select-none",
                            dragging && "ring-1 ring-primary/50",
                          )}
                          style={{
                            left: stampPos.x,
                            top: stampPos.y,
                            transform: `rotate(${stampRotation}deg)`,
                            transformOrigin: "center center",
                          }}
                          title="ลากที่รูปเพื่อย้าย — ลากแถบบนเพื่อหมุน"
                        >
                          <div
                            className="absolute inset-0 cursor-move"
                            onMouseDown={dragStampStart}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={stampDisplayUrl}
                              alt="stamp"
                              className="pointer-events-none h-full w-full object-contain opacity-50 grayscale"
                              draggable={false}
                            />
                          </div>
                          {/* แฮนเดิลหมุน: ลากเป็นวงกลมรอบจุดศูนย์กลาง */}
                          <div
                            role="slider"
                            aria-valuemin={0}
                            aria-valuemax={359}
                            aria-valuenow={Math.round(stampRotation)}
                            aria-label="หมุนตราประทับ — ลากเพื่อหมุน"
                            className="absolute left-1/2 top-2 z-20 flex h-6 w-14 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border border-[#CBD5E1] bg-white shadow-md active:cursor-grabbing"
                            onPointerDown={stampRotatePointerDown}
                          >
                            <RotateCw className="size-3.5 text-[#475569]" />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-none border-t border-border/60 bg-white px-8 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    className="gap-2 rounded-xl border-[#CBD5E1] px-5 py-6 text-[15px]"
                    onClick={onPrint}
                  >
                    <Printer className="size-5" />
                    พิมพ์
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 rounded-xl border-[#CBD5E1] px-5 py-6 text-[15px]"
                    onClick={onDownloadPdf}
                    disabled={pdfLoading}
                  >
                    {pdfLoading ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Download className="size-5" />
                    )}
                    {pdfLoading ? "กำลังสร้าง PDF…" : "ดาวน์โหลด PDF"}
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-12 rounded-2xl border-[#CBD5E1]"
                    onClick={() =>
                      setZoomScale((current) =>
                        Math.max(
                          PREVIEW_MIN_SCALE,
                          Number(((current ?? fitScale) - 0.1).toFixed(2)),
                        ),
                      )
                    }
                    aria-label="ย่อ"
                  >
                    <ZoomOut className="size-5" />
                  </Button>
                  <div className="min-w-[64px] text-center text-[15px] font-semibold text-[#6B7280]">
                    {zoomPercent}%
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-12 rounded-2xl border-[#CBD5E1]"
                    onClick={() =>
                      setZoomScale((current) =>
                        Math.min(
                          PREVIEW_MAX_SCALE,
                          Number(((current ?? fitScale) + 0.1).toFixed(2)),
                        ),
                      )
                    }
                    aria-label="ขยาย"
                  >
                    <ZoomIn className="size-5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-12 rounded-2xl border-[#CBD5E1]"
                    onClick={() => setZoomScale(null)}
                    aria-label="พอดีหน้าจอ"
                  >
                    <Maximize2 className="size-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Variant Picker ── */}
      <Dialog
        open={variantPickerAction !== null}
        onOpenChange={(o) => {
          if (!o) setVariantPickerAction(null);
        }}
      >
        <DialogContent className="max-w-sm gap-4">
          <DialogHeader>
            <DialogTitle>
              เลือกรูปแบบก่อน
              {variantPickerAction === "print" ? "พิมพ์" : "ดาวน์โหลด PDF"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleVariantSelect("original")}
              className="flex w-full items-center gap-4 rounded-xl border border-border/60 bg-background px-4 py-3 text-left transition hover:border-primary/50 hover:bg-primary/5 focus:outline-none"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#334FA3]">
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
              className="flex w-full items-center gap-4 rounded-xl border border-border/60 bg-background px-4 py-3 text-left transition hover:border-orange-300 hover:bg-orange-50 focus:outline-none"
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

      {/* ── Filename Dialog ── */}
      <Dialog
        open={showFilenameDialog}
        onOpenChange={(o) => {
          if (!o) setShowFilenameDialog(false);
        }}
      >
        <DialogContent className="max-w-sm gap-6">
          <button
            type="button"
            onClick={() => setShowFilenameDialog(false)}
            className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground opacity-70 hover:opacity-100 focus:outline-none"
          >
            <X className="size-4" />
          </button>
          <div className="flex flex-col items-center gap-4 pt-2">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-slate-100">
              <FileDown className="size-8 text-[#334FA3]" />
            </div>
            <DialogTitle className="text-lg">ตั้งชื่อไฟล์ PDF</DialogTitle>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">ชื่อไฟล์</label>
            <div className="flex items-center overflow-hidden rounded-lg border border-[#334FA3] bg-background ring-1 ring-[#334FA3]/40 focus-within:ring-[#334FA3]">
              <Input
                value={pdfFilename}
                onChange={(e) => setPdfFilename(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleDownloadConfirm();
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
              onClick={handleDownloadConfirm}
            >
              <FileDown className="size-4" />
              ดาวน์โหลด
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
