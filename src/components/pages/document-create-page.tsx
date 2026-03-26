"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileText,
  Building2,
  Users,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import { useCompanyStore } from "@/stores/company-store";
import { useContacts } from "@/hooks/use-workspace-data";
import { loadDocumentSettings } from "@/lib/firebase/settings-mutations";
import type { DocumentSettingsFormValues } from "@/lib/schemas/settings";
import {
  buildDocNumber,
  getNextRunningNumber,
  isDocNumberUnique,
} from "@/lib/firebase/doc-number-utils";
import {
  DOC_TYPE_CONFIG,
  COMPANY_NAME_FONT_SIZE,
  getDocTypesByFlowAndGroup,
  getDefaultDocGroupForFlow,
  getDefaultDocTypeForFlowGroup,
  getGroupsForFlow,
  type ExtDocType,
  type FlowType,
  type DocumentGroup,
  type CompanyNameSize,
} from "@/lib/doc-types";
import {
  step1Schema,
  buildDefaultStep1Values,
  type Step1FormValues,
} from "@/lib/schemas/document-draft";
import { DEFAULT_DOCUMENT_SETTINGS } from "@/lib/schemas/settings";
import type { Company, Contact } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Stepper
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: "ส่วนหัว" },
  { n: 2, label: "รายการ+สรุป" },
  { n: 3, label: "ส่วนเสริม" },
];

