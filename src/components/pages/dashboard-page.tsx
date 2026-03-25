"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppHeader } from "@/components/layout/app-header";
import { SummaryStatCard } from "@/components/business/summary-stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { useCompanyStore } from "@/stores/company-store";
import { useDashboardStats } from "@/hooks/use-workspace-data";
import { seedDemoData } from "@/lib/data/seed-demo";
import { documentTypeLabels, paymentStatusLabels } from "@/lib/navigation";
import { StatusBadge } from "@/components/business/status-badge";
import { toast } from "sonner";
import {
  FileText,
  AlertTriangle,
  Banknote,
  CircleDollarSign,
} from "lucide-react";

function fmtMoney(n: number) {
  return `${n.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const { stats, recentDocuments, loading } = useDashboardStats(companyId);
  const chartData = useMemo(() => {
    return stats.monthlyRevenue.map((m) => ({
      name: m.month,
      รายได้: m.amount,
    }));
  }, [stats.monthlyRevenue]);

  return (
    <div className="min-h-screen">
      <AppHeader
        title="แดชบอร์ด"
        subtitle="สรุปภาพรวมเอกสารและการเงิน"
        actions={
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={!companyId || !user}
            onClick={() => {
              if (!companyId || !user) return;
              void (async () => {
                try {
                  await seedDemoData({ companyId, userId: user.uid });
                  toast.success("โหลดข้อมูลตัวอย่างแล้ว");
                } catch (e) {
                  console.error(e);
                  toast.error("ไม่สามารถโหลดข้อมูลตัวอย่างได้");
                }
              })();
            }}
          >
            โหลดข้อมูลตัวอย่าง
          </Button>
        }
      />
      <div className="space-y-6 px-6 py-8">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryStatCard
              title="เอกสารทั้งหมด"
              value={String(stats.totalDocuments)}
              hint="รวมทุกประเภทในระบบ"
              icon={FileText}
            />
            <SummaryStatCard
              title="ยอดค้างรับ"
              value={fmtMoney(stats.unpaidAmount)}
              hint="ใบแจ้งหนี้ที่ยังไม่ชำระครบ"
              icon={AlertTriangle}
            />
            <SummaryStatCard
              title="ยอดรับแล้ว"
              value={fmtMoney(stats.paidAmount)}
              hint="จากใบแจ้งหนี้ที่ชำระแล้ว"
              icon={Banknote}
            />
            <SummaryStatCard
              title="ยอดเกินกำหนด"
              value={fmtMoney(stats.overdueAmount)}
              hint="ต้องติดตามเร่งด่วน"
              icon={CircleDollarSign}
            />
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="rounded-2xl border-border/80 bg-white shadow-sm xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                รายได้จากการชำระเงินรายเดือน
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              {chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  ยังไม่มีข้อมูลการชำระเงิน — ลองกด “โหลดข้อมูลตัวอย่าง”
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="รายได้" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/80 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                สถานะการชำระเงิน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row
                label={paymentStatusLabels.paid}
                value={stats.paymentBreakdown.paid}
              />
              <Row
                label={paymentStatusLabels.unpaid}
                value={stats.paymentBreakdown.unpaid}
              />
              <Row
                label={paymentStatusLabels.partial}
                value={stats.paymentBreakdown.partial}
              />
              <Row
                label={paymentStatusLabels.overdue}
                value={stats.paymentBreakdown.overdue}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/80 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">
              เอกสารล่าสุด
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="pb-3 font-medium">เลขที่</th>
                  <th className="pb-3 font-medium">ประเภท</th>
                  <th className="pb-3 font-medium">ลูกค้า</th>
                  <th className="pb-3 font-medium">วันที่</th>
                  <th className="pb-3 font-medium text-right">ยอดรวม</th>
                  <th className="pb-3 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {recentDocuments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-10 text-center text-muted-foreground"
                    >
                      ยังไม่มีเอกสาร
                    </td>
                  </tr>
                ) : (
                  recentDocuments.map((d) => (
                    <tr key={d.id} className="border-b border-border/60">
                      <td className="py-3 font-medium">{d.docNumber}</td>
                      <td className="py-3">
                        {documentTypeLabels[d.type] ?? d.type}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {d.customerName ?? "—"}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {d.issueDate}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {fmtMoney(d.total)}
                      </td>
                      <td className="py-3">
                        <StatusBadge
                          status={d.paymentStatus ?? d.status}
                          label={
                            paymentStatusLabels[d.paymentStatus ?? ""] ??
                            documentStatusLabel(d.status)
                          }
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[#f8f9fb] px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function documentStatusLabel(s: string) {
  const map: Record<string, string> = {
    draft: "ฉบับร่าง",
    issued: "ออกแล้ว",
    paid: "ชำระแล้ว",
    partial: "ชำระบางส่วน",
    overdue: "เกินกำหนด",
    cancelled: "ยกเลิก",
  };
  return map[s] ?? s;
}
