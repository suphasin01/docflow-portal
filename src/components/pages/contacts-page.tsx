"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AppHeader } from "@/components/layout/app-header";
import { SearchFilterToolbar } from "@/components/business/search-filter-toolbar";
import { DataTable } from "@/components/business/data-table";
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
import { useCustomers, useDocuments, useVendors } from "@/hooks/use-workspace-data";
import { addCustomer, addVendor } from "@/lib/firebase/catalog-mutations";
import { toast } from "sonner";

type PartyRow = {
  id: string;
  kind: "customer" | "vendor";
  name: string;
  taxId?: string;
  phone?: string;
  email?: string;
  address?: string;
  recent: string;
};

export function ContactsPage() {
  const { user } = useAuth();
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const { data: customers, loading: lc } = useCustomers(companyId);
  const { data: vendors, loading: lv } = useVendors(companyId);
  const { data: docs } = useDocuments(companyId);
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [formKind, setFormKind] = useState<"customer" | "vendor">("customer");
  const [form, setForm] = useState({
    name: "",
    taxId: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
  });

  const rows: PartyRow[] = useMemo(() => {
    const recentFor = (name: string) => {
      const hit = docs.find(
        (d) => d.customerName === name || d.vendorName === name
      );
      return hit
        ? `${hit.docNumber} · ${hit.issueDate}`
        : "ยังไม่มีธุรกรรมล่าสุด";
    };
    const cRows: PartyRow[] = customers.map((c) => ({
      id: c.id,
      kind: "customer" as const,
      name: c.name,
      taxId: c.taxId,
      phone: c.phone,
      email: c.email,
      address: c.address,
      recent: recentFor(c.name),
    }));
    const vRows: PartyRow[] = vendors.map((v) => ({
      id: v.id,
      kind: "vendor" as const,
      name: v.name,
      taxId: v.taxId,
      phone: v.phone,
      email: v.email,
      address: v.address,
      recent: recentFor(v.name),
    }));
    return [...cRows, ...vRows];
  }, [customers, vendors, docs]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const hay = `${r.name} ${r.taxId ?? ""}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (type !== "all" && r.kind !== type) return false;
      return true;
    });
  }, [rows, q, type]);

  const columns: ColumnDef<PartyRow>[] = useMemo(
    () => [
      {
        accessorKey: "kind",
        header: "ประเภท",
        cell: ({ row }) =>
          row.original.kind === "customer" ? "ลูกค้า" : "ผู้ขาย",
      },
      { accessorKey: "name", header: "ชื่อ" },
      { accessorKey: "taxId", header: "เลขประจำตัวผู้เสียภาษี", cell: ({ row }) => row.original.taxId ?? "—" },
      {
        accessorKey: "contact",
        header: "ติดต่อ",
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs text-muted-foreground">
            <div>{row.original.phone ?? "—"}</div>
            <div>{row.original.email ?? ""}</div>
          </div>
        ),
      },
      {
        accessorKey: "address",
        header: "ที่อยู่",
        cell: ({ row }) => row.original.address ?? "—",
      },
      { accessorKey: "recent", header: "ธุรกรรมล่าสุด" },
      {
        id: "actions",
        header: "",
        cell: () => (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-lg"
            onClick={() => toast.message("แก้ไข (ตัวอย่าง)")}
          >
            แก้ไข
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <div className="min-h-screen">
      <AppHeader
        title="ลูกค้า / ผู้ขาย"
        subtitle="จัดการคู่ค้าและดูภาพรวมการทำธุรกรรมล่าสุด"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <Button
              type="button"
              className="rounded-xl"
              onClick={() => setOpen(true)}
            >
              เพิ่มคู่ค้า
            </Button>
            <DialogContent className="rounded-2xl sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>เพิ่มลูกค้า / ผู้ขาย</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="space-y-2">
                  <Label>ประเภท</Label>
                  <Select
                    value={formKind}
                    onValueChange={(v) => {
                      if (v) setFormKind(v as "customer" | "vendor");
                    }}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">ลูกค้า</SelectItem>
                      <SelectItem value="vendor">ผู้ขาย</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                <div className="space-y-2">
                  <Label>เลขประจำตัวผู้เสียภาษี</Label>
                  <Input
                    className="rounded-xl"
                    value={form.taxId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, taxId: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>ชื่อผู้ติดต่อ</Label>
                  <Input
                    className="rounded-xl"
                    value={form.contactName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, contactName: e.target.value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>โทรศัพท์</Label>
                    <Input
                      className="rounded-xl"
                      value={form.phone}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, phone: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>อีเมล</Label>
                    <Input
                      className="rounded-xl"
                      value={form.email}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, email: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>ที่อยู่</Label>
                  <Input
                    className="rounded-xl"
                    value={form.address}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, address: e.target.value }))
                    }
                  />
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
                        const payload = {
                          name: form.name.trim(),
                          taxId: form.taxId || undefined,
                          contactName: form.contactName || undefined,
                          phone: form.phone || undefined,
                          email: form.email || undefined,
                          address: form.address || undefined,
                        };
                        if (formKind === "customer") {
                          await addCustomer({
                            companyId,
                            userId: user.uid,
                            data: payload,
                          });
                        } else {
                          await addVendor({
                            companyId,
                            userId: user.uid,
                            data: payload,
                          });
                        }
                        toast.success("บันทึกคู่ค้าแล้ว");
                        setOpen(false);
                        setForm({
                          name: "",
                          taxId: "",
                          contactName: "",
                          phone: "",
                          email: "",
                          address: "",
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
          searchPlaceholder="ค้นหาชื่อหรือเลขผู้เสียภาษี…"
          filters={
            <Select
              value={type}
              onValueChange={(v) => {
                if (v) setType(v);
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
          }
        />
        {lc || lv ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : (
          <DataTable columns={columns} data={filtered} pageSize={8} />
        )}
      </div>
    </div>
  );
}
