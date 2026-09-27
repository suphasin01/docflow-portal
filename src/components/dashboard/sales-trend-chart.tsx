"use client";

import { useId } from "react";
import { useReducedMotion } from "motion/react";
import { Card } from "@heroui/react";
import { ChartTooltip } from "@heroui-pro/react";
import { AreaChart } from "@heroui-pro/react/area-chart";
import { fmtBaht, type DashboardFlowFilter } from "@/lib/dashboard/dashboard-analytics";

type Point = { key: string; label: string; amount: number };

export function SalesTrendChart({ data, flow }: { data: Point[]; flow: DashboardFlowFilter }) {
  const gradientId = useId().replace(/:/g, "");
  const reduceMotion = useReducedMotion();
  const empty = data.every((point) => point.amount === 0);
  const title = `มูลค่าเอกสาร${flow === "income" ? "รายรับ" : "รายจ่าย"} 6 เดือน`;

  return (
    <Card className="glass-surface h-full min-w-0">
      <Card.Header>
        <Card.Title className="text-base">{title}</Card.Title>
        <Card.Description>ย้อนหลัง 6 เดือน · ตามประเภทเอกสารที่เลือก</Card.Description>
      </Card.Header>
      <Card.Content className="min-w-0">
        <AreaChart data={data} height={260} aria-label={title}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <AreaChart.Grid vertical={false} stroke="var(--separator)" strokeDasharray="3 5" />
          <AreaChart.XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={18} tickMargin={10} />
          <AreaChart.YAxis width={48} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false}
            domain={empty ? [0, 1] : [0, "auto"]}
            ticks={empty ? [0] : undefined}
            tickFormatter={(value: number) => new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 }).format(value)} />
          <AreaChart.Area dataKey="amount" name="มูลค่าเอกสาร" type="monotone" stroke="var(--accent)" strokeWidth={2.5} fill={`url(#${gradientId})`} dot={false}
            isAnimationActive={reduceMotion === false} animationDuration={600} />
          <AreaChart.Tooltip content={({ active, label, payload }) => {
            if (!active || !payload?.length) return null;
            return <ChartTooltip><ChartTooltip.Header>{label}</ChartTooltip.Header><ChartTooltip.Item>
              <ChartTooltip.Indicator color="var(--accent)" /><ChartTooltip.Label>มูลค่าเอกสาร</ChartTooltip.Label>
              <ChartTooltip.Value>{fmtBaht(Number(payload[0].value ?? 0))}</ChartTooltip.Value>
            </ChartTooltip.Item></ChartTooltip>;
          }} />
        </AreaChart>
        <p className="mt-3 text-xs text-muted">{empty ? "ยังไม่มีมูลค่าเอกสารในช่วง 6 เดือนนี้" : "ยอดรวมตามวันที่ออกเอกสาร ไม่ใช่ยอดเงินสดรับ–จ่าย"}</p>
        <details className="mt-2 text-xs text-muted">
          <summary className="w-fit cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-focus">ดูข้อมูลรายเดือน</summary>
          <table className="mt-2 w-full text-left tabular-nums"><caption className="sr-only">{title}</caption>
            <thead><tr><th scope="col">เดือน</th><th scope="col" className="text-right">มูลค่า</th></tr></thead>
            <tbody>{data.map((point) => <tr key={point.key}><th scope="row" className="py-1 font-normal">{point.label}</th><td className="text-right">{fmtBaht(point.amount)}</td></tr>)}</tbody>
          </table>
        </details>
      </Card.Content>
    </Card>
  );
}