function StepperHeader({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 bg-white px-6 py-4 border-b border-border/60">
      {STEPS.map((step, idx) => (
        <div key={step.n} className="flex items-center">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                step.n === current
                  ? "bg-primary text-white"
                  : step.n < current
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {step.n < current ? <Check className="size-3.5" /> : step.n}
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                step.n === current
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div className="mx-4 h-px w-12 bg-border/60" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Card wrapper
// ─────────────────────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  badge,
  action,
  children,
}: {
  icon: React.ElementType;
  title: string;
  badge?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-white">
      <div className="flex items-center gap-3 border-b border-border/60 px-6 py-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {badge && (
          <Badge
            variant="secondary"
            className="ml-auto rounded-full text-xs font-normal"
          >
            {badge}
          </Badge>
        )}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FlowType Toggle
// ─────────────────────────────────────────────────────────────────────────────

function FlowToggle({
  value,
  onChange,
}: {
  value: FlowType;
  onChange: (v: FlowType) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-border/60 bg-muted/30 p-1">
      {(["income", "expense"] as FlowType[]).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-semibold transition-all",
            value === v && v === "income"
              ? "bg-white text-emerald-600 shadow-sm"
              : value === v && v === "expense"
                ? "bg-white text-red-500 shadow-sm"
                : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v === "income" ? "รายรับ" : "รายจ่าย"}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CompanyNameSize Toggle
// ─────────────────────────────────────────────────────────────────────────────

function SizeToggle({
  value,
  onChange,
}: {
  value: CompanyNameSize;
  onChange: (v: CompanyNameSize) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-border/60 bg-muted/30 p-1">
      {(["S", "M", "L", "XL"] as CompanyNameSize[]).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "min-w-[40px] rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
            value === v
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OfficeType fields (reused in company + partner sections)
// ─────────────────────────────────────────────────────────────────────────────

function OfficeTypeFields({
  prefix,
  form,
}: {
  prefix: "companySnapshot" | "partnerSnapshot";
  form: ReturnType<typeof useForm<Step1FormValues>>;
}) {
  const officeType = form.watch(`${prefix}.officeType`);
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const errs = errors[prefix] as
    | Record<string, { message?: string }>
    | undefined;

  return (
    <>
      <div className="space-y-2">
        <Label className="text-sm font-medium">ประเภทสำนักงาน</Label>
        <Controller
          control={control}
          name={`${prefix}.officeType`}
          render={({ field }) => (
            <div className="flex flex-wrap gap-4">
              {(["none", "hq", "branch"] as const).map((v) => (
                <label
                  key={v}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <input
                    type="radio"
                    className="accent-primary"
                    value={v}
                    checked={field.value === v}
                    onChange={() => field.onChange(v)}
                  />
                  <span className="text-sm">
                    {v === "none"
                      ? "ไม่ระบุ"
                      : v === "hq"
                        ? "สำนักงานใหญ่"
                        : "สาขา"}
                  </span>
                </label>
              ))}
            </div>
          )}
        />
      </div>

      {officeType === "branch" && (
        <div className="grid grid-cols-2 gap-4 rounded-xl border border-border/60 bg-muted/30 p-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              ชื่อสาขา <span className="text-destructive">*</span>
            </Label>
            <Input
              className="rounded-xl"
              placeholder="เช่น สาขาลาดพร้าว"
              {...register(`${prefix}.branchName`)}
            />
            {errs?.branchName && (
              <p className="text-xs text-destructive">
                {errs.branchName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              รหัสสาขา <span className="text-destructive">*</span>
            </Label>
            <Input
              className="rounded-xl font-mono"
              placeholder="00001"
              {...register(`${prefix}.branchCode`)}
            />
            {errs?.branchCode && (
              <p className="text-xs text-destructive">
                {errs.branchCode.message}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ExpandSection — collapsible wrapper
// ─────────────────────────────────────────────────────────────────────────────

function ExpandSection({
  label,
  expanded,
  onToggle,
  children,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <span>{label}</span>
        {expanded ? (
          <ChevronUp className="size-4" />
        ) : (
          <ChevronDown className="size-4" />
        )}
      </button>
      {expanded && (
        <div className="space-y-4 border-t border-border/60 px-4 py-4">
          {children}
          <p className="text-xs text-muted-foreground/70">
            * แก้ไขข้อมูลเฉพาะในเอกสารนี้ ไม่กระทบข้อมูลหลัก
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: extract company snapshot from Company record
// ─────────────────────────────────────────────────────────────────────────────

function extractCompanySnapshot(
  c: Company & { id: string },
): Step1FormValues["companySnapshot"] {
  return {
    name: c.name ?? "",
    address: c.address ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    taxId: c.taxId ?? "",
    officeType: (c.officeType as "none" | "hq" | "branch") ?? "none",
    branchName: c.branchName ?? "",
    branchCode: c.branchCode ?? "",
  };
}

function extractPartnerSnapshot(
  c: Contact & { id: string },
): Step1FormValues["partnerSnapshot"] {
  return {
    masterId: c.id,
    name: c.nameTh ?? "",
    taxId: c.taxId ?? "",
    address: c.address ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    contactName: "",
    officeType: (c.officeType as "none" | "hq" | "branch") ?? "none",
    branchName: c.branchName ?? "",
    branchCode: c.branchCode ?? "",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export function DocumentCreatePage() {
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const companies = useCompanyStore((s) => s.companies);
  const { data: contacts, loading: contactsLoading } =
    useContacts(activeCompanyId);

  const [settings, setSettings] = useState<DocumentSettingsFormValues>(
    DEFAULT_DOCUMENT_SETTINGS,
  );
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [companyExpanded, setCompanyExpanded] = useState(false);
  const [docNumChecking, setDocNumChecking] = useState(false);
  const [docNumError, setDocNumError] = useState<string | null>(null);

  // Track whether user manually edited the doc number
  const userEditedDocNum = useRef(false);

  const form = useForm<Step1FormValues>({
    resolver: zodResolver(step1Schema),
    defaultValues: buildDefaultStep1Values(
      activeCompanyId ?? "",
      companies.find((c) => c.id === activeCompanyId)?.name ?? "",
    ),
  });

  const {
    register,
    control,
    watch,
    setValue,
    setError,
    clearErrors,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  const flowType = watch("flowType");
  const documentGroup = watch("documentGroup");
  const documentType = watch("documentType");
  const selectedCompanyId = watch("selectedCompanyId");
  const showReferenceNumber = watch("showReferenceNumber");

  // ── Load settings ──
  useEffect(() => {
    if (!activeCompanyId) return;
    void loadDocumentSettings(activeCompanyId).then((s) => {
      setSettings(s);
      setSettingsLoaded(true);
    });
  }, [activeCompanyId]);

  // ── Init form when active company changes ──
  useEffect(() => {
    if (!activeCompanyId || !companies.length) return;
    const company = companies.find((c) => c.id === activeCompanyId);
    if (!company) return;
    reset(buildDefaultStep1Values(company.id ?? "", company.name ?? ""), {
      keepDirty: false,
    });
    userEditedDocNum.current = false;
  }, [activeCompanyId, companies, reset]);

  // ── When selectedCompanyId changes (user picks different company) ──
  useEffect(() => {
    const company = companies.find((c) => c.id === selectedCompanyId) as
      | (Company & { id: string })
      | undefined;
    if (!company) return;
    setValue("companySnapshot", extractCompanySnapshot(company));
  }, [selectedCompanyId, companies, setValue]);

  // cascade helpers — called directly in onClick, no useEffect needed
  function applyFlowType(newFlow: FlowType) {
    const newGroup = getDefaultDocGroupForFlow(newFlow);
    const newType = getDefaultDocTypeForFlowGroup(newFlow, newGroup);
    setValue("flowType", newFlow);
    setValue("documentGroup", newGroup);
    setValue("documentType", newType);
    userEditedDocNum.current = false;
  }

  function applyDocumentGroup(newGroup: DocumentGroup) {
    const newType = getDefaultDocTypeForFlowGroup(flowType, newGroup);
    setValue("documentGroup", newGroup);
    setValue("documentType", newType);
    userEditedDocNum.current = false;
  }

  // ── Generate doc number when docType/settings change (if user hasn't edited) ──
  useEffect(() => {
    if (!activeCompanyId || !settingsLoaded || userEditedDocNum.current) return;
    const config = DOC_TYPE_CONFIG[documentType];
    // guard: documentType may be stale during cascade transitions
    if (!config) return;
    void (async () => {
      const running = await getNextRunningNumber(activeCompanyId, documentType);
      const num = buildDocNumber(config.prefix, settings, running);
      setValue("documentNumber", num, { shouldValidate: false });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentType, settingsLoaded, settings, activeCompanyId]);

  // ── Doc number uniqueness check on blur ──
  const checkDocNumUnique = useCallback(async () => {
    if (!activeCompanyId) return;
    const num = form.getValues("documentNumber");
    if (!num.trim()) return;
    setDocNumChecking(true);
    const unique = await isDocNumberUnique(activeCompanyId, num);
    setDocNumChecking(false);
    if (!unique) {
      setDocNumError("เลขที่เอกสารนี้ถูกใช้งานแล้ว");
    } else {
      setDocNumError(null);
    }
  }, [activeCompanyId, form]);

  // ── Derived ──
  // fallback to quotation during cascade transitions between groups
  const docConfig =
    DOC_TYPE_CONFIG[documentType] ?? DOC_TYPE_CONFIG["quotation"];
  const partnerRole = docConfig.partnerRole;
  const docGroupsForFlow = getGroupsForFlow(flowType);
  const docTypesForGroup = getDocTypesByFlowAndGroup(flowType, documentGroup);

  const filteredContacts = contacts.filter(
    (c) => c.partnerType === partnerRole,
  );

  function onSelectContact(contactId: string) {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;
    const snapshot = extractPartnerSnapshot(contact);
    setValue("partnerSnapshot.masterId", snapshot.masterId);
    setValue("partnerSnapshot.name", snapshot.name);
    setValue("partnerSnapshot.taxId", snapshot.taxId);
    setValue("partnerSnapshot.address", snapshot.address);
    setValue("partnerSnapshot.phone", snapshot.phone);
    setValue("partnerSnapshot.email", snapshot.email);
    setValue("partnerSnapshot.contactName", snapshot.contactName);
    setValue("partnerSnapshot.officeType", snapshot.officeType);
    setValue("partnerSnapshot.branchName", snapshot.branchName);
    setValue("partnerSnapshot.branchCode", snapshot.branchCode);
  }

  function onSelectManualPartner() {
    setValue("partnerSnapshot.masterId", "");
    setValue("partnerSnapshot.name", "");
    setValue("partnerSnapshot.taxId", "");
    setValue("partnerSnapshot.address", "");
    setValue("partnerSnapshot.phone", "");
    setValue("partnerSnapshot.email", "");
    setValue("partnerSnapshot.contactName", "");
    setValue("partnerSnapshot.officeType", "none");
    setValue("partnerSnapshot.branchName", "");
    setValue("partnerSnapshot.branchCode", "");
  }

  function onReset() {
    userEditedDocNum.current = false;
    const company = companies.find((c) => c.id === activeCompanyId);
    reset(buildDefaultStep1Values(company?.id ?? "", company?.name ?? ""));
    setDocNumError(null);
    setCompanyExpanded(false);
  }

  function onNext(values: Step1FormValues) {
    if (docNumError) return;
    console.log("Step 1 values:", values);
    // TODO: navigate to Step 2
  }

  const partnerSectionTitle =
    partnerRole === "vendor" ? "ข้อมูลผู้ขาย" : "ข้อมูลลูกค้า";

  if (!settingsLoaded && activeCompanyId) {
    return (
      <div className="min-h-screen">
        <AppHeader title="ออกเอกสาร" subtitle="สร้างเอกสารธุรกิจ" />
        <div className="space-y-4 px-6 py-8">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader title="ออกเอกสาร" subtitle="สร้างเอกสารธุรกิจ" />
      <StepperHeader current={1} />

      <form onSubmit={handleSubmit(onNext)} className="space-y-5 px-6 py-8">
        {/* ═══════════════════════════════════════════════════════
            SECTION 1: ออกเอกสารในนาม
        ════════════════════════════════════════════════════════ */}
        <SectionCard icon={Building2} title="ออกเอกสารในนาม">
          <div className="space-y-4">
            {/* company selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">บริษัทที่ออกเอกสาร</Label>
              <Controller
                control={control}
                name="selectedCompanyId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue>
                        {companies.find((c) => c.id === field.value)?.name ??
                          "เลือกบริษัท"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id ?? ""} value={c.id ?? ""}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.selectedCompanyId && (
                <p className="text-xs text-destructive">
                  {errors.selectedCompanyId.message}
                </p>
              )}
            </div>

            {/* expandable edit */}
            <ExpandSection
              label="แก้ไขข้อมูลบริษัทสำหรับเอกสารนี้"
              expanded={companyExpanded}
              onToggle={() => setCompanyExpanded((v) => !v)}
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label className="text-sm font-medium">
                    ชื่อบริษัท <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    className="rounded-xl"
                    {...register("companySnapshot.name")}
                  />
                  {errors.companySnapshot?.name && (
                    <p className="text-xs text-destructive">
                      {errors.companySnapshot.name.message}
                    </p>
                  )}
                </div>
                <div className="col-span-2 space-y-2">
                  <Label className="text-sm font-medium">ที่อยู่</Label>
                  <Textarea
                    className="min-h-[72px] resize-none rounded-xl"
                    {...register("companySnapshot.address")}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">โทรศัพท์</Label>
                  <Input
                    className="rounded-xl"
                    {...register("companySnapshot.phone")}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">อีเมล</Label>
                  <Input
                    className="rounded-xl"
                    {...register("companySnapshot.email")}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">เลขผู้เสียภาษี</Label>
                  <Input
                    className="rounded-xl font-mono"
                    {...register("companySnapshot.taxId")}
                  />
                </div>
                <div className="col-span-2">
                  <OfficeTypeFields prefix="companySnapshot" form={form} />
                </div>
              </div>
            </ExpandSection>
          </div>
        </SectionCard>

        {/* ═══════════════════════════════════════════════════════
            SECTION 2: ข้อมูลเอกสาร
        ════════════════════════════════════════════════════════ */}
        <SectionCard
          icon={FileText}
          title="ข้อมูลเอกสาร"
          action={
            <Controller
              control={control}
              name="flowType"
              render={({ field }) => (
                <FlowToggle value={field.value} onChange={applyFlowType} />
              )}
            />
          }
        >
          <div className="space-y-4">
            {/* 2.2 documentGroup — segmented toggle, no label */}
            <Controller
              control={control}
              name="documentGroup"
              render={({ field }) => (
                <div className="inline-flex rounded-xl border border-border/60 bg-muted/30 p-1">
                  {docGroupsForFlow.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() =>
                        applyDocumentGroup(g.value as DocumentGroup)
                      }
                      className={cn(
                        "rounded-lg px-4 py-1.5 text-sm font-medium transition-all",
                        field.value === g.value
                          ? "bg-white text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              )}
            />

            {/* 2.3 ประเภทเอกสาร + 2.4 เลขที่เอกสาร + 2.5 dates — one row */}
            <div className="flex flex-wrap gap-4">
              {/* ประเภทเอกสาร */}
              <div className="min-w-[160px] flex-1 space-y-1.5">
                <Label className="text-sm font-medium">ประเภทเอกสาร</Label>
                <Controller
                  control={control}
                  name="documentType"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        userEditedDocNum.current = false;
                      }}
                    >
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue>
                          {DOC_TYPE_CONFIG[field.value as ExtDocType]?.label ??
                            "เลือกประเภท"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {docTypesForGroup.map((t) => (
                          <SelectItem key={t} value={t}>
                            {DOC_TYPE_CONFIG[t].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* เลขที่เอกสาร */}
              <div className="min-w-[160px] flex-1 space-y-1.5">
                <Label className="text-sm font-medium">
                  เลขที่เอกสาร <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    className={cn(
                      "rounded-xl font-mono",
                      docNumError && "border-destructive",
                    )}
                    {...register("documentNumber")}
                    onChange={(e) => {
                      register("documentNumber").onChange(e);
                      userEditedDocNum.current = true;
                      setDocNumError(null);
                    }}
                    onBlur={() => void checkDocNumUnique()}
                  />
                  {docNumChecking && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      ตรวจสอบ…
                    </span>
                  )}
                </div>
                {(errors.documentNumber || docNumError) && (
                  <p className="flex items-center gap-1 text-xs text-destructive">
                    <AlertCircle className="size-3" />
                    {docNumError ?? errors.documentNumber?.message}
                  </p>
                )}
              </div>

              {/* วันที่เอกสาร */}
              <div className="min-w-[140px] flex-1 space-y-1.5">
                <Label className="text-sm font-medium">
                  วันที่เอกสาร <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  className="rounded-xl"
                  {...register("documentDate")}
                />
                {errors.documentDate && (
                  <p className="text-xs text-destructive">
                    {errors.documentDate.message}
                  </p>
                )}
              </div>

              {/* extraDate (conditional) */}
              {docConfig.extraDateLabel && (
                <div className="min-w-[140px] flex-1 space-y-1.5">
                  <Label className="text-sm font-medium">
                    {docConfig.extraDateLabel}
                  </Label>
                  <Input
                    type="date"
                    className="rounded-xl"
                    {...register("extraDateValue")}
                  />
                </div>
              )}
            </div>

            <Separator className="opacity-50" />

            {/* 2.6 companyNameSize */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">ขนาดชื่อบริษัท</Label>
              <Controller
                control={control}
                name="companyNameSize"
                render={({ field }) => (
                  <SizeToggle value={field.value} onChange={field.onChange} />
                )}
              />
              <p className="text-xs text-muted-foreground">
                ขนาดฟอนต์จริง:{" "}
                {COMPANY_NAME_FONT_SIZE[watch("companyNameSize")]}px
              </p>
            </div>

            {/* 2.7 showReferenceNumber */}
            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-2.5">
                <Controller
                  control={control}
                  name="showReferenceNumber"
                  render={({ field }) => (
                    <input
                      type="checkbox"
                      className="accent-primary h-4 w-4"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  )}
                />
                <span className="text-sm font-medium">
                  แสดงเลขอ้างอิงในเอกสาร
                </span>
              </label>
              {showReferenceNumber && (
                <div className="space-y-2 pl-6">
                  <Label className="text-sm font-medium">เลขอ้างอิง</Label>
                  <Input
                    className="rounded-xl"
                    placeholder="เช่น PO-2025-001"
                    {...register("referenceNumber")}
                  />
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        {/* ═══════════════════════════════════════════════════════
            SECTION 3: ข้อมูลลูกค้า / ผู้ขาย
        ════════════════════════════════════════════════════════ */}
        <SectionCard icon={Users} title={partnerSectionTitle}>
          <div className="space-y-4">
            {/* partner selector */}
            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <Label className="text-sm font-medium">
                  {partnerRole === "vendor" ? "เลือกผู้ขาย" : "เลือกลูกค้า"}
                </Label>
                {contactsLoading ? (
                  <Skeleton className="h-10 w-full rounded-xl" />
                ) : (
                  <Select
                    value={watch("partnerSnapshot.masterId") || "__none__"}
                    onValueChange={(v) => {
                      if (!v) return;
                      if (v === "__none__") {
                        onSelectManualPartner();
                        return;
                      }
                      onSelectContact(v);
                    }}
                  >
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue>
                        {(() => {
                          const masterId = watch("partnerSnapshot.masterId");
                          if (!masterId) return "— ระบุเอง —";
                          const c = contacts.find((x) => x.id === masterId);
                          return c?.nameTh ?? "เลือกจากรายชื่อ";
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="w-[360px]">
                      <SelectItem value="__none__">— ระบุเอง —</SelectItem>
                      {filteredContacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="font-mono text-xs text-muted-foreground mr-2">
                            {c.code}
                          </span>
                          {c.nameTh}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-border/60 p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label className="text-sm font-medium">
                    {partnerRole === "vendor" ? "ชื่อผู้ขาย" : "ชื่อลูกค้า"}
                  </Label>
                  <Input
                    className="rounded-xl"
                    {...register("partnerSnapshot.name")}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">เลขผู้เสียภาษี</Label>
                  <Input
                    className="rounded-xl font-mono"
                    {...register("partnerSnapshot.taxId")}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">ผู้ติดต่อ</Label>
                  <Input
                    className="rounded-xl"
                    {...register("partnerSnapshot.contactName")}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">โทรศัพท์</Label>
                  <Input
                    className="rounded-xl"
                    {...register("partnerSnapshot.phone")}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">อีเมล</Label>
                  <Input
                    className="rounded-xl"
                    {...register("partnerSnapshot.email")}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label className="text-sm font-medium">ที่อยู่</Label>
                  <Textarea
                    className="min-h-[72px] resize-none rounded-xl"
                    {...register("partnerSnapshot.address")}
                  />
                </div>
                <div className="col-span-2">
                  <OfficeTypeFields prefix="partnerSnapshot" form={form} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground/70">
                * แก้ไขข้อมูลเฉพาะในเอกสารนี้ ไม่กระทบข้อมูลหลัก
              </p>
            </div>
          </div>
        </SectionCard>

        {/* ═══════════════════════════════════════════════════════
            FOOTER ACTIONS
        ════════════════════════════════════════════════════════ */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-white/95 px-6 py-4 backdrop-blur">
          <Button
            type="button"
            variant="ghost"
            className="rounded-xl text-muted-foreground"
            onClick={onReset}
          >
            <RotateCcw className="mr-1.5 size-4" />
            รีเซ็ต
          </Button>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled
            >
              พรีวิว
            </Button>
            <Button
              type="submit"
              className="rounded-xl"
              disabled={!!docNumError}
            >
              ถัดไป
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
