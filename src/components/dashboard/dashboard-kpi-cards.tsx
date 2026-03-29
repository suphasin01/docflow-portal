"use client";

import {
  AlertCircle,
  Banknote,
  FileText,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardKpis } from "@/lib/dashboard/dashboard-analytics";
import { fmtBaht } from "@/lib/dashboard/dashboard-analytics";
import { cn } from "@/lib/utils";

type Props = {
  kpis: DashboardKpis;
  periodHint: string;
};

export function DashboardKpiCards({ kpis, periodHint }: Props) {
  const cards = [
    {
      title: "ยอดขาย",
      value: fmtBaht(kpis.salesTotal),
      sub: periodHint,
      icon: TrendingUp,
      iconBg: "bg-sky-50 text-sky-700",
      valueClass: "text-foreground",
    },
    {
      title: "ชำระแล้ว",
      value: fmtBaht(kpis.paidTotal),
      sub: periodHint,
      icon: Banknote,
      iconBg: "bg-emerald-50 text-emerald-700",
      valueClass: "text-emerald-700",
    },
    {
      title: "ค้างชำระ",
      value: fmtBaht(kpis.outstandingTotal),
      sub: periodHint,
      icon: AlertCircle,
      iconBg: "bg-red-50 text-red-700",
      valueClass: "text-red-600",
    },
    {
      title: "เอกสารทั้งหมด",
      value: String(kpis.documentCount),
      sub: "ฉบับ · " + periodHint,
      icon: FileText,
      iconBg: "bg-violet-50 text-violet-800",
      valueClass: "text-foreground",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <Card
          key={c.title}
          className="rounded-2xl border-border/80 bg-white shadow-sm transition-shadow hover:shadow-md"
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
