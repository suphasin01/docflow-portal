"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/business/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UnpaidRow } from "@/lib/dashboard/dashboard-analytics";
import { fmtBaht } from "@/lib/dashboard/dashboard-analytics";
import { documentTypeLabels } from "@/lib/navigation";

type Props = {
  rows: UnpaidRow[];
};

export function UnpaidDocumentsCard({ rows }: Props) {
  return (
    <Card className="rounded-2xl border-border/80 bg-white shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base font-semibold">เอกสารค้างชำระ</CardTitle>
        <Link
          href="/payments"
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-primary hover:underline"
        >
          ดูทั้งหมด
          <ChevronRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            ยังไม่มีข้อมูลในช่วงเวลานี้
          </p>
        ) : (
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-slate-50/80 text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">เลขที่</th>
                <th className="px-4 py-3 font-medium">ประเภท</th>
                <th className="px-4 py-3 font-medium">วันที่</th>
                <th className="px-4 py-3 text-right font-medium">ยอด</th>
                <th className="px-4 py-3 font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/documents/detail?id=${encodeURIComponent(r.id)}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {r.docNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {documentTypeLabels[r.type] ?? r.type}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                    {r.issueDate}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                    {fmtBaht(r.total)}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={r.paymentKey} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
