"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TopPartnerRow } from "@/lib/dashboard/dashboard-analytics";
import { fmtBaht } from "@/lib/dashboard/dashboard-analytics";
import { cn } from "@/lib/utils";

type Props = {
  rows: TopPartnerRow[];
  title?: string;
};

export function TopCustomersCard({
  rows,
  title = "ลูกค้ายอดนิยม",
}: Props) {
  return (
    <Card className="glass-surface h-full min-w-0 rounded-2xl border-border/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            ยังไม่มีข้อมูลในช่วงเวลานี้
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li
                key={`${r.rank}-${r.name}`}
                className="flex items-center gap-3 rounded-xl bg-surface-secondary px-3 py-2.5"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    r.rank <= 3
                      ? "bg-accent text-accent-foreground"
                      : "bg-surface-secondary text-muted-foreground",
                  )}
                >
                  {r.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {r.name}
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {fmtBaht(r.amount)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
