"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  X,
  Plus,
  Upload,
  Stamp,
  PenLine,
  Save,
  ArrowLeft,
  FileCheck2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOC_TYPE_CONFIG, type ExtDocType } from "@/lib/doc-types";
import { useCompanyStore } from "@/stores/company-store";
import type { Step1FormValues } from "@/lib/schemas/document-draft";
import type { Step2FormValues } from "@/lib/schemas/document-step2";
import {
  computeTotals,
  bahtToWords,
  type SummaryBlockKey,
} from "@/lib/schemas/document-step2";
import {
  buildDefaultStep3Values,
  buildDefaultPresets,
  genId,
  getPaymentTermLabel,
  PAYMENT_METHODS,
  PAYMENT_TERM_OPTIONS,
  SIGNATURE_ROLE_LABELS,
  SIGNATURE_ROLE_PREFIX,
  type SignatureRole,
  type SignaturePreset,
  type StampPreset,
  type PaymentTermPreset,
  type TextPreset,
  type Step3FormValues,
  type Step3PresetStore,
} from "@/lib/schemas/document-step3";

// ─── Image processing ─────────────────────────────────────────────────────────

async function resizeImageToDataUrl(
  file: File,
  w: number,
  h: number,
  opacity = 1,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ({ target }) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas error"));
          return;
        }
        ctx.clearRect(0, 0, w, h);
        ctx.globalAlpha = opacity;
        const scale = Math.min(w / img.width, h / img.height);
        const sw = img.width * scale;
        const sh = img.height * scale;
        ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function processImageFromUrlToDataUrl(
  imageUrl: string,
  w: number,
  h: number,
  opacity = 1,
  grayscale = false,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas error"));
        return;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = opacity;
      const scale = Math.min(w / img.width, h / img.height);
      const sw = img.width * scale;
      const sh = img.height * scale;
      ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh);

      if (grayscale) {
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const gray =
            data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
      }

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}

// ─── Format helper ────────────────────────────────────────────────────────────

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

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border/50">
        {Icon && <Icon className="size-4 text-muted-foreground" />}
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      <div className="px-5 py-4 bg-white">{children}</div>
    </div>
  );
}

