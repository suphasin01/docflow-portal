"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  ChevronDown,
  ImageIcon,
} from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/business/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { useCompanyStore } from "@/stores/company-store";
import { useContacts } from "@/hooks/use-workspace-data";
import {
  addContact,
  archiveContact,
  getNextContactCode,
  updateContact,
} from "@/lib/firebase/contact-mutations";
import {
  contactFormSchema,
  type ContactFormValues,
} from "@/lib/schemas/contact";
import { resizeImageToBase64 } from "@/lib/resize-image";
import type { Contact } from "@/types";

type ContactRow = Contact & { id: string };

const OFFICE_TYPE_LABELS: Record<string, string> = {
  none: "ไม่ระบุ",
  hq: "สำนักงานใหญ่",
  branch: "สาขา",
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: "customer" | "vendor" }) {
  return type === "customer" ? (
    <Badge className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 shadow-none hover:bg-blue-50">
      ลูกค้า
    </Badge>
  ) : (
    <Badge className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700 shadow-none hover:bg-orange-50">
      ผู้ขาย
    </Badge>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            {[
              "รหัส",
              "ประเภท",
              "ชื่อ",
              "เลขผู้เสียภาษี",
              "โทรศัพท์",
              "อีเมล",
              "",
            ].map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 7 }).map((__, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-4 w-full rounded" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact Form Modal
// ─────────────────────────────────────────────────────────────────────────────

interface ContactFormModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: ContactRow | null;
  nextCode: string;
  onSuccess: () => void;
  companyId: string;
  userId: string;
  nextCodeNumber: number;
}

function ContactFormModal({
  open,
  onOpenChange,
  editing,
  nextCode,
  onSuccess,
  companyId,
  userId,
  nextCodeNumber,
}: ContactFormModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      partnerType: "customer",
      nameTh: "",
      nameEn: "",
      taxId: "",
      phone: "",
      email: "",
      address: "",
      officeType: "none",
      branchName: "",
      branchCode: "",
      logoBase64: "",
    },
  });

  const partnerType = watch("partnerType");
  const officeType = watch("officeType");

  // เติมข้อมูลเมื่อแก้ไข
  useEffect(() => {
    if (editing) {
      reset({
        partnerType: editing.partnerType,
        nameTh: editing.nameTh,
        nameEn: editing.nameEn ?? "",
        taxId: editing.taxId ?? "",
        phone: editing.phone ?? "",
        email: editing.email ?? "",
        address: editing.address ?? "",
        officeType: editing.officeType ?? "none",
        branchName: editing.branchName ?? "",
        branchCode: editing.branchCode ?? "",
        logoBase64: editing.logoBase64 ?? "",
      });
      setLogoPreview(editing.logoBase64 ?? "");
    } else {
      reset({
        partnerType: "customer",
        nameTh: "",
        nameEn: "",
        taxId: "",
        phone: "",
        email: "",
        address: "",
        officeType: "none",
        branchName: "",
        branchCode: "",
        logoBase64: "",
      });
      setLogoPreview("");
    }
  }, [editing, open, reset]);

  const handleLogoUpload = useCallback(
    async (file: File) => {
      try {
        const base64 = await resizeImageToBase64(file, 200, 0.85);
        setLogoPreview(base64);
        setValue("logoBase64", base64);
      } catch {
        toast.error("อัปโหลดรูปไม่สำเร็จ");
      }
    },
    [setValue],
  );

  const onSubmit = async (values: ContactFormValues) => {
    setSaving(true);
    try {
      if (editing) {
        await updateContact({ contactId: editing.id, data: values });
        toast.success("อัปเดตข้อมูลแล้ว");
      } else {
        await addContact({
          companyId,
          userId,
          code: nextCode,
          codeNumber: nextCodeNumber,
          data: values,
        });
        toast.success("เพิ่มลูกค้า/ผู้ขายแล้ว");
      }
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      console.error(e);
      toast.error("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = editing
    ? editing.partnerType === "vendor"
      ? "แก้ไขผู้ขาย"
      : "แก้ไขลูกค้า"
    : "เพิ่มลูกค้า/ผู้ขาย";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
        <DialogHeader className="flex-shrink-0 border-b border-border/60 px-6 py-5">
          <DialogTitle className="text-lg font-semibold">
            {modalTitle}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <form
            id="contact-form"
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6 px-6 py-5"
          >
            {/* ─── โลโก้ ─── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                โลโก้ (หัวกระดาษเอกสาร)
              </Label>
              <div className="flex items-center gap-4">
                <div
                  className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border/70 bg-muted/40 transition hover:border-primary/50 hover:bg-muted/60"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoPreview}
                      alt="logo"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="size-7 text-muted-foreground/50" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    เลือกรูป
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG · แนะนำสี่เหลี่ยมจัตุรัส
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleLogoUpload(file);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            {/* ─── ประเภท ─── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">ประเภท</Label>
              <Controller
                control={control}
                name="partnerType"
                render={({ field }) => (
                  <div className="flex gap-4">
                    {(["customer", "vendor"] as const).map((v) => (
                      <label
                        key={v}
                        className="flex cursor-pointer items-center gap-2.5"
                      >
                        <input
                          type="radio"
                          className="accent-primary"
                          value={v}
                          checked={field.value === v}
                          onChange={() => field.onChange(v)}
                        />
                        <span className="text-sm">
                          {v === "customer" ? "ลูกค้า" : "ผู้ขาย"}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* ─── รหัส ─── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">รหัส</Label>
              <Input
                className="rounded-xl bg-muted/50 font-mono"
                value={editing ? editing.code : nextCode}
                readOnly
                disabled
              />
              <p className="text-xs text-muted-foreground">
                สร้างโดยระบบอัตโนมัติ
              </p>
            </div>

            {/* ─── ชื่อ TH ─── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {partnerType === "vendor" ? "ชื่อผู้ขาย" : "ชื่อลูกค้า"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                className="rounded-xl"
                placeholder={
                  partnerType === "vendor"
                    ? "เช่น บริษัท ตัวอย่าง จำกัด"
                    : "เช่น บริษัท ลูกค้า จำกัด"
                }
                {...register("nameTh")}
              />
              {errors.nameTh && (
                <p className="text-xs text-destructive">
                  {errors.nameTh.message}
                </p>
              )}
            </div>

            {/* ─── ชื่อ EN ─── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">ชื่อ (EN)</Label>
              <Input
                className="rounded-xl"
                placeholder="e.g. Example Company Ltd."
                {...register("nameEn")}
              />
            </div>

            {/* ─── เลขผู้เสียภาษี ─── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">เลขผู้เสียภาษี</Label>
              <Input
                className="rounded-xl font-mono"
                placeholder="ตัวเลข 13 หลัก"
                maxLength={13}
                {...register("taxId")}
              />
              {errors.taxId && (
                <p className="text-xs text-destructive">
                  {errors.taxId.message}
                </p>
              )}
            </div>

            {/* ─── โทรศัพท์ / อีเมล ─── */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">โทรศัพท์</Label>
                <Input
                  className="rounded-xl"
                  placeholder="0812345678"
                  {...register("phone")}
                />
                {errors.phone && (
                  <p className="text-xs text-destructive">
                    {errors.phone.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">อีเมล</Label>
                <Input
                  className="rounded-xl"
                  type="email"
                  placeholder="email@example.com"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>
            </div>

            {/* ─── ที่อยู่ ─── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">ที่อยู่</Label>
              <Textarea
                className="min-h-[80px] rounded-xl resize-none"
                placeholder="ที่อยู่สำหรับออกเอกสาร"
                {...register("address")}
              />
            </div>

            {/* ─── ประเภทสำนักงาน ─── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">ประเภทสำนักงาน</Label>
              <Controller
                control={control}
                name="officeType"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-4">
                    {(["none", "hq", "branch"] as const).map((v) => (
                      <label
                        key={v}
                        className="flex cursor-pointer items-center gap-2.5"
                      >
                        <input
                          type="radio"
                          className="accent-primary"
                          value={v}
                          checked={field.value === v}
                          onChange={() => field.onChange(v)}
                        />
                        <span className="text-sm">{OFFICE_TYPE_LABELS[v]}</span>
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* ─── สาขา (conditional) ─── */}
            {officeType === "branch" && (
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  ข้อมูลสาขา
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      ชื่อสาขา <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      className="rounded-xl"
                      placeholder="เช่น สาขาลาดพร้าว"
                      {...register("branchName")}
                    />
                    {errors.branchName && (
                      <p className="text-xs text-destructive">
                        {errors.branchName.message}
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
                      {...register("branchCode")}
                    />
                    {errors.branchCode && (
                      <p className="text-xs text-destructive">
                        {errors.branchCode.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </form>
        </ScrollArea>

        {/* ─── Footer ─── */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border/60 bg-white px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            form="contact-form"
            className="rounded-xl"
            disabled={saving}
          >
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete Confirm Dialog
// ─────────────────────────────────────────────────────────────────────────────

function DeleteDialog({
  contact,
  onClose,
  onConfirm,
}: {
  contact: ContactRow | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!contact} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            ลบ{contact?.partnerType === "vendor" ? "ผู้ขาย" : "ลูกค้า"}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          ต้องการลบ{" "}
          <span className="font-medium text-foreground">{contact?.nameTh}</span>{" "}
          ออกจากระบบ? ข้อมูลจะถูกซ่อนและไม่แสดงในรายการ
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={onClose}
          >
            ยกเลิก
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="rounded-xl"
            onClick={onConfirm}
          >
            ยืนยันการลบ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export function ContactsPage() {
  const { user } = useAuth();
  const companyId = useCompanyStore((s) => s.activeCompanyId);

  const { data: contacts, loading } = useContacts(companyId);

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContactRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContactRow | null>(null);

  const [nextCode, setNextCode] = useState("C0001");
  const [nextCodeNumber, setNextCodeNumber] = useState(1);

  // โหลด nextCode ทุกครั้งที่เปิด modal (create เท่านั้น)
  const openCreateModal = useCallback(async () => {
    if (!companyId) return;
    try {
      const { code, codeNumber } = await getNextContactCode(companyId);
      setNextCode(code);
      setNextCodeNumber(codeNumber);
    } catch {
      // use default
    }
    setEditing(null);
    setModalOpen(true);
  }, [companyId]);

  const openEditModal = useCallback((row: ContactRow) => {
    setEditing(row);
    setModalOpen(true);
  }, []);

  // ─── Search + filter ───
  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return contacts.filter((c) => {
      if (typeFilter !== "all" && c.partnerType !== typeFilter) return false;
      if (!term) return true;
      return (
        c.code.toLowerCase().includes(term) ||
        c.nameTh.toLowerCase().includes(term) ||
        (c.nameEn ?? "").toLowerCase().includes(term) ||
        (c.phone ?? "").includes(term) ||
        (c.email ?? "").toLowerCase().includes(term) ||
        (c.taxId ?? "").includes(term)
      );
    });
  }, [contacts, q, typeFilter]);

  // ─── Delete ───
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await archiveContact(deleteTarget.id);
      toast.success("ลบแล้ว");
    } catch {
      toast.error("ลบไม่สำเร็จ");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="min-h-screen">
      <AppHeader
        title="ลูกค้า / ผู้ขาย"
        subtitle="ข้อมูลลูกค้าเพื่อออกเอกสาร"
        actions={
          <Button
            type="button"
            className="rounded-xl"
            onClick={() => void openCreateModal()}
            disabled={!companyId}
          >
            <Plus className="mr-1.5 size-4" />
            เพิ่มลูกค้า/ผู้ขาย
          </Button>
        }
      />

      <div className="space-y-5 px-6 py-8">
        {/* ─── Search + filter ─── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-xl pl-10"
              placeholder="ค้นหาชื่อ, รหัส, เบอร์โทร, อีเมล..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setQ("")}
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <Select
            value={typeFilter}
            onValueChange={(v) => {
              if (v) setTypeFilter(v);
            }}
          >
            <SelectTrigger className="h-10 w-[160px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="customer">ลูกค้า</SelectItem>
              <SelectItem value="vendor">ผู้ขาย</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ─── Table ─── */}
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={
              q || typeFilter !== "all"
                ? "ไม่พบผลลัพธ์"
                : "ยังไม่มีข้อมูลลูกค้า/ผู้ขาย"
            }
            description={
              q || typeFilter !== "all"
                ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง"
                : "เริ่มต้นโดยการเพิ่มลูกค้า/ผู้ขายรายการแรก"
            }
            action={
              !q && typeFilter === "all" ? (
                <Button
                  type="button"
                  className="rounded-xl"
                  onClick={() => void openCreateModal()}
                  disabled={!companyId}
                >
                  <Plus className="mr-1.5 size-4" />
                  เพิ่มลูกค้า/ผู้ขาย
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-24 font-medium">รหัส</TableHead>
                  <TableHead className="w-24 font-medium">ประเภท</TableHead>
                  <TableHead className="font-medium">ชื่อ</TableHead>
                  <TableHead className="font-medium">เลขผู้เสียภาษี</TableHead>
                  <TableHead className="font-medium">โทรศัพท์</TableHead>
                  <TableHead className="font-medium">อีเมล</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id} className="group cursor-default">
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {row.code}
                      </span>
                    </TableCell>
                    <TableCell>
                      <TypeBadge type={row.partnerType} />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium leading-tight">
                          {row.nameTh}
                        </p>
                        {row.nameEn && (
                          <p className="text-xs text-muted-foreground">
                            {row.nameEn}
                          </p>
                        )}
                        {row.officeType === "branch" && row.branchName && (
                          <p className="text-xs text-muted-foreground/70">
                            สาขา {row.branchName}
                            {row.branchCode ? ` (${row.branchCode})` : ""}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {row.taxId || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.phone || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.email || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8 rounded-lg"
                          onClick={() => openEditModal(row)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8 rounded-lg text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Footer summary */}
            <div className="border-t border-border/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                แสดง {filtered.length} รายการ
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Modals ─── */}
      {companyId && user && (
        <ContactFormModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          editing={editing}
          nextCode={nextCode}
          nextCodeNumber={nextCodeNumber}
          onSuccess={() => {}}
          companyId={companyId}
          userId={user.uid}
        />
      )}

      <DeleteDialog
        contact={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
