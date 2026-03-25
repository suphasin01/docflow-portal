"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompanyStore } from "@/stores/company-store";
import {
  useCustomers,
  useDocuments,
  usePayments,
  useProducts,
} from "@/hooks/use-workspace-data";
import { documentTypeLabels, paymentStatusLabels } from "@/lib/navigation";

const COLORS = ["#2563eb", "#0ea5e9", "#6366f1", "#22c55e", "#f97316"];

export function ReportsPage() {
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const { data: documents } = useDocuments(companyId);
  const { data: payments } = usePayments(companyId);
  const { data: customers } = useCustomers(companyId);
  const { data: products } = useProducts(companyId);

  const salesByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payments) {
      const m = (p.paidAt ?? "").slice(0, 7);
      if (!m) continue;
      map.set(m, (map.get(m) ?? 0) + p.amount);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }));
  }, [payments]);

  const topCustomers = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of documents) {
      if (d.type !== "invoice") continue;
      const name = d.customerName ?? "ไม่ระบุ";
      map.set(name, (map.get(name) ?? 0) + d.total);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  }, [documents]);

  const topProducts = useMemo(() => {
    return products.slice(0, 5).map((p) => ({
      name: p.name,
      value: p.defaultPrice,
    }));
  }, [products]);

  const paymentBreakdown = useMemo(() => {
    const inv = documents.filter((d) => d.type === "invoice");
    const count = (s: string) =>
      inv.filter((d) => (d.paymentStatus ?? "unpaid") === s).length;
    return [
      { name: paymentStatusLabels.paid, value: count("paid") },
      { name: paymentStatusLabels.unpaid, value: count("unpaid") },
      { name: paymentStatusLabels.partial, value: count("partial") },
      { name: paymentStatusLabels.overdue, value: count("overdue") },
    ];
  }, [documents]);

  const docTypeSummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of documents) {
      const label = documentTypeLabels[d.type] ?? d.type;
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [documents]);

  return (
    <div className="min-h-screen">
      <AppHeader
        title="รายงาน"
        subtitle="วิเคราะห์ยอดขาย ลูกค้า และสถานะเอกสาร"
      />
      <div className="grid gap-6 px-6 py-8 lg:grid-cols-2">
        <Card className="rounded-2xl border-border/80 bg-white shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              ยอดขายตามเดือน (จากการชำระเงิน)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="ยอดชำระ" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              ลูกค้ายอดขายสูงสุด
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCustomers} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip />
                <Bar dataKey="value" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              สินค้า/บริการ (ราคาเริ่มต้น)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              สรุปสถานะชำระเงิน
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentBreakdown}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {paymentBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              จำนวนเอกสารแต่ละประเภท
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={docTypeSummary}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" name="จำนวน" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-white shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              ข้อมูลอ้างอิง
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="rounded-xl bg-[#f8f9fb] p-4">
              <p className="text-xs font-medium text-foreground">ลูกค้าในระบบ</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                {customers.length}
              </p>
            </div>
            <div className="rounded-xl bg-[#f8f9fb] p-4">
              <p className="text-xs font-medium text-foreground">สินค้า/บริการ</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                {products.length}
              </p>
            </div>
            <div className="rounded-xl bg-[#f8f9fb] p-4">
              <p className="text-xs font-medium text-foreground">เอกสารทั้งหมด</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                {documents.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
