"use client";

import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COMPANY_NAME_FONT_SIZE,
  DOC_TYPE_CONFIG,
  type ExtDocType,
} from "@/lib/doc-types";
import type { Step1FormValues } from "@/lib/schemas/document-draft";
import type { Step2FormValues } from "@/lib/schemas/document-step2";
import {
  bahtToWords,
  buildDefaultStep2Values,
  computeTotals,
} from "@/lib/schemas/document-step2";
import {
  buildDefaultStep3Values,
  DEFAULT_STAMP_ROTATION_DEG,
  getPaymentTermLabel,
  PAYMENT_METHODS,
  SIGNATURE_ROLE_PREFIX,
  type SignatureRole,
  type Step3FormValues,
} from "@/lib/schemas/document-step3";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
export const A4_WIDTH_PX = (A4_WIDTH_MM / 25.4) * 96;
export const A4_HEIGHT_PX = (A4_HEIGHT_MM / 25.4) * 96;
/** ตรงกับพรีวิว / PDF — 50×50 mm */
const STAMP_BOX_MM = 50;
const STAMP_BOX_PX = (STAMP_BOX_MM / 25.4) * 96;

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

function formatNameWithOffice(
  name: string,
  office: {
    officeType: "none" | "hq" | "branch";
    branchName?: string | null;
  },
) {
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
      <div className="flex h-14 items-center justify-center">
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

export interface DocumentPreviewRendererProps {
  step1Data: Step1FormValues | null;
  step2Data: Step2FormValues | null;
  step3Data?: Step3FormValues | null;
  docVariant?: "original" | "copy";
  className?: string;
  pageClassName?: string;
}

export function DocumentPreviewRenderer({
  step1Data,
  step2Data,
  step3Data,
  docVariant = "copy",
  className,
  pageClassName,
}: DocumentPreviewRendererProps) {
  if (!step1Data) return null;

  const previewStep2 = step2Data ?? buildDefaultStep2Values();
  const step3 = step3Data ?? buildDefaultStep3Values();
  const totals = computeTotals(previewStep2);

  const docType = step1Data.documentType as ExtDocType;
  const docLabel = DOC_TYPE_CONFIG[docType]?.label ?? "เอกสาร";
  const docLabelEn = DOC_TYPE_CONFIG[docType]?.labelEn ?? "";
  const partnerRole = DOC_TYPE_CONFIG[docType]?.partnerRole ?? "customer";
  const company = step1Data.companySnapshot;
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
  const companyEnglishName = getCompanyEnglishName(company);
  const companyNameFontPx = COMPANY_NAME_FONT_SIZE[step1Data.companyNameSize];
  const enabledSignatures = (
    Object.keys(step3.signatures) as SignatureRole[]
  ).filter((role) => step3.signatures[role].enabled);
  const paymentVisible = step3.paymentMethods.visibleMethods ?? [];
  const paymentChecked = step3.paymentMethods.checkedMethods ?? [];
  const stampDisplayUrl = !step3.stamp.enabled
    ? ""
    : step3.stamp.sourceType === "logo"
      ? step3.stamp.stampImageUrl?.trim() || company.logoUrl?.trim()
      : (step3.stamp.stampImageUrl?.trim() ?? "");

  function stampNum(v: unknown): number | undefined {
    return typeof v === "number" && !Number.isNaN(v) ? v : undefined;
  }
  /** ไม่มีในข้อมูลเก่า: ใช้ตำแหน่งเดิมของหน้า detail (ขวา 52px / บน 220px) */
  const stampPosX =
    stampNum(step3.stamp.positionX) ??
    A4_WIDTH_PX - 52 - STAMP_BOX_PX;
  const stampPosY = stampNum(step3.stamp.positionY) ?? 220;
  const stampRot =
    stampNum(step3.stamp.rotationDeg) ?? DEFAULT_STAMP_ROTATION_DEG;

  return (
    <div className={cn("overflow-auto rounded-[28px] bg-[#D8DDE6] p-6", className)}>
      <div
        className={cn(
          "mx-auto overflow-hidden border border-[#D6DBE7] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.10)]",
          pageClassName,
        )}
        style={{ width: A4_WIDTH_PX, minHeight: A4_HEIGHT_PX }}
      >
        <div className="relative flex-1 px-[52px] pb-[58px] pt-[56px] text-[#111827]">
          <div className="mb-4 flex justify-end">
            {docVariant === "original" ? (
              <div
                data-pdf-text-box="inline"
                className="inline-flex items-center gap-1 rounded-md border border-[#C9D4EE] bg-[#EEF2FF] px-4 py-2 text-[13px] font-semibold text-[#334FA3]"
              >
                <span>ต้นฉบับ</span>
              </div>
            ) : (
              <div
                data-pdf-text-box="inline"
                className="inline-flex rounded-md bg-[#F1F3F6] px-4 py-2 text-[13px] font-medium text-[#7B8190]"
              >
                <span>สำเนา</span>
              </div>
            )}
          </div>

          <div className="flex justify-between gap-8">
            <div className="flex min-w-0 flex-1 gap-6">
              <div className="flex size-[88px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#F8FAFD]">
                {company.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={company.logoUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-1 bg-[#EEF2FF] text-[#334FA3]">
                    <Building2 className="size-8 shrink-0 opacity-80" />
                    <span className="text-[11px] font-semibold leading-none">บ.</span>
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
                  <div className="mt-2 text-[11px] text-[#6B7280]">{company.address}</div>
                ) : null}
                {company.phone || company.email ? (
                  <div className="text-[11px] text-[#6B7280]">
                    {[company.phone && `โทรศัพท์: ${company.phone}`, company.email]
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
                  {partnerRole === "vendor" ? "ยังไม่ได้เลือกผู้ขาย" : "ยังไม่ได้เลือกลูกค้า"}
                </div>
              )}
              {partner.address ? (
                <div className="text-[11px] text-[#6B7280]">{partner.address}</div>
              ) : null}
              {partner.phone || partner.email ? (
                <div className="text-[11px] text-[#6B7280]">
                  {[partner.phone, partner.email].filter(Boolean).join(" | ")}
                </div>
              ) : null}
              {partner.taxId ? (
                <div className="text-[11px] text-[#6B7280]">
                  เลขประจำตัวผู้เสียภาษี: {partner.taxId}
                </div>
              ) : null}
            </div>

            <table className="border-collapse text-[11px]">
              <tbody>
                <tr>
                  <td className="pr-2 align-top font-semibold text-[#2E4CB7]">เลขที่เอกสาร</td>
                  <td className="min-w-[120px] pl-2 align-top font-semibold text-[#111827]">
                    {step1Data.documentNumber || "________________"}
                  </td>
                </tr>
                <tr>
                  <td className="pr-2 align-top font-semibold text-[#2E4CB7]">วันที่</td>
                  <td className="min-w-[120px] pl-2 align-top font-semibold text-[#111827]">
                    {formatThaiDate(step1Data.documentDate) || "___ / ___ / ______"}
                  </td>
                </tr>
                {step1Data.extraDateValue ? (
                  <tr>
                    <td className="pr-2 align-top font-semibold text-[#2E4CB7]">
                      {DOC_TYPE_CONFIG[docType]?.extraDateLabel}
                    </td>
                    <td className="min-w-[120px] pl-2 align-top font-semibold text-[#111827]">
                      {formatThaiDate(step1Data.extraDateValue)}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div
            data-pdf-text-box="left"
            className="mt-8 border border-b-0 border-[#DEE3F3] bg-[#E9EDFB] px-4 py-2 text-[12px] font-semibold text-[#334FA3]"
          >
            <span>รายการสินค้า / บริการ</span>
          </div>
          <table className="w-full table-fixed border border-[#DEE3F3] text-[11px]">
            <thead className="bg-[#F8FAFD] text-[#4A5568]">
              <tr>
                {cols.index ? <th data-pdf-text-box="table-cell" className="w-8 border border-[#DEE3F3] p-2 text-center"><span>#</span></th> : null}
                {cols.code ? <th data-pdf-text-box="table-cell" className="w-[4.5rem] border border-[#DEE3F3] p-2 text-center"><span>รหัส</span></th> : null}
                {cols.itemName ? <th data-pdf-text-box="table-cell" className="border border-[#DEE3F3] p-2 text-left"><span>รายการ</span></th> : null}
                {cols.description ? <th data-pdf-text-box="table-cell" className="border border-[#DEE3F3] p-2 text-left"><span>รายละเอียด</span></th> : null}
                {cols.quantity ? <th data-pdf-text-box="table-cell" className="w-[3.25rem] border border-[#DEE3F3] p-2 text-center"><span>จำนวน</span></th> : null}
                {cols.unit ? <th data-pdf-text-box="table-cell" className="w-12 border border-[#DEE3F3] p-2 text-center"><span>หน่วย</span></th> : null}
                {cols.unitPrice ? <th data-pdf-text-box="table-cell" className="w-[4.5rem] border border-[#DEE3F3] p-2 text-right"><span>ราคา/หน่วย</span></th> : null}
                {cols.discount ? <th data-pdf-text-box="table-cell" className="w-[4rem] border border-[#DEE3F3] p-2 text-right"><span>ส่วนลด</span></th> : null}
                {cols.vat ? <th data-pdf-text-box="table-cell" className="w-[3.5rem] border border-[#DEE3F3] p-2 text-center"><span>ภาษี</span></th> : null}
                <th data-pdf-text-box="table-cell" className="w-[4.5rem] border border-[#DEE3F3] p-2 text-right"><span>รวม</span></th>
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
                      {cols.index ? <td className="border border-[#DEE3F3] p-2 text-center">{idx + 1}</td> : null}
                      {cols.code ? <td className="border border-[#DEE3F3] p-2 text-center">{it.selectedItemCode || "-"}</td> : null}
                      {cols.itemName ? <td className="border border-[#DEE3F3] p-2">{it.title || "-"}</td> : null}
                      {cols.description ? <td className="border border-[#DEE3F3] p-2">{it.description || "-"}</td> : null}
                      {cols.quantity ? <td className="border border-[#DEE3F3] p-2 text-center">{it.quantity}</td> : null}
                      {cols.unit ? <td className="border border-[#DEE3F3] p-2 text-center">{it.unit || "-"}</td> : null}
                      {cols.unitPrice ? <td className="border border-[#DEE3F3] p-2 text-right">{fmt(it.unitPrice)}</td> : null}
                      {cols.discount ? (
                        <td className="border border-[#DEE3F3] p-2 text-right">
                          {it.discountValue > 0
                            ? it.discountType === "percent"
                              ? `${it.discountValue}%`
                              : fmt(it.discountValue)
                            : "-"}
                        </td>
                      ) : null}
                      {cols.vat ? (
                        <td className="border border-[#DEE3F3] p-2 text-center">
                          {it.vatRate === -1 ? "ยกเว้น" : it.vatRate === 0 ? "-" : `${it.vatRate}%`}
                        </td>
                      ) : null}
                      <td className="border border-[#DEE3F3] p-2 text-right">{fmt(lineTotal)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="h-20 border border-[#DEE3F3] p-4 text-center text-[#A0A7B5]" colSpan={visibleColCount}>
                    ไม่มีรายการ
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-7 flex justify-between gap-8">
            <div className="min-w-0 flex-1 text-[14px] leading-6">
              {step3.terms.text.trim() ? (
                <>
                  <div className="mb-1 font-semibold">ข้อกำหนดและเงื่อนไข</div>
                  <div className="whitespace-pre-wrap text-[#4B5563]">{step3.terms.text}</div>
                </>
              ) : null}
            </div>
            <div className="w-[280px] text-[12px] text-[#4A5568]">
              <div className="flex justify-between py-1.5">
                <span>รวมเงิน</span>
                <span className="text-[#111827]">{fmt(totals.itemSubtotal)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span>ภาษีมูลค่าเพิ่ม ({previewVatRate}%)</span>
                <span className="text-[#111827]">{fmt(totals.vatIncludedAmount || totals.vatTotal)}</span>
              </div>
              <div
                data-pdf-text-box="row"
                className="mt-2 flex justify-between border border-[#DEE3F3] bg-[#E9EDFB] px-2 py-3 font-semibold text-[#334FA3]"
              >
                <span>ยอดสุทธิ</span>
                <span className="text-[14px] leading-none">{fmt(totals.netTotal)}</span>
              </div>
            </div>
          </div>

          <div
            data-pdf-text-box="block"
            className="mt-4 rounded-md border-2 border-[#4D67B0] bg-[#EEF2FF] px-4 py-3 text-center text-[14px] font-medium text-[#334FA3]"
          >
            <span>( {amountInWords} )</span>
          </div>

          {paymentVisible.length > 0 || step3.paymentTerm.enabled ? (
            <div className="mt-4 text-[14px] leading-6">
              {paymentVisible.length > 0 ? (
                <>
                  <strong>ชำระโดย:</strong>{" "}
                  {paymentVisible
                    .map((k) => {
                      const base = PAYMENT_METHODS.find((x) => x.key === k)?.label ?? k;
                      return `${paymentChecked.includes(k) ? "[✓]" : "[ ]"} ${base}`;
                    })
                    .join(" ")}
                </>
              ) : null}
              {step3.paymentTerm.enabled ? (
                <>
                  {paymentVisible.length > 0 ? <span className="mx-2">|</span> : null}
                  <strong>เงื่อนไขการชำระเงิน:</strong>{" "}
                  {step3.paymentTerm.paymentTermType === "custom"
                    ? step3.paymentTerm.customPaymentTermText
                    : getPaymentTermLabel(step3.paymentTerm.paymentTermType)}
                </>
              ) : null}
            </div>
          ) : null}

          <div className="pt-14">
            {enabledSignatures.length > 0 ? (
              <div className={cn("flex w-full gap-5", enabledSignatures.length === 1 ? "justify-start" : "justify-between")}>
                {enabledSignatures.map((role) => {
                  const s = step3.signatures[role];
                  return (
                    <SignaturePreview
                      key={role}
                      title={s.titleText.trim() || `${SIGNATURE_ROLE_PREFIX[role]}${docLabel}`}
                      signerName={s.signerName}
                      signatureImageUrl={s.signatureImageUrl}
                      signatureDate={s.signatureDate}
                    />
                  );
                })}
              </div>
            ) : null}
          </div>

          {step3.note.text.trim() ? (
            <div className="mt-8 border-t border-[#E5E7EB] pt-4 text-[14px] leading-6">
              <div className="mb-1 font-semibold text-[#111827]">หมายเหตุ:</div>
              <div className="whitespace-pre-wrap text-[#4B5563]">{step3.note.text}</div>
            </div>
          ) : null}

          {step3.stamp.enabled && stampDisplayUrl ? (
            <div
              className="pointer-events-none absolute h-[50mm] w-[50mm]"
              style={{
                left: stampPosX,
                top: stampPosY,
                transform: `rotate(${stampRot}deg)`,
                transformOrigin: "center center",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                data-document-stamp=""
                src={stampDisplayUrl}
                alt="stamp"
                className="h-full w-full object-contain opacity-50 grayscale"
                draggable={false}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
