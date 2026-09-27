"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/business/empty-state";
import {
  FormFieldError,
  FormInputField,
  FormTextareaField,
} from "@/components/business/form-fields";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Check,
  Edit2,
  Plus,
  Star,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useCompanyStore } from "@/stores/company-store";
import {
  createCompany,
  updateCompany,
  archiveCompany,
} from "@/lib/firebase/company-mutations";
import { resizeImageToBase64 } from "@/lib/resize-image";
import { companyFormSchema } from "@/lib/schemas/company";
import { cn } from "@/lib/utils";
import type { Company } from "@/types";

type OfficeType = "none" | "hq" | "branch";

type CompanyFormState = {
  officeType: OfficeType;
  companyNameTh: string;
  companyNameEn: string;
  taxId: string;
  phone: string;
  email: string;
  address: string;
  signerName: string;
  signerPosition: string;
  logoUrl: string;
  branchName: string;
  branchCode: string;
};

const initialForm: CompanyFormState = {
  officeType: "none",
  companyNameTh: "",
  companyNameEn: "",
  taxId: "",
  phone: "",
  email: "",
  address: "",
  signerName: "",
  signerPosition: "",
  logoUrl: "",
  branchName: "",
  branchCode: "",
};

type CompanyWithId = Company & { id: string };

