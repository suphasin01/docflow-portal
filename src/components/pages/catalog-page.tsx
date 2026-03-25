"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AppHeader } from "@/components/layout/app-header";
import { SearchFilterToolbar } from "@/components/business/search-filter-toolbar";
import { DataTable } from "@/components/business/data-table";
import { StatusBadge } from "@/components/business/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/components/providers/auth-provider";
import { useCompanyStore } from "@/stores/company-store";
import { useProducts } from "@/hooks/use-workspace-data";
import { addProduct, archiveProduct } from "@/lib/firebase/catalog-mutations";
import { toast } from "sonner";
import type { Product, VatType } from "@/types";

type Row = Product & { id: string };

const vatLabels: Record<VatType, string> = {
  inclusive: "รวม VAT",
  exclusive: "แยก VAT",
  zero: "0%",
  exempt: "ยกเว้น",
};

export function CatalogPage() {
  const { user } = useAuth();
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const { data, loading } = useProducts(companyId);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "",
    unit: "หน่วย",
    defaultPrice: 0,
    cost: 0,
    vatType: "exclusive" as VatType,
  });

  const filtered = useMemo(() => {
    return data.filter((p) => {
      const hay = `${p.name} ${p.sku ?? ""}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (cat === "active" && !p.active) return false;
      if (cat === "inactive" && p.active) return false;
      return true;
    });
  }, [data, q, cat]);

  const columns: ColumnDef<Row>[] = useMemo(
    () => [
      { accessorKey: "name", header: "ชื่อสินค้า/บริการ" },
      { accessorKey: "sku", header: "SKU", cell: ({ row }) => row.original.sku ?? "—" },
      {
        accessorKey: "category",
        header: "หมวดหมู่",
        cell: ({ row }) => row.original.category ?? "—",
      },
      { accessorKey: "unit", header: "หน่วย" },
      {
        accessorKey: "defaultPrice",
        header: () => <div className="text-right">ราคาเริ่มต้น</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {row.original.defaultPrice.toLocaleString("th-TH", {
              minimumFractionDigits: 2,
            })}
          </div>
        ),
      },
      {
        accessorKey: "cost",
        header: () => <div className="text-right">ต้นทุน</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {(row.original.cost ?? 0).toLocaleString("th-TH", {
              minimumFractionDigits: 2,
            })}
          </div>
        ),
      },
      {
        accessorKey: "vatType",
        header: "VAT",
        cell: ({ row }) => vatLabels[row.original.vatType],
      },
      {
        accessorKey: "active",
        header: "สถานะ",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.active ? "active" : "inactive"}
          />
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-lg"
              onClick={() => toast.message("แก้ไขสินค้า (ตัวอย่าง)")}
            >
              แก้ไข
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="rounded-lg"
              disabled={!companyId}
              onClick={() => {
                void (async () => {
                  try {
                    await archiveProduct({ productId: row.original.id });
                    toast.success("เก็บถาวรรายการแล้ว");
                  } catch (e) {
                    console.error(e);
                    toast.error("ดำเนินการไม่สำเร็จ");
                  }
                })();
              }}
            >
              เก็บถาวร
            </Button>
          </div>
        ),
      },
    ],
    [companyId]
  );

  return (
    <div className="min-h-screen">
      <AppHeader
        title="สินค้า / บริการ"
        subtitle="จัดการแคตตาล็อกราคาและภาษีมูลค่าเพิ่ม"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <Button
              type="button"
              className="rounded-xl"
              onClick={() => setOpen(true)}
            >
              เพิ่มสินค้า/บริการ
            </Button>
            <DialogContent className="rounded-2xl sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>เพิ่มสินค้า / บริการ</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="space-y-2">
                  <Label>ชื่อ</Label>
                  <Input
                    className="rounded-xl"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>SKU</Label>
                    <Input
                      className="rounded-xl"
                      value={form.sku}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, sku: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>หน่วย</Label>
                    <Input
                      className="rounded-xl"
                      value={form.unit}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, unit: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>หมวดหมู่</Label>
                  <Input
                    className="rounded-xl"
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>ราคาเริ่มต้น</Label>
                    <Input
                      type="number"
                      className="rounded-xl"
                      value={form.defaultPrice}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          defaultPrice: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ต้นทุน</Label>
                    <Input
                      type="number"
                      className="rounded-xl"
                      value={form.cost}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, cost: Number(e.target.value) }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>ประเภท VAT</Label>
                  <Select
                    value={form.vatType}
                    onValueChange={(v) => {
                      if (v)
                        setForm((f) => ({ ...f, vatType: v as VatType }));
                    }}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(vatLabels) as VatType[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {vatLabels[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  className="rounded-xl"
                  disabled={!companyId || !user || !form.name.trim()}
                  onClick={() => {
                    if (!companyId || !user) return;
                    void (async () => {
                      try {
                        await addProduct({
                          companyId,
                          userId: user.uid,
                          data: {
                            name: form.name.trim(),
                            sku: form.sku || undefined,
                            category: form.category || undefined,
                            unit: form.unit,
                            defaultPrice: form.defaultPrice,
                            cost: form.cost,
                            vatType: form.vatType,
                          },
                        });
                        toast.success("บันทึกสินค้า/บริการแล้ว");
                        setOpen(false);
                        setForm({
                          name: "",
                          sku: "",
                          category: "",
                          unit: "หน่วย",
                          defaultPrice: 0,
                          cost: 0,
                          vatType: "exclusive",
                        });
                      } catch (e) {
                        console.error(e);
                        toast.error("บันทึกไม่สำเร็จ");
                      }
                    })();
                  }}
                >
                  บันทึก
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="space-y-6 px-6 py-8">
        <SearchFilterToolbar
          searchValue={q}
          onSearchChange={setQ}
          searchPlaceholder="ค้นหาชื่อหรือ SKU…"
          filters={
            <Select
              value={cat}
              onValueChange={(v) => {
                if (v) setCat(v);
              }}
            >
              <SelectTrigger className="h-10 w-[160px] rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="active">ใช้งาน</SelectItem>
                <SelectItem value="inactive">ไม่ใช้งาน</SelectItem>
              </SelectContent>
            </Select>
          }
        />
        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : (
          <DataTable columns={columns} data={filtered} pageSize={8} />
        )}
      </div>
    </div>
  );
}
