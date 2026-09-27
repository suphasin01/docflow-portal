"use client";

import {
  AlertCircle,
  Banknote,
  FileText,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardKpis, DashboardFlowFilter } from "@/lib/dashboard/dashboard-analytics";
import { fmtBaht } from "@/lib/dashboard/dashboard-analytics";
import { cn } from "@/lib/utils";

type Props = {
  kpis: DashboardKpis;
  periodHint: string;
  flow: DashboardFlowFilter;
};

export function DashboardKpiCards({ kpis, periodHint, flow }: Props) {
  const cards = [
    {
      title: flow === "income" ? "มูลค่าเอกสารรายรับ" : "มูลค่าเอกสารรายจ่าย",
      value: fmtBaht(kpis.salesTotal),
      sub: periodHint,
      icon: TrendingUp,
      iconBg: "bg-accent-soft text-accent-soft-foreground",
      valueClass: "text-foreground",
    },
    {
      title: "ชำระแล้ว",
      value: fmtBaht(kpis.paidTotal),
      sub: periodHint,
      icon: Banknote,
      iconBg: "bg-success-soft text-success-soft-foreground",
      valueClass: "text-success",
    },
    {
      title: "ค้างชำระ",
      value: fmtBaht(kpis.outstandingTotal),
      sub: periodHint,
      icon: AlertCircle,
      iconBg: "bg-danger-soft text-danger-soft-foreground",
      valueClass: "text-danger",
    },
    {
      title: "เอกสารทั้งหมด",
      value: String(kpis.documentCount),
      sub: "ฉบับ · " + periodHint,
      icon: FileText,
      iconBg: "bg-surface-secondary text-muted",
      valueClass: "text-foreground",
    },
  ];

  return (
    <div className="dashboard-metrics grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <Card
          key={c.title}
          className="glass-surface rounded-2xl border-border/80"
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  {c.title}
                </p>
                <p
                  className={cn(
                    "truncate text-2xl font-bold tabular-nums tracking-tight",
                    c.valueClass,
                  )}
                >
                  {c.value}
                </p>
                <p className="text-xs text-muted-foreground">{c.sub}</p>
              </div>
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl",
                  c.iconBg,
                )}
              >
                <c.icon className="size-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
