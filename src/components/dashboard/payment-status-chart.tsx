"use client";

import { Card } from "@heroui/react";
import { ChartTooltip } from "@heroui-pro/react";
import { PieChart } from "@heroui-pro/react/pie-chart";
import { useReducedMotion } from "motion/react";
import type { PaymentDistribution } from "@/lib/dashboard/dashboard-analytics";

export function PaymentStatusChart({ data }: { data: PaymentDistribution[] }) {
  const reduceMotion = useReducedMotion();
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  const nonEmpty = data.filter((entry) => entry.value > 0);

  return (
    <Card className="glass-surface h-full min-w-0">
      <Card.Header>
        <Card.Title className="text-base">สถานะชำระเงิน</Card.Title>
        <Card.Description>จำนวนเอกสารที่ติดตามการชำระ · ตามตัวกรอง</Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="relative mx-auto w-full max-w-64">
          {total > 0 ? <PieChart height={220} aria-label="สัดส่วนจำนวนเอกสารตามสถานะชำระเงิน">
            <PieChart.Pie data={nonEmpty} dataKey="value" nameKey="name" innerRadius="72%" outerRadius="90%" paddingAngle={nonEmpty.length > 1 ? 4 : 0} cornerRadius={5} strokeWidth={0}
              isAnimationActive={reduceMotion === false} animationDuration={600}>
              {nonEmpty.map((entry) => <PieChart.Cell key={entry.key} fill={entry.fill} />)}
            </PieChart.Pie>
            <PieChart.Tooltip content={({ active, payload }) => {
              const entry = payload?.[0];
              if (!active || !entry) return null;
              return <ChartTooltip><ChartTooltip.Item><ChartTooltip.Label>{entry.name}</ChartTooltip.Label><ChartTooltip.Value>{Number(entry.value).toLocaleString("th-TH")} ฉบับ</ChartTooltip.Value></ChartTooltip.Item></ChartTooltip>;
            }} />
          </PieChart> : <div aria-hidden="true" className="flex h-[220px] items-center justify-center"><div className="size-44 rounded-full border-[18px] border-surface-secondary" /></div>}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-semibold tabular-nums">{total.toLocaleString("th-TH")}</span><span className="text-xs text-muted">{total ? "ฉบับ" : "ยังไม่มีเอกสาร"}</span>
          </div>
        </div>
        <ul className="mt-3 space-y-2.5 text-sm">
          {data.map((entry) => <li key={entry.key} className="flex items-center gap-2.5"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.fill }} /><span className="flex-1 text-muted">{entry.name}</span><span className="tabular-nums">{entry.value.toLocaleString("th-TH")} <span className="text-xs text-muted">ฉบับ</span></span></li>)}
        </ul>
      </Card.Content>
    </Card>
  );
}
