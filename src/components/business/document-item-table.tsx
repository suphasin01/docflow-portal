"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  calculateLineTotal,
  createEmptyItemRow,
  type DocumentItemRow,
} from "@/lib/document-item-utils";

type DocumentItemTableProps = {
  rows: DocumentItemRow[];
  onChange: (rows: DocumentItemRow[]) => void;
};

export function DocumentItemTable({ rows, onChange }: DocumentItemTableProps) {
  const columns: ColumnDef<DocumentItemRow>[] = [
    {
      id: "line",
      header: "#",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.index + 1}</span>
      ),
      size: 40,
    },
    {
      accessorKey: "description",
      header: "รายการ",
      cell: ({ row }) => (
        <Input
          value={row.original.description}
          onChange={(e) =>
            updateRow(row.original.id, { description: e.target.value })
          }
          className="h-9 min-w-[200px] rounded-lg border-border/80"
          placeholder="ระบุรายการสินค้า/บริการ"
        />
      ),
    },
    {
      accessorKey: "quantity",
      header: "จำนวน",
      cell: ({ row }) => (
        <Input
          type="number"
          step="0.01"
          value={row.original.quantity}
          onChange={(e) =>
            updateRow(row.original.id, {
              quantity: Number(e.target.value) || 0,
            })
          }
          className="h-9 w-24 rounded-lg border-border/80"
        />
      ),
    },
    {
      accessorKey: "unitPrice",
      header: "ราคา/หน่วย",
      cell: ({ row }) => (
        <Input
          type="number"
          step="0.01"
          value={row.original.unitPrice}
          onChange={(e) =>
            updateRow(row.original.id, {
              unitPrice: Number(e.target.value) || 0,
            })
          }
          className="h-9 w-28 rounded-lg border-border/80"
        />
      ),
    },
    {
      accessorKey: "discountAmount",
      header: "ส่วนลด",
      cell: ({ row }) => (
        <Input
          type="number"
          step="0.01"
          value={row.original.discountAmount}
          onChange={(e) =>
            updateRow(row.original.id, {
              discountAmount: Number(e.target.value) || 0,
            })
          }
          className="h-9 w-24 rounded-lg border-border/80"
        />
      ),
    },
    {
      accessorKey: "vatRate",
      header: "VAT %",
      cell: ({ row }) => (
        <Input
          type="number"
          step="0.01"
          value={row.original.vatRate}
          onChange={(e) =>
            updateRow(row.original.id, {
              vatRate: Number(e.target.value) || 0,
            })
          }
          className="h-9 w-20 rounded-lg border-border/80"
        />
      ),
    },
    {
      id: "lineTotal",
      header: "รวม",
      cell: ({ row }) => (
        <span className="text-sm font-medium tabular-nums">
          {row.original.lineTotal.toLocaleString("th-TH", {
            minimumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-lg text-muted-foreground hover:text-destructive"
          onClick={() => removeRow(row.original.id)}
          aria-label="ลบแถว"
        >
          <Trash2 className="size-4" />
        </Button>
      ),
    },
  ];

  function updateRow(id: string, patch: Partial<DocumentItemRow>) {
    onChange(
      rows.map((r) =>
        r.id === id
          ? {
              ...r,
              ...patch,
              lineTotal: calculateLineTotal({ ...r, ...patch }),
            }
          : r
      )
    );
  }

  function removeRow(id: string) {
    if (rows.length <= 1) return;
    onChange(rows.filter((r) => r.id !== id));
  }

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => (
                  <TableHead
                    key={h.id}
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-muted/30">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button
        type="button"
        variant="outline"
        className="rounded-xl border-dashed"
        onClick={() => onChange([...rows, createEmptyItemRow()])}
      >
        <Plus className="mr-2 size-4" />
        เพิ่มรายการ
      </Button>
    </div>
  );
}
