"use client";

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type RowSelectionState,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DataTableProps<T extends { id: string }> = {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  pageSize?: number;
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
};

export function DataTable<T extends { id: string }>({
  columns,
  data,
  pageSize = 10,
  enableRowSelection = false,
  rowSelection,
  onRowSelectionChange,
}: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    getRowId: (row) => row.id,
    ...(enableRowSelection
      ? {
          enableRowSelection: true,
          onRowSelectionChange,
          state: { rowSelection: rowSelection ?? {} },
        }
      : { enableRowSelection: false }),
  });

  return (
    <div className="min-w-0 space-y-3">
      <div className="glass-panel overflow-hidden">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-surface-secondary shadow-[0_1px_0_0_hsl(var(--border))]">
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
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="transition-colors hover:bg-surface-secondary"
                  data-state={row.getIsSelected() ? "selected" : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="align-middle text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  ไม่พบข้อมูล
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          หน้า {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={!table.getCanPreviousPage()}
            aria-label="หน้าก่อนหน้า"
            onClick={() => table.previousPage()}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={!table.getCanNextPage()}
            aria-label="หน้าถัดไป"
            onClick={() => table.nextPage()}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