function PresetChips<T extends { id: string; name: string }>({
  presets,
  onApply,
  onRemove,
}: {
  presets: T[];
  onApply: (p: T) => void;
  onRemove: (id: string) => void;
}) {
  if (presets.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {presets.map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/50 px-2.5 py-1 text-xs"
        >
          <button
            type="button"
            onClick={() => onApply(p)}
            className="hover:text-primary transition-colors"
          >
            {p.name}
          </button>
          <button
            type="button"
            onClick={() => onRemove(p.id)}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Signature Block ───────────────────────────────────────────────────────────

function SignatureBlockCard({
  role,
  docTypeName,
  control,
  watch,
  setValue,
  presets,
  onSavePreset,
  onApplyPreset,
  onRemovePreset,
}: {
  role: SignatureRole;
  docTypeName: string;
  control: ReturnType<typeof useForm<Step3FormValues>>["control"];
  watch: ReturnType<typeof useForm<Step3FormValues>>["watch"];
  setValue: ReturnType<typeof useForm<Step3FormValues>>["setValue"];
  presets: SignaturePreset[];
  onSavePreset: (role: SignatureRole, name: string) => void;
  onApplyPreset: (role: SignatureRole, p: SignaturePreset) => void;
  onRemovePreset: (role: SignatureRole, id: string) => void;
}) {
  const base = `signatures.${role}` as const;
  const enabled = watch(`${base}.enabled`);
  const imgUrl = watch(`${base}.signatureImageUrl`);
  const fileRef = useRef<HTMLInputElement>(null);
  const [presetName, setPresetName] = useState("");
  const defaultTitle = `${SIGNATURE_ROLE_PREFIX[role]}${docTypeName}`;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 p-3.5 space-y-3 transition-opacity bg-white",
        !enabled && "opacity-60",
      )}
    >
      {/* Enable checkbox + role label */}
      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name={`${base}.enabled`}
          render={({ field: f }) => (
            <Checkbox
              id={`sig-${role}`}
              checked={f.value}
              onCheckedChange={(v) => f.onChange(!!v)}
            />
          )}
        />
        <label
          htmlFor={`sig-${role}`}
          className="text-sm font-medium cursor-pointer"
        >
          {SIGNATURE_ROLE_LABELS[role]}
        </label>
      </div>

      {enabled && (
        <div className="space-y-3 pl-1">
          {/* Title */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              หัวข้อ (แสดงในเอกสาร)
            </Label>
            <Controller
              control={control}
              name={`${base}.titleText`}
              render={({ field: f }) => (
                <Input
                  {...f}
                  placeholder={defaultTitle}
                  className="h-8 text-sm"
                />
              )}
            />
            <p className="text-[11px] text-muted-foreground">
              เว้นว่างเพื่อใช้ค่าอัตโนมัติ: {defaultTitle}
            </p>
          </div>

          {/* Signer name */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              ชื่อผู้ลงนาม
            </Label>
            <Controller
              control={control}
              name={`${base}.signerName`}
              render={({ field: f }) => (
                <Input
                  {...f}
                  placeholder="ชื่อ-นามสกุล"
                  className="h-8 text-sm"
                />
              )}
            />
          </div>

          {/* Signature image */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">รูปลายเซ็น</Label>
            <div className="flex items-center gap-3">
              {imgUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgUrl}
                    alt="signature"
                    className="h-12 w-24 object-contain border border-border/50 rounded bg-[#fafafa]"
                  />
                  <button
                    type="button"
                    onClick={() => setValue(`${base}.signatureImageUrl`, "")}
                    className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-white size-4 flex items-center justify-center"
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="h-9 w-28 rounded-md border border-input bg-muted/20 flex items-center justify-center text-[11px] text-muted-foreground">
                    ยังไม่มีลายเซ็น
                  </div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-2 text-xs text-foreground hover:bg-muted/40 transition-colors"
                  >
                    <Upload className="size-3.5" />
                    เลือกรูป
                  </button>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = await resizeImageToDataUrl(file, 120, 60, 1);
                setValue(`${base}.signatureImageUrl`, url);
                e.target.value = "";
              }}
            />
          </div>

          {/* Date */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">วันที่ลงนาม</Label>
            <Controller
              control={control}
              name={`${base}.signatureDate`}
              render={({ field: f }) => (
                <Input {...f} type="date" className="h-8 w-40 text-sm" />
              )}
            />
          </div>

          {/* Save preset */}
          <div className="pt-1">
            <div className="flex gap-2">
              <Input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="ชื่อ preset..."
                className="h-7 text-xs flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs px-2"
                disabled={!presetName.trim()}
                onClick={() => {
                  onSavePreset(role, presetName.trim());
                  setPresetName("");
                }}
              >
                <Save className="size-3" />
                บันทึกลายเซ็น
              </Button>
            </div>
            <PresetChips
              presets={presets}
              onApply={(p) => onApplyPreset(role, p)}
              onRemove={(id) => onRemovePreset(role, id)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Payment methods section ───────────────────────────────────────────────────

function PaymentMethodsSection({
  control,
  watch,
  setValue,
}: {
  control: ReturnType<typeof useForm<Step3FormValues>>["control"];
  watch: ReturnType<typeof useForm<Step3FormValues>>["watch"];
  setValue: ReturnType<typeof useForm<Step3FormValues>>["setValue"];
}) {
  const visible = watch("paymentMethods.visibleMethods") ?? [];
  const checked = watch("paymentMethods.checkedMethods") ?? [];
  const customOtherLabel =
    watch("paymentMethods.customOtherLabel")?.trim() ?? "";
  const hasOther = visible.includes("other");

  function toggleVisible(key: string, on: boolean) {
    const next = on ? [...visible, key] : visible.filter((k) => k !== key);
    setValue("paymentMethods.visibleMethods", next, { shouldDirty: true });
    if (!on) {
      setValue(
        "paymentMethods.checkedMethods",
        checked.filter((k) => k !== key),
        { shouldDirty: true },
      );
    }
  }

  function toggleChecked(key: string, on: boolean) {
    const next = on ? [...checked, key] : checked.filter((k) => k !== key);
    setValue("paymentMethods.checkedMethods", next, { shouldDirty: true });
  }

  return (
    <div className="space-y-4">
      {/* Top: visible */}
      <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">
          วิธีชำระที่แสดงในเอกสาร
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {PAYMENT_METHODS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <Checkbox
                id={`vis-${key}`}
                checked={visible.includes(key)}
                onCheckedChange={(v) => toggleVisible(key, !!v)}
              />
              <label htmlFor={`vis-${key}`} className="text-sm cursor-pointer">
                {label}
              </label>
            </div>
          ))}
        </div>
        {hasOther && (
          <div className="mt-2 pl-6">
            <Controller
              control={control}
              name="paymentMethods.customOtherLabel"
              render={({ field: f }) => (
                <Input
                  {...f}
                  placeholder="ระบุวิธีชำระอื่นๆ..."
                  className="h-8 text-sm"
                />
              )}
            />
          </div>
        )}
      </div>

      {visible.length > 0 && (
        <>
          <Separator />
          {/* Bottom: checked state */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              วิธีที่เลือก (แสดง ✓ ในเอกสาร)
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {PAYMENT_METHODS.filter(({ key }) => visible.includes(key)).map(
                ({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={`chk-${key}`}
                      checked={checked.includes(key)}
                      onCheckedChange={(v) => toggleChecked(key, !!v)}
                    />
                    <label
                      htmlFor={`chk-${key}`}
                      className="text-sm cursor-pointer"
                    >
                      {(() => {
                        const displayLabel =
                          key === "other" && customOtherLabel
                            ? customOtherLabel
                            : label;
                        return checked.includes(key)
                          ? `[✓] ${displayLabel}`
                          : `[ ] ${displayLabel}`;
                      })()}
                    </label>
                  </div>
                ),
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Payment term section ──────────────────────────────────────────────────────

function PaymentTermSection({
  control,
  watch,
  presets,
  onSavePreset,
  onApplyPreset,
  onRemovePreset,
}: {
  control: ReturnType<typeof useForm<Step3FormValues>>["control"];
  watch: ReturnType<typeof useForm<Step3FormValues>>["watch"];
  presets: PaymentTermPreset[];
  onSavePreset: (name: string) => void;
  onApplyPreset: (p: PaymentTermPreset) => void;
  onRemovePreset: (id: string) => void;
}) {
  const enabled = watch("paymentTerm.enabled");
  const termType = watch("paymentTerm.paymentTermType");
  const [presetName, setPresetName] = useState("");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="paymentTerm.enabled"
          render={({ field: f }) => (
            <Checkbox
              id="pt-enabled"
              checked={f.value}
              onCheckedChange={(v) => f.onChange(!!v)}
            />
          )}
        />
        <label
          htmlFor="pt-enabled"
          className="text-sm font-medium cursor-pointer"
        >
          เปิดใช้เงื่อนไขการชำระเงิน
        </label>
      </div>

      {enabled && (
        <div className="space-y-3 pl-1">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">เงื่อนไข</Label>
            <Controller
              control={control}
              name="paymentTerm.paymentTermType"
              render={({ field: f }) => (
                <Select value={f.value} onValueChange={f.onChange}>
                  <SelectTrigger className="w-48">
                    <SelectValue>{getPaymentTermLabel(f.value)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERM_OPTIONS.map((o) => (
                      <SelectItem key={o.key} value={o.key}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {termType === "custom" && (
            <Controller
              control={control}
              name="paymentTerm.customPaymentTermText"
              render={({ field: f }) => (
                <Input
                  {...f}
                  placeholder="ระบุเงื่อนไข..."
                  className="text-sm"
                />
              )}
            />
          )}

          {/* Presets */}
          <div className="flex gap-2">
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="ชื่อ preset..."
              className="h-7 text-xs flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs px-2"
              disabled={!presetName.trim()}
              onClick={() => {
                onSavePreset(presetName.trim());
                setPresetName("");
              }}
            >
              <Plus className="size-3" />
              บันทึกเงื่อนไข
            </Button>
          </div>
          <PresetChips
            presets={presets}
            onApply={onApplyPreset}
            onRemove={onRemovePreset}
          />
        </div>
      )}
    </div>
  );
}

// ─── Text preset section (note / terms) ───────────────────────────────────────

function TextPresetSection({
  fieldPath,
  placeholder,
  saveLabel,
  control,
  watch,
  setValue,
  presets,
  onSavePreset,
  onApplyPreset,
  onRemovePreset,
}: {
  fieldPath: "note.text" | "terms.text";
  placeholder: string;
  saveLabel: string;
  control: ReturnType<typeof useForm<Step3FormValues>>["control"];
  watch: ReturnType<typeof useForm<Step3FormValues>>["watch"];
  setValue: ReturnType<typeof useForm<Step3FormValues>>["setValue"];
  presets: TextPreset[];
  onSavePreset: (name: string) => void;
  onApplyPreset: (p: TextPreset) => void;
  onRemovePreset: (id: string) => void;
}) {
  const [presetName, setPresetName] = useState("");

  return (
    <div className="space-y-3">
      <Controller
        control={control}
        name={fieldPath}
        render={({ field: f }) => (
          <Textarea
            {...f}
            placeholder={placeholder}
            rows={3}
            className="resize-none text-sm"
          />
        )}
      />
      <div className="flex gap-2">
        <Input
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          placeholder="ชื่อ preset..."
          className="h-7 text-xs flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs px-2"
          disabled={!presetName.trim()}
          onClick={() => {
            onSavePreset(presetName.trim());
            setPresetName("");
          }}
        >
          <Plus className="size-3" />
          {saveLabel}
        </Button>
      </div>
      <PresetChips
        presets={presets}
        onApply={(p) => {
          onApplyPreset(p);
          setValue(fieldPath, p.text);
        }}
        onRemove={onRemovePreset}
      />
    </div>
  );
}

// ─── Right summary card (read-only from step 2) ───────────────────────────────

function TotalLine({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between text-sm",
        bold && "font-medium",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", value < 0 && "text-destructive")}>
        {value < 0 ? `-${fmt(Math.abs(value))}` : fmt(value)}
      </span>
    </div>
  );
}

function Step3TotalsCard({ step2Data }: { step2Data: Step2FormValues | null }) {
  if (!step2Data) {
    return (
      <div className="rounded-2xl border border-border/70 bg-white shadow-sm px-5 py-8 text-center text-xs text-muted-foreground">
        ยังไม่มีข้อมูลรายการ
      </div>
    );
  }

  const totals = computeTotals(step2Data);
  const order: SummaryBlockKey[] = step2Data.summaryBlockOrder ?? [
    "document_discount",
    "vat",
    "wht",
    "additional_fee",
  ];
  const { vat, wht, documentDiscount, additionalFee } = step2Data;

  return (
    <div className="rounded-2xl border border-border/70 bg-white shadow-sm">
      <div className="px-5 py-4 border-b border-border/60">
        <h3 className="font-semibold text-sm">สรุปยอด</h3>
      </div>
      <div className="px-5 py-4 space-y-3">
        <TotalLine label="รวมเงิน" value={totals.itemSubtotal} />
        {totals.rowDiscountTotal > 0 && (
          <TotalLine label="ส่วนลดรายการ" value={-totals.rowDiscountTotal} />
        )}
        {order.map((key) => {
          if (
            key === "document_discount" &&
            documentDiscount.enabled &&
            totals.documentDiscountTotal > 0
          ) {
            return (
              <div key={key} className="space-y-2">
                <TotalLine
                  label="ส่วนลดรวม"
                  value={-totals.documentDiscountTotal}
                />
                <TotalLine
                  label="ยอดหลังหักส่วนลด"
                  value={totals.subtotalAfterAllDiscounts}
                  bold
                />
              </div>
            );
          }
          if (key === "vat" && vat.enabled) {
            return vat.includeInItems ? (
              <div key={key} className="space-y-2">
                <TotalLine
                  label="ยอดก่อนภาษี"
                  value={Math.max(
                    0,
                    totals.taxableBaseAfterDiscount - totals.vatIncludedAmount,
                  )}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {vat.vatRate > 0
                      ? `VAT ${vat.vatRate}% (รวมแล้ว)`
                      : "VAT (รวมแล้ว)"}
                  </span>
                  <span className="tabular-nums">
                    {fmt(totals.vatIncludedAmount)}
                  </span>
                </div>
              </div>
            ) : (
              <TotalLine
                key={key}
                label={vat.vatRate > 0 ? `VAT ${vat.vatRate}%` : "VAT"}
                value={totals.vatTotal}
              />
            );
          }
          if (key === "wht" && wht.enabled && totals.whtTotal > 0) {
            return (
              <TotalLine
                key={key}
                label="หัก ณ ที่จ่าย (WHT)"
                value={-totals.whtTotal}
              />
            );
          }
          if (
            key === "additional_fee" &&
            additionalFee.enabled &&
            totals.additionalFeeTotal > 0
          ) {
            return (
              <TotalLine
                key={key}
                label={additionalFee.label || "ค่าใช้จ่ายเพิ่มเติม"}
                value={totals.additionalFeeTotal}
              />
            );
          }
          return null;
        })}
        <Separator />
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">ยอดสุทธิ</span>
          <span className="text-lg font-bold tabular-nums text-primary">
            {fmt(totals.netTotal)}
          </span>
        </div>
        <div className="rounded-lg bg-muted/60 px-3 py-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {bahtToWords(totals.netTotal)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Step 3 Component ────────────────────────────────────────────────────

export function mergeStep3Initial(
  initial: Step3FormValues | null | undefined,
): Step3FormValues {
  const base = buildDefaultStep3Values();
  if (!initial) return base;
  return {
    ...base,
    ...initial,
    signatures: {
      receiver: {
        ...base.signatures.receiver,
        ...initial.signatures?.receiver,
      },
      approver: {
        ...base.signatures.approver,
        ...initial.signatures?.approver,
      },
      issuer: { ...base.signatures.issuer, ...initial.signatures?.issuer },
    },
    stamp: { ...base.stamp, ...initial.stamp },
    paymentMethods: { ...base.paymentMethods, ...initial.paymentMethods },
    paymentTerm: { ...base.paymentTerm, ...initial.paymentTerm },
    note: { ...base.note, ...initial.note },
    terms: { ...base.terms, ...initial.terms },
  };
}

interface Step3Props {
  step1Data: Step1FormValues | null;
  step2Data: Step2FormValues | null;
  onBack: () => void;
  onSave: (values: Step3FormValues) => void;
  onPreview?: (values: Step3FormValues) => void;
  initialValues?: Step3FormValues | null;
  /** จากพรีวิวเมื่อลาก/หมุนตราประทับ — sync เข้าฟอร์ม */
  previewStampLayout?: { x: number; y: number; r: number } | null;
}

export function DocumentCreateStep3({
  step1Data,
  step2Data,
  onBack,
  onSave,
  onPreview,
  initialValues,
  previewStampLayout,
}: Step3Props) {
  const companies = useCompanyStore((s) => s.companies);
  /** โลโก้ของบริษัทที่เลือกในเอกสาร (ไม่ใช่แค่ active company ใน store) */
  const selectedCompanyLogoUrl =
    step1Data?.companySnapshot.logoUrl?.trim() ||
    companies
      .find((c) => c.id === step1Data?.selectedCompanyId)
      ?.logoUrl?.trim() ||
    "";

  const docTypeName = step1Data
    ? (DOC_TYPE_CONFIG[step1Data.documentType as ExtDocType]?.label ?? "เอกสาร")
    : "เอกสาร";

  const { control, watch, setValue, handleSubmit } = useForm<Step3FormValues>({
    defaultValues: mergeStep3Initial(initialValues ?? undefined),
  });

  const [presets, setPresets] = useState<Step3PresetStore>(
    buildDefaultPresets(),
  );
  const stampFileRef = useRef<HTMLInputElement>(null);

  const stampEnabled = watch("stamp.enabled");
  const stampSource = watch("stamp.sourceType");
  const stampImageUrl = watch("stamp.stampImageUrl");
  const step3Values = watch();

  useEffect(() => {
    if (!previewStampLayout) return;
    setValue("stamp.positionX", previewStampLayout.x, { shouldDirty: true });
    setValue("stamp.positionY", previewStampLayout.y, { shouldDirty: true });
    setValue("stamp.rotationDeg", previewStampLayout.r, { shouldDirty: true });
  }, [previewStampLayout, setValue]);

  useEffect(() => {
    async function applyCompanyLogoStamp() {
      if (!stampEnabled || stampSource !== "logo") return;
      if (!selectedCompanyLogoUrl) {
        setValue("stamp.stampImageUrl", "");
        return;
      }
      try {
        const processed = await processImageFromUrlToDataUrl(
          selectedCompanyLogoUrl,
          200,
          200,
          0.5,
          true,
        );
        setValue("stamp.stampImageUrl", processed, { shouldDirty: true });
      } catch {
        setValue("stamp.stampImageUrl", "", { shouldDirty: true });
      }
    }
    void applyCompanyLogoStamp();
  }, [stampEnabled, stampSource, selectedCompanyLogoUrl, setValue]);

  // ── Signature preset helpers ──
  function saveSignaturePreset(role: SignatureRole, name: string) {
    const v = watch(`signatures.${role}`);
    const preset: SignaturePreset = {
      id: genId(),
      name,
      titleText: v.titleText,
      signerName: v.signerName,
      signatureImageUrl: v.signatureImageUrl,
    };
    setPresets((p) => ({
      ...p,
      signatures: { ...p.signatures, [role]: [...p.signatures[role], preset] },
    }));
  }

  function applySignaturePreset(role: SignatureRole, p: SignaturePreset) {
    setValue(`signatures.${role}.titleText`, p.titleText);
    setValue(`signatures.${role}.signerName`, p.signerName);
    setValue(`signatures.${role}.signatureImageUrl`, p.signatureImageUrl);
  }

  function removeSignaturePreset(role: SignatureRole, id: string) {
    setPresets((p) => ({
      ...p,
      signatures: {
        ...p.signatures,
        [role]: p.signatures[role].filter((x) => x.id !== id),
      },
    }));
  }

  // ── Stamp preset helpers ──
  function saveStampPreset(name: string) {
    const preset: StampPreset = {
      id: genId(),
      name,
      sourceType: watch("stamp.sourceType"),
      stampImageUrl: watch("stamp.stampImageUrl"),
    };
    setPresets((p) => ({ ...p, stamp: [...p.stamp, preset] }));
  }

  function applyStampPreset(p: StampPreset) {
    setValue("stamp.sourceType", p.sourceType);
    setValue("stamp.stampImageUrl", p.stampImageUrl);
  }

  // ── Payment term preset helpers ──
  function savePaymentTermPreset(name: string) {
    const preset: PaymentTermPreset = {
      id: genId(),
      name,
      paymentTermType: watch("paymentTerm.paymentTermType"),
      customPaymentTermText: watch("paymentTerm.customPaymentTermText"),
    };
    setPresets((p) => ({ ...p, paymentTerm: [...p.paymentTerm, preset] }));
  }

  function applyPaymentTermPreset(p: PaymentTermPreset) {
    setValue("paymentTerm.paymentTermType", p.paymentTermType);
    setValue("paymentTerm.customPaymentTermText", p.customPaymentTermText);
  }

  // ── Text preset helpers ──
  function saveTextPreset(field: "note" | "terms", name: string) {
    const text = watch(`${field}.text`);
    const preset: TextPreset = { id: genId(), name, text };
    setPresets((p) => ({ ...p, [field]: [...p[field], preset] }));
  }

  const ROLES: SignatureRole[] = ["receiver", "approver", "issuer"];
  const [stampPresetName, setStampPresetName] = useState("");

  return (
    <form
      onSubmit={handleSubmit(onSave)}
      className="flex flex-col min-h-0 bg-muted/20"
    >
      <div className="flex-1 px-6 py-6">
        <div className="flex gap-6 items-start">
          {/* ── LEFT ── */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Section 1: Signature blocks */}
            <SectionCard title="ลงนามและตราประทับ" icon={PenLine}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {ROLES.map((role) => (
                  <SignatureBlockCard
                    key={role}
                    role={role}
                    docTypeName={docTypeName}
                    control={control}
                    watch={watch}
                    setValue={setValue}
                    presets={presets.signatures[role]}
                    onSavePreset={saveSignaturePreset}
                    onApplyPreset={applySignaturePreset}
                    onRemovePreset={removeSignaturePreset}
                  />
                ))}
              </div>
            </SectionCard>

            {/* Section 2: Stamp */}
            <SectionCard title="ตราประทับ" icon={Stamp}>
              <div className="space-y-4">
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center gap-2">
                    <Controller
                      control={control}
                      name="stamp.enabled"
                      render={({ field: f }) => (
                        <Checkbox
                          id="stamp-enabled"
                          checked={f.value}
                          onCheckedChange={(v) => f.onChange(!!v)}
                        />
                      )}
                    />
                    <label
                      htmlFor="stamp-enabled"
                      className="text-sm font-medium cursor-pointer"
                    >
                      ตราประทับ (Stamp)
                    </label>
                  </div>
                </div>

                {stampEnabled && (
                  <div className="space-y-3 pl-1">
                    {/* Source type */}
                    <div className="flex gap-4">
                      {(["logo", "upload"] as const).map((src) => (
                        <button
                          key={src}
                          type="button"
                          onClick={() =>
                            setValue("stamp.sourceType", src, {
                              shouldDirty: true,
                              shouldTouch: true,
                            })
                          }
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                            stampSource === src
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:bg-muted/50",
                          )}
                        >
                          {src === "logo"
                            ? "ใช้ Logo บริษัท"
                            : "อัพโหลดรูปใหม่"}
                        </button>
                      ))}
                    </div>

                    {/* กรอบพรีวิวสี่เหลี่ยมจัตุรัส — ใช้ร่วมทั้งโหมด logo / upload */}
                    <div className="relative flex size-[200px] shrink-0 flex-col overflow-hidden rounded-xl border bg-[#fafafa]">
                      <input
                        ref={stampFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const url = await resizeImageToDataUrl(
                            file,
                            200,
                            200,
                            0.5,
                          );
                          setValue("stamp.stampImageUrl", url, {
                            shouldDirty: true,
                          });
                          e.target.value = "";
                        }}
                      />
                      {stampSource === "logo" ? (
                        stampImageUrl || selectedCompanyLogoUrl ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={stampImageUrl || selectedCompanyLogoUrl}
                              alt="ตราประทับจากโลโก้บริษัท"
                              className="size-full object-contain p-4 opacity-60"
                            />
                            <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[10px] text-muted-foreground">
                              ใช้ Logo บริษัท
                            </p>
                          </>
                        ) : (
                          <div className="flex size-full flex-col items-center justify-center gap-2 border border-dashed border-border/60 p-4 text-center">
                            <p className="text-xs text-muted-foreground">
                              ไม่พบโลโก้บริษัท
                            </p>
                            <p className="text-[11px] text-muted-foreground/80">
                              เพิ่มโลโก้ใน step บริษัท หรือเลือกอัพโหลดรูป
                            </p>
                          </div>
                        )
                      ) : stampImageUrl ? (
                        <div className="relative size-full">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={stampImageUrl}
                            alt="stamp"
                            className="size-full object-contain p-4 opacity-60"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setValue("stamp.stampImageUrl", "", {
                                shouldDirty: true,
                              })
                            }
                            className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-destructive text-white shadow-sm"
                            aria-label="ลบรูป"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => stampFileRef.current?.click()}
                          className="flex size-full flex-col items-center justify-center gap-2 border border-dashed border-border/60 p-4 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                        >
                          <Upload className="size-8 opacity-70" />
                          <span className="text-center leading-snug">
                            อัพโหลดรูปตราประทับ
                            <br />
                            <span className="text-[10px]">(200×200 px)</span>
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Stamp presets */}
                    <div className="flex gap-2">
                      <Input
                        value={stampPresetName}
                        onChange={(e) => setStampPresetName(e.target.value)}
                        placeholder="ชื่อ preset..."
                        className="h-7 text-xs flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs px-2"
                        disabled={!stampPresetName.trim()}
                        onClick={() => {
                          saveStampPreset(stampPresetName.trim());
                          setStampPresetName("");
                        }}
                      >
                        <Plus className="size-3" />
                        บันทึกตราประทับ
                      </Button>
                    </div>
                    <PresetChips
                      presets={presets.stamp}
                      onApply={applyStampPreset}
                      onRemove={(id) =>
                        setPresets((p) => ({
                          ...p,
                          stamp: p.stamp.filter((x) => x.id !== id),
                        }))
                      }
                    />
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Section 3: Payment methods */}
            <SectionCard title="ชำระโดย">
              <PaymentMethodsSection
                control={control}
                watch={watch}
                setValue={setValue}
              />
            </SectionCard>

            {/* Section 4: Payment term */}
            <SectionCard title="เงื่อนไขการชำระเงิน">
              <PaymentTermSection
                control={control}
                watch={watch}
                presets={presets.paymentTerm}
                onSavePreset={(name) => savePaymentTermPreset(name)}
                onApplyPreset={applyPaymentTermPreset}
                onRemovePreset={(id) =>
                  setPresets((p) => ({
                    ...p,
                    paymentTerm: p.paymentTerm.filter((x) => x.id !== id),
                  }))
                }
              />
            </SectionCard>

            {/* Section 5: Note */}
            <SectionCard title="หมายเหตุและข้อกำหนดเงื่อนไข">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="mb-2 block text-sm font-medium">
                    หมายเหตุ
                  </Label>
                  <TextPresetSection
                    fieldPath="note.text"
                    placeholder="ระบุหมายเหตุ..."
                    saveLabel="บันทึกหมายเหตุ"
                    control={control}
                    watch={watch}
                    setValue={setValue}
                    presets={presets.note}
                    onSavePreset={(name) => saveTextPreset("note", name)}
                    onApplyPreset={(p) => setValue("note.text", p.text)}
                    onRemovePreset={(id) =>
                      setPresets((p) => ({
                        ...p,
                        note: p.note.filter((x) => x.id !== id),
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="mb-2 block text-sm font-medium">
                    ข้อกำหนดและเงื่อนไข
                  </Label>
                  <TextPresetSection
                    fieldPath="terms.text"
                    placeholder="ระบุข้อกำหนดและเงื่อนไข..."
                    saveLabel="บันทึกเงื่อนไข"
                    control={control}
                    watch={watch}
                    setValue={setValue}
                    presets={presets.terms}
                    onSavePreset={(name) => saveTextPreset("terms", name)}
                    onApplyPreset={(p) => setValue("terms.text", p.text)}
                    onRemovePreset={(id) =>
                      setPresets((p) => ({
                        ...p,
                        terms: p.terms.filter((x) => x.id !== id),
                      }))
                    }
                  />
                </div>
              </div>
            </SectionCard>
          </div>

          {/* ── RIGHT: sticky totals from Step 2 ── */}
          <div className="w-72 shrink-0 sticky top-24">
            <Step3TotalsCard step2Data={step2Data} />
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 border-t border-border/60 bg-white/95 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            ย้อนกลับ
          </Button>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="text-muted-foreground"
              onClick={() => onPreview?.(watch())}
            >
              พรีวิว
            </Button>
            <Button type="submit" className="gap-2">
              <FileCheck2 className="size-4" />
              บันทึกเอกสาร
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
