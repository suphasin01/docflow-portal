"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/business/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PendingWorkflowRow } from "@/lib/dashboard/dashboard-analytics";
import { fmtBaht } from "@/lib/dashboard/dashboard-analytics";
import { documentTypeLabels } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type Props = {
  rows: PendingWorkflowRow[];
};

export function PendingWorkflowCard({ rows }: Props) {
  return (
    <Card className="glass-surface rounded-2xl border-border/80">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base font-semibold">
          เอกสารรอดำเนินการ
        </CardTitle>
        <Link
          href="/documents/history"
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-primary hover:underline"
        >
          ดูทั้งหมด
          <ChevronRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            ยังไม่มีข้อมูลในช่วงเวลานี้
          </p>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-3 rounded-xl border border-border/70 bg-surface-secondary px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Link
                  href={`/documents/detail?id=${encodeURIComponent(r.id)}`}
                  className="font-semibold tabular-nums text-primary hover:underline"
                >
                  {r.docNumber}
                </Link>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-md border-sky-200 bg-sky-50 text-xs font-medium text-sky-900",
                  )}
                >
                  {documentTypeLabels[r.type] ?? r.type}
                </Badge>
                <span className="tabular-nums text-sm text-foreground">
                  {fmtBaht(r.total)}
                </span>
                {r.paymentKey !== "na" ? (
                  <StatusBadge status={r.paymentKey} label={r.paymentLabel} />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
              <p className="shrink-0 text-sm text-muted-foreground sm:text-right">
                <span className="text-foreground">ถัดไป:</span>{" "}
                <span className="font-medium text-foreground">{r.nextLabel}</span>
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
