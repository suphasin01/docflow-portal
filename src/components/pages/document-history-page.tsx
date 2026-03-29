"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Copy, Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { SearchFilterToolbar } from "@/components/business/search-filter-toolbar";
import { DataTable } from "@/components/business/data-table";
import { StatusBadge } from "@/components/business/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCompanyStore } from "@/stores/company-store";
import { useDocuments } from "@/hooks/use-workspace-data";
import {
  documentStatusLabels,
  documentTypeLabels,
  getDocumentStatusDisplay,
} from "@/lib/navigation";
import type { BusinessDocument, DocumentType } from "@/types";

type Row = BusinessDocument & { id: string };

export function DocumentHistoryPage() {
  const router = useRouter();
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const { data, loading } = useDocuments(companyId);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return data.filter((d) => {
      const hay = `${d.docNumber} ${d.customerName ?? ""}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (typeFilter !== "all" && d.type !== typeFilter) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      return true;
    });
  }, [data, q, typeFilter, statusFilter]);

  const columns: ColumnDef<Row>[] = useMemo(
    () => [
      {
        accessorKey: "docNumber",
        header: "เลขที่",
        cell: ({ row }) => (
          <Link
            href={`/documents/detail?id=${encodeURIComponent(row.original.id)}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {row.original.docNumber}
          </Link>
        ),
      },
      {
        accessorKey: "type",
        header: "ประเภท",
        cell: ({ row }) =>
          documentTypeLabels[row.original.type] ?? row.original.type,
      },
      {
        accessorKey: "customerName",
        header: "ลูกค้า",
        cell: ({ row }) => row.original.customerName ?? "—",
      },
      { accessorKey: "issueDate", header: "วันที่ออก" },
      {
        accessorKey: "dueDate",
        header: "ครบกำหนด",
        cell: ({ row }) => row.original.dueDate ?? "—",
      },
      {
        accessorKey: "total",
        header: () => <div className="text-right">ยอดรวม</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {row.original.total.toLocaleString("th-TH", {
              minimumFractionDigits: 2,
            })}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "สถานะ",
        cell: ({ row }) => (
          <StatusBadge {...getDocumentStatusDisplay(row.original)} />
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring">
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl">
              <DropdownMenuItem
                onClick={() =>
                  router.push(`/documents/detail?id=${row.original.id}`)
                }
              >
                <Eye className="mr-2 size-4" /> ดู
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  router.push(`/documents/detail?id=${row.original.id}`)
                }
              >
                <Pencil className="mr-2 size-4" /> แก้ไข
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toast.success("คัดลอกฉบับร่างแล้ว (ตัวอย่าง)")}
              >
                <Copy className="mr-2 size-4" /> คัดลอก
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => toast.message("ลบเอกสาร (ตัวอย่าง)")}
              >
                <Trash2 className="mr-2 size-4" /> ลบ
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [router],
  );

  return (
    <div className="min-h-screen">
      <AppHeader
        title="ประวัติเอกสาร"
        subtitle="ค้นหา กรอง และจัดการเอกสารทั้งหมด"
      />
      <div className="space-y-6 px-6 py-8">
        <SearchFilterToolbar
          searchValue={q}
          onSearchChange={setQ}
          searchPlaceholder="ค้นหาเลขที่หรือชื่อลูกค้า…"
          filters={
            <>
              <Select
                value={typeFilter}
                onValueChange={(v) => {
                  if (v) setTypeFilter(v);
                }}
              >
                <SelectTrigger className="h-10 w-[160px] rounded-xl">
                  <SelectValue placeholder="ประเภท" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกประเภท</SelectItem>
                  {(Object.keys(documentTypeLabels) as DocumentType[]).map(
                    (t) => (
                      <SelectItem key={t} value={t}>
                        {documentTypeLabels[t]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  if (v) setStatusFilter(v);
                }}
              >
                <SelectTrigger className="h-10 w-[160px] rounded-xl">
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  {Object.entries(documentStatusLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
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
