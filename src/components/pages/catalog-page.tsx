"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Package, Plus, Pencil, Trash2, Search, X } from "lucide-react";

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
import { useCatalogItems } from "@/hooks/use-workspace-data";
import {
  addCatalogItem,
  archiveCatalogItem,
  getNextProductCode,
  updateCatalogItem,
} from "@/lib/firebase/product-mutations";
import {
  catalogFormSchema,
  resolveVatRate,
  type CatalogFormValues,
} from "@/lib/schemas/catalog";
import type { CatalogItem } from "@/types";

type CatalogRow = CatalogItem & { id: string };

const ITEM_TYPE_LABELS: Record<string, string> = {
  product: "สินค้า",
  service: "บริการ",
};

const VAT_TYPE_LABELS: Record<string, string> = {
  vat3: "3%",
  vat7: "7%",
  custom: "กำหนดเอง",
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ItemTypeBadge({ type }: { type: "product" | "service" }) {
  return type === "product" ? (
    <Badge className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 shadow-none hover:bg-violet-50">
      สินค้า
    </Badge>
  ) : (
    <Badge className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 shadow-none hover:bg-emerald-50">
      บริการ
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
              "ชื่อสินค้า/บริการ",
              "หน่วย",
              "ราคาขาย",
              "ราคาซื้อ",
              "หมวด",
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
// Product/Service Form Modal
// ─────────────────────────────────────────────────────────────────────────────

interface CatalogFormModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: CatalogRow | null;
  nextCode: string;
  nextCodeNumber: number;
  companyId: string;
  userId: string;
}

function CatalogFormModal({
  open,
  onOpenChange,
  editing,
  nextCode,
  nextCodeNumber,
  companyId,
  userId,
}: CatalogFormModalProps) {
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CatalogFormValues>({
    resolver: zodResolver(catalogFormSchema),
    defaultValues: {
      itemType: "product",
      name: "",
      description: "",
      unit: "",
      salePrice: 0,
      costPrice: 0,
      vatType: "vat7",
      customVatRate: 0,
    },
  });

  const vatType = watch("vatType");

  useEffect(() => {
    if (editing) {
      reset({
        itemType: editing.itemType ?? "product",
        name: editing.name,
        description: editing.description ?? "",
        unit: editing.unit ?? "",
        salePrice: editing.salePrice,
        costPrice: editing.costPrice ?? 0,
        vatType: editing.vatType ?? "vat7",
        customVatRate: editing.customVatRate ?? 0,
      });
    } else {
      reset({
        itemType: "product",
        name: "",
        description: "",
        unit: "",
        salePrice: 0,
        costPrice: 0,
        vatType: "vat7",
        customVatRate: 0,
      });
    }
  }, [editing, open, reset]);

  // sync customVatRate อัตโนมัติเมื่อเปลี่ยน vatType
  useEffect(() => {
    if (vatType === "vat3") setValue("customVatRate", 3);
    else if (vatType === "vat7") setValue("customVatRate", 7);
  }, [vatType, setValue]);

  const onSubmit = async (values: CatalogFormValues) => {
    setSaving(true);
    try {
      if (editing) {
        await updateCatalogItem({ itemId: editing.id, data: values });
        toast.success("อัปเดตสินค้า/บริการแล้ว");
      } else {
        await addCatalogItem({
          companyId,
          userId,
          code: nextCode,
          codeNumber: nextCodeNumber,
          data: values,
        });
        toast.success("เพิ่มสินค้า/บริการแล้ว");
      }
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const itemTypeWatch = watch("itemType");
  const modalTitle = editing
    ? editing.itemType === "service"
      ? "แก้ไขบริการ"
      : "แก้ไขสินค้า"
    : "เพิ่มสินค้า/บริการ";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-xl">
        <DialogHeader className="flex-shrink-0 border-b border-border/60 px-6 py-5">
          <DialogTitle className="text-lg font-semibold">
            {modalTitle}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <form
            id="catalog-form"
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5 px-6 py-5"
          >
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

            {/* ─── หมวดหมู่ (itemType) ─── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                หมวดหมู่ <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="itemType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue>
                        {field.value === "product"
                          ? "สินค้า"
                          : field.value === "service"
                            ? "บริการ"
                            : "เลือกประเภท"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">สินค้า</SelectItem>
                      <SelectItem value="service">บริการ</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.itemType && (
                <p className="text-xs text-destructive">
                  {errors.itemType.message}
                </p>
              )}
            </div>

            {/* ─── ชื่อ ─── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                ชื่อ{itemTypeWatch === "service" ? "บริการ" : "สินค้า"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                className="rounded-xl"
                placeholder="เช่น บริการออกแบบเว็บไซต์"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* ─── รายละเอียด ─── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">รายละเอียดสินค้า</Label>
              <Textarea
                className="min-h-[80px] resize-none rounded-xl"
                placeholder="เช่น ขนาด, สี, สเปค"
                {...register("description")}
              />
            </div>

            {/* ─── หน่วย ─── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">หน่วย</Label>
              <Input
                className="rounded-xl"
                placeholder="เช่น ชิ้น, งาน, ชุด"
                {...register("unit")}
              />
            </div>

            {/* ─── ราคาขาย / ราคาซื้อ ─── */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  ราคาขาย <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ฿
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="rounded-xl pl-7"
                    {...register("salePrice", { valueAsNumber: true })}
                  />
                </div>
                {errors.salePrice && (
                  <p className="text-xs text-destructive">
                    {errors.salePrice.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">ราคาซื้อ (ต้นทุน)</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ฿
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="rounded-xl pl-7"
                    {...register("costPrice", { valueAsNumber: true })}
                  />
                </div>
                {errors.costPrice && (
                  <p className="text-xs text-destructive">
                    {errors.costPrice.message}
                  </p>
                )}
              </div>
            </div>

            {/* ─── ภาษี ─── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">ภาษี</Label>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <Controller
                    control={control}
                    name="vatType"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full rounded-xl">
                          <SelectValue>
                            {field.value === "vat3"
                              ? "3%"
                              : field.value === "vat7"
                                ? "7%"
                                : field.value === "custom"
                                  ? "กำหนดเอง"
                                  : "เลือกอัตรา VAT"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vat3">3%</SelectItem>
                          <SelectItem value="vat7">7%</SelectItem>
                          <SelectItem value="custom">กำหนดเอง</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {vatType === "custom" ? (
                  <div className="w-28 shrink-0 space-y-1">
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        step="0.1"
                        className="rounded-xl pr-7"
                        placeholder="0"
                        {...register("customVatRate", { valueAsNumber: true })}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        %
                      </span>
                    </div>
                    {errors.customVatRate && (
                      <p className="text-xs text-destructive">
                        {errors.customVatRate.message}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
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
            form="catalog-form"
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
  item,
  onClose,
  onConfirm,
}: {
  item: CatalogRow | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            ลบ{item?.itemType === "service" ? "บริการ" : "สินค้า"}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          ต้องการลบ{" "}
          <span className="font-medium text-foreground">{item?.name}</span>{" "}
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

export function CatalogPage() {
  const { user } = useAuth();
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const { data: items, loading } = useCatalogItems(companyId);

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogRow | null>(null);

  const [nextCode, setNextCode] = useState("P0001");
  const [nextCodeNumber, setNextCodeNumber] = useState(1);

  const openCreateModal = useCallback(async () => {
    if (!companyId) return;
    try {
      const { code, codeNumber } = await getNextProductCode(companyId);
      setNextCode(code);
      setNextCodeNumber(codeNumber);
    } catch {
      // use default
    }
    setEditing(null);
    setModalOpen(true);
  }, [companyId]);

  const openEditModal = useCallback((row: CatalogRow) => {
    setEditing(row);
    setModalOpen(true);
  }, []);

  // ─── Search + filter ───
  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return items.filter((item) => {
      if (typeFilter !== "all" && item.itemType !== typeFilter) return false;
      if (!term) return true;
      return (
        item.code.toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term) ||
        (item.description ?? "").toLowerCase().includes(term) ||
        (item.unit ?? "").toLowerCase().includes(term)
      );
    });
  }, [items, q, typeFilter]);

  // ─── Delete ───
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await archiveCatalogItem(deleteTarget.id);
      toast.success("ลบแล้ว");
    } catch {
      toast.error("ลบไม่สำเร็จ");
    } finally {
      setDeleteTarget(null);
    }
  };

  const fmtPrice = (n: number) =>
    n.toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="min-h-screen">
      <AppHeader
        title="สินค้า / บริการ"
        subtitle="จัดการสินค้าและบริการ"
        actions={
          <Button
            type="button"
            className="rounded-xl"
            onClick={() => void openCreateModal()}
            disabled={!companyId}
          >
            <Plus className="mr-1.5 size-4" />
            เพิ่มสินค้า
          </Button>
        }
      />

      <div className="space-y-5 px-6 py-8">
        {/* ─── Search + filter ─── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-xl pl-10"
              placeholder="ค้นหาสินค้า..."
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
              <SelectValue>
                {typeFilter === "product"
                  ? "สินค้า"
                  : typeFilter === "service"
                    ? "บริการ"
                    : "ทั้งหมด"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="product">สินค้า</SelectItem>
              <SelectItem value="service">บริการ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ─── Table ─── */}
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title={
              q || typeFilter !== "all"
                ? "ไม่พบผลลัพธ์"
                : "ยังไม่มีข้อมูลสินค้า/บริการ"
            }
            description={
              q || typeFilter !== "all"
                ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง"
                : "เริ่มต้นโดยการเพิ่มสินค้า/บริการรายการแรก"
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
                  เพิ่มสินค้า/บริการ
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
                  <TableHead className="font-medium">
                    ชื่อสินค้า/บริการ
                  </TableHead>
                  <TableHead className="w-24 font-medium">หน่วย</TableHead>
                  <TableHead className="w-32 text-right font-medium">
                    ราคาขาย
                  </TableHead>
                  <TableHead className="w-32 text-right font-medium">
                    ราคาซื้อ
                  </TableHead>
                  <TableHead className="w-28 font-medium">หมวด</TableHead>
                  <TableHead className="w-20 font-medium">VAT</TableHead>
                  <TableHead className="w-20" />
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
                      <div>
                        <p className="font-medium leading-tight">{row.name}</p>
                        {row.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {row.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.unit || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="tabular-nums text-sm font-medium">
                        {fmtPrice(row.salePrice)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="tabular-nums text-sm text-muted-foreground">
                        {row.costPrice ? fmtPrice(row.costPrice) : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ItemTypeBadge type={row.itemType ?? "product"} />
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {row.vatType === "custom"
                          ? `${row.customVatRate ?? 0}%`
                          : (VAT_TYPE_LABELS[row.vatType] ?? "—")}
                      </span>
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
        <CatalogFormModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          editing={editing}
          nextCode={nextCode}
          nextCodeNumber={nextCodeNumber}
          companyId={companyId}
          userId={user.uid}
        />
      )}

      <DeleteDialog
        item={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
