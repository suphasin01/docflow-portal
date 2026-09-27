"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtBaht } from "@/lib/dashboard/dashboard-analytics";

type Point = { key: string; label: string; amount: number };

type Props = {
  data: Point[];
};

export function SalesTrendChart({ data }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    ยอด: d.amount,
  }));

  return (
    <Card className="glass-surface rounded-2xl border-border/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          แนวโน้มยอดขาย 6 เดือน
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        {chartData.every((d) => d.amount === 0) ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            ยังไม่มีข้อมูลในช่วงเวลานี้
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="dashFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  Number(v).toLocaleString("th-TH", { maximumFractionDigits: 0 })
                }
              />
              <Tooltip
                formatter={(value) =>
                  typeof value === "number" ? fmtBaht(value) : String(value ?? "")
                }
                labelFormatter={(_, payload) =>
                  String(
                    (payload?.[0]?.payload as { label?: string } | undefined)
                      ?.label ?? "",
                  )
                }
              />
              <Area
                type="monotone"
                dataKey="ยอด"
                stroke="#2563eb"
                strokeWidth={2}
                fill="url(#dashFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
