"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, FileText, Hash, Calendar } from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { useCompanyStore } from "@/stores/company-store";
import {
  loadDocumentSettings,
  saveDocumentSettings,
} from "@/lib/firebase/settings-mutations";
import {
  documentSettingsSchema,
  previewDocumentNumber,
  DEFAULT_DOCUMENT_SETTINGS,
  type DocumentSettingsFormValues,
} from "@/lib/schemas/settings";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DATE_FORMAT_OPTIONS: {
  value: DocumentSettingsFormValues["documentNumberDateFormat"];
  label: string;
  example: string;
}[] = [
  { value: "TH_YYMM", label: "ปี พ.ศ. 2 หลัก + เดือน", example: "6903" },
  { value: "TH_YY", label: "ปี พ.ศ. 2 หลัก", example: "69" },
  { value: "TH_YYYY", label: "ปี พ.ศ. 4 หลัก", example: "2569" },
  { value: "AD_YYMM", label: "ปี ค.ศ. 2 หลัก + เดือน", example: "2603" },
  { value: "AD_YYYY", label: "ปี ค.ศ. 4 หลัก", example: "2026" },
];

const DISPLAY_DATE_OPTIONS: {
  value: DocumentSettingsFormValues["documentDisplayDateFormat"];
  label: string;
  sublabel: string;
  example: string;
}[] = [
  {
    value: "TH_SHORT_BE",
    label: "ไทย ย่อ (พ.ศ.)",
    sublabel: "พ.ศ. แบบย่อ",
    example: "26 มี.ค. 2569",
  },
  {
    value: "TH_LONG_BE",
    label: "ไทย เต็ม (พ.ศ.)",
    sublabel: "พ.ศ. แบบเต็ม",
    example: "26 มีนาคม 2569",
  },
  {
    value: "TH_NUMERIC_BE",
    label: "ไทย ตัวเลข (พ.ศ.)",
    sublabel: "ตัวเลข พ.ศ.",
    example: "26/03/2569",
  },
  {
    value: "EN_SHORT_AD",
    label: "English Short (AD)",
    sublabel: "ค.ศ. แบบย่อ",
    example: "26 Mar 2026",
  },
  {
    value: "EN_LONG_AD",
    label: "English Long (AD)",
    sublabel: "ค.ศ. แบบเต็ม",
    example: "26 March 2026",
  },
  {
    value: "EN_NUMERIC_AD",
    label: "English Numeric (AD)",
    sublabel: "ตัวเลข ค.ศ.",
    example: "26/03/2026",
  },
  {
    value: "ISO_8601",
    label: "ISO 8601",
    sublabel: "มาตรฐานสากล",
    example: "2026-03-26",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Section Card wrapper
// ─────────────────────────────────────────────────────────────────────────────

function SettingsCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-surface">
      <div className="border-b border-border/60 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-secondary/60 text-muted-foreground">
            <Icon className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
      <div className="px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Date format card selector
// ─────────────────────────────────────────────────────────────────────────────

function DateFormatCard({
  value,
  label,
  sublabel,
  example,
  selected,
  onClick,
}: {
  value: string;
  label: string;
  sublabel: string;
  example: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left transition-all",
        selected
          ? "border-primary/60 bg-primary/5 ring-1 ring-primary/40"
          : "border-border/60 bg-surface hover:border-border hover:bg-surface-secondary/30",
      )}
    >
      <div>
        <p
          className={cn(
            "text-sm font-medium",
            selected ? "text-primary" : "text-foreground",
          )}
        >
          {label}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm tabular-nums text-muted-foreground">
          {example}
        </span>
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            selected
              ? "border-primary bg-primary text-white"
              : "border-border/60 bg-surface",
          )}
        >
          {selected && <Check className="size-3" strokeWidth={3} />}
        </span>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const activeCompany = useCompanyStore((s) =>
    s.companies.find((c) => c.id === s.activeCompanyId),
  );

  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<DocumentSettingsFormValues>({
    resolver: zodResolver(documentSettingsSchema),
    defaultValues: { ...DEFAULT_DOCUMENT_SETTINGS },
  });

  // โหลด settings เมื่อ companyId เปลี่ยน
  useEffect(() => {
    if (!companyId) {
      reset({ ...DEFAULT_DOCUMENT_SETTINGS });
      setLoadingSettings(false);
      return;
    }
    setLoadingSettings(true);
    void loadDocumentSettings(companyId).then((s) => {
      reset(s);
      setLoadingSettings(false);
    });
  }, [companyId, reset]);

  // live preview
  const dateFormat = watch("documentNumberDateFormat");
  const digits = watch("documentRunningDigits");
  const separator = watch("documentNumberSeparator");

  const preview = useMemo(
    () => previewDocumentNumber(dateFormat, digits, separator),
    [dateFormat, digits, separator],
  );

  const onSubmit = async (values: DocumentSettingsFormValues) => {
    if (!companyId) return;
    setSaving(true);
    try {
      await saveDocumentSettings(companyId, values);
      toast.success("บันทึกการตั้งค่าแล้ว");
      reset(values); // reset dirty state
    } catch (e) {
      console.error(e);
      toast.error("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  if (loadingSettings) {
    return (
      <div className="min-h-[calc(100dvh-4rem)]">
        <AppHeader title="ตั้งค่า" subtitle="ฟอนต์ ธีม และค่าเริ่มต้น" />
        <div className="space-y-5 px-4 py-6 sm:px-6 sm:py-8">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)]">
      <AppHeader
        title="ตั้งค่า"
        subtitle={
          activeCompany
            ? `${activeCompany.name} · ตั้งค่าเอกสาร`
            : "ตั้งค่าเอกสาร"
        }
        actions={
          <Button
            type="submit"
            form="settings-form"
            className="rounded-xl"
            disabled={saving || !isDirty || !companyId}
          >
            {saving ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
          </Button>
        }
      />

      <form
        id="settings-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5 px-4 py-6 sm:px-6 sm:py-8"
      >
        {/* ─────────────── CARD 1: ค่าเริ่มต้นเอกสาร ─────────────── */}
        <SettingsCard icon={FileText} title="ค่าเริ่มต้นเอกสาร">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">อัตรา VAT (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  className="rounded-xl pr-8"
                  {...register("defaultVatRate", { valueAsNumber: true })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </div>
              {errors.defaultVatRate && (
                <p className="text-xs text-destructive">
                  {errors.defaultVatRate.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                ค่าเริ่มต้นเมื่อสร้างเอกสารใหม่
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">หัก ณ ที่จ่าย (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  className="rounded-xl pr-8"
                  {...register("defaultWithholdingTaxRate", {
                    valueAsNumber: true,
                  })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </div>
              {errors.defaultWithholdingTaxRate && (
                <p className="text-xs text-destructive">
                  {errors.defaultWithholdingTaxRate.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                ค่าเริ่มต้นเมื่อสร้างเอกสารใหม่
              </p>
            </div>
          </div>
        </SettingsCard>

        {/* ─────────────── CARD 2: เลขที่เอกสาร ─────────────── */}
        <SettingsCard
          icon={Hash}
          title="เลขที่เอกสาร"
          subtitle="รูปแบบช่วงวันที่ในเลขที่ จำนวนหลัก ตัวคั่น และการเติมเลขเมื่อออกเอกสาร"
        >
          <div className="space-y-6">
            {/* รูปแบบวันที่ */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                รูปแบบวันที่ในเลขที่
              </Label>
              <Controller
                control={control}
                name="documentNumberDateFormat"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue>
                        {DATE_FORMAT_OPTIONS.find(
                          (o) => o.value === field.value,
                        )?.label ?? "เลือกรูปแบบ"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="w-[230px]">
                      {DATE_FORMAT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          <span>{o.label}</span>
                          <span className="ml-1 font-mono text-xs text-muted-foreground">
                            ({o.example})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* จำนวนหลัก + ตัวคั่น */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">จำนวนหลักลำดับ</Label>
                <Input
                  type="number"
                  min={1}
                  max={8}
                  className="rounded-xl"
                  {...register("documentRunningDigits", {
                    valueAsNumber: true,
                  })}
                />
                {errors.documentRunningDigits && (
                  <p className="text-xs text-destructive">
                    {errors.documentRunningDigits.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  เช่น 4 หลัก → 0001
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">ตัวคั่น</Label>
                <Input
                  className="rounded-xl font-mono"
                  placeholder="-"
                  maxLength={5}
                  {...register("documentNumberSeparator")}
                />
                {errors.documentNumberSeparator && (
                  <p className="text-xs text-destructive">
                    {errors.documentNumberSeparator.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  เช่น - หรือ / หรือ เว้นว่าง
                </p>
              </div>
            </div>

            {/* เมื่อมีเลขที่ถูกลบ */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">เมื่อมีเลขที่ถูกลบ</Label>
              <Controller
                control={control}
                name="deletedNumberBehavior"
                render={({ field }) => (
                  <div className="space-y-2.5">
                    {(
                      [
                        {
                          value: "fill_gap",
                          label: "เติมเลขที่ว่าง",
                          desc: "ใช้เลขที่ว่างจากช่วงที่หายไปก่อน (แนะนำสำหรับร่าง/เทสต์)",
                        },
                        {
                          value: "continue_max",
                          label: "ไม่เติม",
                          desc: "เลขถัดไปจะต่อจากเลขสูงสุดที่เคยใช้แล้ว (รวมที่ลบแล้ว)",
                        },
                      ] as const
                    ).map((opt) => (
                      <label
                        key={opt.value}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 transition-colors",
                          field.value === opt.value
                            ? "border-primary/60 bg-primary/5"
                            : "border-border/60 hover:bg-surface-secondary/30",
                        )}
                      >
                        <input
                          type="radio"
                          className="mt-0.5 accent-primary"
                          value={opt.value}
                          checked={field.value === opt.value}
                          onChange={() => field.onChange(opt.value)}
                        />
                        <div>
                          <p className="text-sm font-medium">{opt.label}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {opt.desc}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* Live preview */}
            <div className="rounded-xl border border-border/60 bg-surface-secondary/30 px-5 py-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                ตัวอย่างเลขที่เอกสาร
              </p>
              <p className="font-mono text-2xl font-semibold tracking-wider text-foreground">
                {preview}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                อ้างอิงจากวันที่ปัจจุบัน · ลำดับเริ่มต้นที่ 0001
              </p>
            </div>
          </div>
        </SettingsCard>

        {/* ─────────────── CARD 3: รูปแบบวันที่บนเอกสาร ─────────────── */}
        <SettingsCard
          icon={Calendar}
          title="รูปแบบวันที่"
          subtitle="วันที่ที่แสดงบนเอกสารทั้งหมด"
        >
          <Controller
            control={control}
            name="documentDisplayDateFormat"
            render={({ field }) => (
              <div className="space-y-2.5">
                {DISPLAY_DATE_OPTIONS.map((opt) => (
                  <DateFormatCard
                    key={opt.value}
                    value={opt.value}
                    label={opt.label}
                    sublabel={opt.sublabel}
                    example={opt.example}
                    selected={field.value === opt.value}
                    onClick={() => field.onChange(opt.value)}
                  />
                ))}
              </div>
            )}
          />
        </SettingsCard>
      </form>
    </div>
  );
}