export function CompanyPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const companies = useCompanyStore((s) => s.companies);
  const companiesLoading = useCompanyStore((s) => s.companiesLoading);
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const setActiveCompanyId = useCompanyStore((s) => s.setActiveCompanyId);

  const [open, setOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyWithId | null>(
    null,
  );
  const [form, setForm] = useState<CompanyFormState>(initialForm);
  const [errors, setErrors] = useState<
    Partial<Record<keyof CompanyFormState, string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [logoResizing, setLogoResizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // เปิด dialog สร้างใหม่ถ้ามี ?action=create ใน URL
  useEffect(() => {
    if (searchParams.get("action") === "create") {
      openCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function openCreate() {
    setEditingCompany(null);
    setForm({ ...initialForm, email: user?.email ?? "" });
    setErrors({});
    setOpen(true);
  }

  function openEdit(company: CompanyWithId) {
    setEditingCompany(company);
    setForm({
      officeType: (company.officeType ?? "none") as OfficeType,
      companyNameTh: company.name ?? "",
      companyNameEn: company.nameEn ?? "",
      taxId: company.taxId ?? "",
      branchName: company.branchName ?? company.branch ?? "",
      branchCode: company.branchCode ?? "",
      address: company.address ?? "",
      phone: company.phone ?? "",
      email: company.email ?? "",
      signerName: company.signerName ?? "",
      signerPosition: company.signerPosition ?? "",
      logoUrl: company.logoUrl ?? "",
    });
    setErrors({});
    setOpen(true);
  }

  const isBranch = form.officeType === "branch";

  function updateField<K extends keyof CompanyFormState>(
    key: K,
    value: CompanyFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function onPickLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }
    setLogoResizing(true);
    try {
      const base64 = await resizeImageToBase64(file, 200, 0.85);
      updateField("logoUrl", base64);
    } catch {
      toast.error("แปลงรูปไม่สำเร็จ");
    } finally {
      setLogoResizing(false);
    }
  }

  async function onSave() {
    if (!user) return;

    const parsed = companyFormSchema.safeParse(form);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof CompanyFormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !(key in nextErrors)) {
          nextErrors[key as keyof CompanyFormState] = issue.message;
        }
      }
      setErrors(nextErrors);
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    setSaving(true);
    try {
      const patch = {
        name: form.companyNameTh.trim(),
        nameEn: form.companyNameEn.trim(),
        officeType: form.officeType,
        taxId: form.taxId.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        signerName: form.signerName.trim(),
        signerPosition: form.signerPosition.trim(),
        logoUrl: form.logoUrl,
        branchName: form.officeType === "branch" ? form.branchName.trim() : "",
        branchCode: form.officeType === "branch" ? form.branchCode.trim() : "",
        branch: form.officeType === "branch" ? form.branchName.trim() : "",
      };

      if (editingCompany) {
        await updateCompany({ companyId: editingCompany.id, patch });
        toast.success("แก้ไขข้อมูลบริษัทแล้ว");
      } else {
        const newId = await createCompany({
          ownerId: user.uid,
          data: { ...patch, name: patch.name },
        });
        setActiveCompanyId(newId);
        toast.success("เพิ่มบริษัทใหม่แล้ว");
      }

      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function onArchive(company: CompanyWithId) {
    if (companies.length <= 1) {
      toast.error("ไม่สามารถลบบริษัทเดียวที่เหลือได้");
      return;
    }
    setArchiving(company.id);
    try {
      await archiveCompany(company.id);
      // ถ้า archive บริษัทที่ active อยู่ → ย้ายไปตัวอื่น
      if (company.id === activeCompanyId) {
        const next = companies.find((c) => c.id !== company.id);
        if (next) setActiveCompanyId(next.id);
      }
      toast.success(`เก็บถาวร "${company.name}" แล้ว`);
    } catch (e) {
      console.error(e);
      toast.error("ดำเนินการไม่สำเร็จ");
    } finally {
      setArchiving(null);
    }
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)]">
      <AppHeader
        title="บริษัทของฉัน"
        subtitle="จัดการข้อมูลบริษัทและสลับบริษัทที่ใช้งาน"
        actions={
          <Button type="button" className="rounded-xl" onClick={openCreate}>
            <Plus className="mr-1.5 size-4" />
            เพิ่มบริษัท
          </Button>
        }
      />

      <div className="space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        {companiesLoading ? (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl bg-surface-secondary/50"
              />
            ))}
          </div>
        ) : companies.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="ยังไม่มีบริษัท"
            description="เริ่มต้นเพิ่มบริษัทเพื่อใช้งานเอกสารธุรกิจ"
            action={
              <Button
                type="button"
                className="rounded-xl"
                onClick={openCreate}
              >
                <Plus className="mr-2 size-4" />
                เพิ่มบริษัท
              </Button>
            }
            className="max-w-xl"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {companies.map((company) => (
              <CompanyCard
                key={company.id}
                company={company}
                isActive={company.id === activeCompanyId}
                archiving={archiving === company.id}
                onSelect={() => setActiveCompanyId(company.id)}
                onEdit={() => openEdit(company)}
                onArchive={() => void onArchive(company)}
                canArchive={companies.length > 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialog สร้าง / แก้ไขบริษัท */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-2xl sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? "แก้ไขข้อมูลบริษัท" : "เพิ่มบริษัท"}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">
            <div className="grid gap-4 py-2">
              {/* Logo + ชื่อ */}
              <div className="grid gap-4 lg:grid-cols-[156px_1fr]">
                <div className="space-y-2">
                  <Label className="pt-0.5 leading-relaxed">โลโก้</Label>
                  <div className="flex items-start gap-3 sm:block sm:space-y-2">
                    <div className="relative size-28 overflow-hidden rounded-md border bg-surface-secondary/20">
                      {logoResizing ? (
                        <div className="flex size-full items-center justify-center text-xs text-muted-foreground animate-pulse">
                          กำลังแปลง…
                        </div>
                      ) : form.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={form.logoUrl}
                          alt="company logo"
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                          ไม่มีโลโก้
                        </div>
                      )}
                      {form.logoUrl && !logoResizing && (
                        <button
                          type="button"
                          onClick={() => updateField("logoUrl", "")}
                          className="absolute right-1 top-1 rounded-full bg-red-500/90 p-0.5 text-white"
                        >
                          <XCircle className="size-4" />
                        </button>
                      )}
                    </div>
                    <div className="pt-1 sm:hidden">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-lg px-3 text-xs"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="mr-2 size-4" />
                        เลือกรูป
                      </Button>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={onPickLogoFile}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="hidden h-9 w-28 rounded-lg sm:inline-flex"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 size-4" />
                    เลือกรูป
                  </Button>
                  <p className="hidden w-28 text-xs text-muted-foreground sm:block">
                    JPG, PNG • แนะนำ 200x200
                  </p>
                  <FormFieldError message={errors.logoUrl} />
                </div>

                <div className="space-y-3">
                  <FormInputField
                    label="ชื่อบริษัท (TH) *"
                    value={form.companyNameTh}
                    error={errors.companyNameTh}
                    onChange={(value) => updateField("companyNameTh", value)}
                  />
                  <FormInputField
                    label="ชื่อบริษัท (EN)"
                    value={form.companyNameEn}
                    error={errors.companyNameEn}
                    onChange={(value) => updateField("companyNameEn", value)}
                  />
                </div>
              </div>

              {/* Tax / Phone / Email */}
              <div className="grid gap-3 md:grid-cols-3">
                <FormInputField
                  label="เลขผู้เสียภาษี"
                  value={form.taxId}
                  error={errors.taxId}
                  onChange={(value) => updateField("taxId", value)}
                />
                <FormInputField
                  label="โทรศัพท์"
                  value={form.phone}
                  error={errors.phone}
                  onChange={(value) => updateField("phone", value)}
                />
                <FormInputField
                  label="อีเมล"
                  value={form.email}
                  error={errors.email}
                  onChange={(value) => updateField("email", value)}
                />
              </div>

              {/* Office type */}
              <div className="space-y-2">
                <Label className="pt-0.5 leading-relaxed">ประเภทสำนักงาน</Label>
                <div className="flex flex-wrap items-center gap-5">
                  <OfficeTypeRadio
                    value="none"
                    checked={form.officeType === "none"}
                    label="ไม่ระบุ"
                    onChange={(v) => updateField("officeType", v)}
                  />
                  <OfficeTypeRadio
                    value="hq"
                    checked={form.officeType === "hq"}
                    label="สำนักงานใหญ่"
                    onChange={(v) => updateField("officeType", v)}
                  />
                  <OfficeTypeRadio
                    value="branch"
                    checked={form.officeType === "branch"}
                    label="สาขา"
                    onChange={(v) => updateField("officeType", v)}
                  />
                </div>
              </div>

              {/* Branch fields */}
              <div
                className={cn(
                  "overflow-hidden transition-all duration-200 ease-out",
                  isBranch ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
                )}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <FormInputField
                    label="ชื่อสาขา"
                    value={form.branchName}
                    error={errors.branchName}
                    onChange={(v) => updateField("branchName", v)}
                  />
                  <FormInputField
                    label="รหัสสาขา"
                    value={form.branchCode}
                    error={errors.branchCode}
                    onChange={(v) => updateField("branchCode", v)}
                  />
                </div>
              </div>

              <FormTextareaField
                label="ที่อยู่"
                value={form.address}
                error={errors.address}
                onChange={(v) => updateField("address", v)}
              />

              <div className="grid gap-3 md:grid-cols-2">
                <FormInputField
                  label="ชื่อผู้ลงนาม"
                  value={form.signerName}
                  error={errors.signerName}
                  onChange={(v) => updateField("signerName", v)}
                />
                <FormInputField
                  label="ตำแหน่งผู้ลงนาม"
                  value={form.signerPosition}
                  error={errors.signerPosition}
                  onChange={(v) => updateField("signerPosition", v)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              disabled={saving}
              onClick={() => void onSave()}
            >
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────────── CompanyCard ───────────── */

function CompanyCard({
  company,
  isActive,
  archiving,
  canArchive,
  onSelect,
  onEdit,
  onArchive,
}: {
  company: CompanyWithId;
  isActive: boolean;
  archiving: boolean;
  canArchive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const branchLabel =
    company.officeType === "branch"
      ? (company.branchName ?? company.branch ?? "สาขา")
      : company.officeType === "hq"
        ? "สำนักงานใหญ่"
        : null;

  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 rounded-2xl border bg-surface p-5 shadow-sm transition",
        isActive
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/30",
      )}
    >
      {/* active badge */}
      {isActive && (
        <span className="inline-flex items-center gap-1 self-start rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          <Check className="size-3" />
          ใช้งานอยู่
        </span>
      )}

      {/* Logo + ชื่อ */}
      <div className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-secondary">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt={company.name}
              className="size-12 rounded-xl object-cover"
            />
          ) : (
            <Building2 className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          {/* ชื่อบริษัท */}
          <p className="truncate font-semibold leading-tight text-foreground">
            {company.name}
          </p>
          {company.nameEn && (
            <p className="truncate text-xs text-muted-foreground/80">
              {company.nameEn}
            </p>
          )}

          {/* badge สาขา */}
          {branchLabel && (
            <span className="mt-1 inline-block rounded-full bg-surface-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {branchLabel}
            </span>
          )}

          {/* ข้อมูลติดต่อ */}
          {(company.taxId || company.phone || company.email || company.address) && (
            <div className="mt-2 space-y-0.5 border-t border-border/50 pt-2">
              {company.taxId && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-16 shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/60">เลขภาษี</span>
                  <span className="font-mono">{company.taxId}</span>
                </p>
              )}
              {company.phone && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-16 shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/60">โทรศัพท์</span>
                  <span className="min-w-0 break-all">{company.phone}</span>
                </p>
              )}
              {company.email && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-16 shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/60">อีเมล</span>
                  <span className="truncate">{company.email}</span>
                </p>
              )}
              {company.address && (
                <p className="flex gap-1.5 text-xs text-muted-foreground">
                  <span className="w-16 shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/60">ที่อยู่</span>
                  <span className="line-clamp-2">{company.address}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {!isActive && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 flex-1 rounded-lg text-xs"
            onClick={onSelect}
          >
            <Star className="mr-1.5 size-3" />
            ตั้งเป็นบริษัทที่ใช้งาน
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 rounded-lg px-3"
          onClick={onEdit}
          aria-label={`แก้ไข ${company.name}`}
        >
          <Edit2 className="size-3.5" />
        </Button>
        {canArchive && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onArchive}
            aria-label={`เก็บถาวร ${company.name}`}
            disabled={archiving}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* ───────────── OfficeTypeRadio ───────────── */

function OfficeTypeRadio({
  value,
  label,
  checked,
  onChange,
}: {
  value: OfficeType;
  label: string;
  checked: boolean;
  onChange: (value: OfficeType) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
      <input
        type="radio"
        className="size-4 accent-primary"
        checked={checked}
        onChange={() => onChange(value)}
      />
      <span>{label}</span>
    </label>
  );
}
