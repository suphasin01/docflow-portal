"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SearchFilterToolbar } from "@/components/business/search-filter-toolbar";
import { StatusBadge } from "@/components/business/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/components/providers/auth-provider";
import { useCompanyStore } from "@/stores/company-store";
import { useCustomers, useDocuments } from "@/hooks/use-workspace-data";
import { markInvoicePaid } from "@/lib/firebase/save-document";
import { paymentStatusLabels } from "@/lib/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

export function PaymentsPage() {
  const { user } = useAuth();
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const { data: documents, loading } = useDocuments(companyId);
  const { data: customers } = useCustomers(companyId);
  const [tab, setTab] = useState<string>("unpaid");
  const [q, setQ] = useState("");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const invoices = useMemo(
    () => documents.filter((d) => d.type === "invoice"),
    [documents]
  );

  const filtered = useMemo(() => {
    return invoices.filter((d) => {
      const ps = d.paymentStatus ?? "unpaid";
      if (tab === "unpaid" && !["unpaid"].includes(ps)) return false;
      if (tab === "partial" && ps !== "partial") return false;
      if (tab === "overdue" && ps !== "overdue") return false;
      const hay = `${d.docNumber} ${d.customerName ?? ""}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (customerFilter !== "all" && d.customerId !== customerFilter)
        return false;
      if (from && (d.dueDate ?? "") < from) return false;
      if (to && (d.dueDate ?? "") > to) return false;
      return true;
    });
  }, [invoices, tab, q, customerFilter, from, to]);

  return (
    <div className="min-h-screen">
      <AppHeader
        title="ติดตามชำระเงิน"
        subtitle="ดูยอดค้างรับ แบ่งตามสถานะ และบันทึกการชำระเงิน"
      />
      <div className="space-y-6 px-6 py-8">
        <div className="grid gap-4 md:grid-cols-3">
          <Summary
            title="ใบแจ้งหนี้ค้างชำระ"
            value={invoices.filter((d) => d.paymentStatus === "unpaid").length}
          />
          <Summary
            title="ชำระบางส่วน"
            value={invoices.filter((d) => d.paymentStatus === "partial").length}
          />
          <Summary
            title="เกินกำหนด"
            value={invoices.filter((d) => d.paymentStatus === "overdue").length}
          />
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            if (v) setTab(v);
          }}
          className="space-y-4"
        >
          <TabsList className="rounded-xl bg-white p-1 shadow-sm">
            <TabsTrigger className="rounded-lg" value="unpaid">
              ค้างชำระ
            </TabsTrigger>
            <TabsTrigger className="rounded-lg" value="partial">
              ชำระบางส่วน
            </TabsTrigger>
            <TabsTrigger className="rounded-lg" value="overdue">
              เกินกำหนด
            </TabsTrigger>
          </TabsList>

          <SearchFilterToolbar
            searchValue={q}
            onSearchChange={setQ}
            searchPlaceholder="ค้นหาเลขที่หรือลูกค้า…"
            filters={
              <>
                <Select
                  value={customerFilter}
                  onValueChange={(v) => {
                    if (v) setCustomerFilter(v);
                  }}
                >
                  <SelectTrigger className="h-10 w-[200px] rounded-xl">
                    <SelectValue placeholder="ลูกค้า" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ลูกค้าทั้งหมด</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  className="h-10 w-[150px] rounded-xl"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
                <Input
                  type="date"
                  className="h-10 w-[150px] rounded-xl"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </>
            }
          />

          <TabsContent value={tab}>
            <Card className="rounded-2xl border-border/80 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  รายการใบแจ้งหนี้
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {loading ? (
                  <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
                ) : (
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="pb-3 font-medium">เลขที่</th>
                        <th className="pb-3 font-medium">ลูกค้า</th>
                        <th className="pb-3 font-medium">ครบกำหนด</th>
                        <th className="pb-3 font-medium text-right">
                          ยอดคงค้าง
                        </th>
                        <th className="pb-3 font-medium">สถานะ</th>
                        <th className="pb-3 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-10 text-center text-muted-foreground"
                          >
                            ไม่พบรายการในช่วงนี้
                          </td>
                        </tr>
                      ) : (
                        filtered.map((d) => (
                          <tr key={d.id} className="border-b border-border/60">
                            <td className="py-3 font-medium">{d.docNumber}</td>
                            <td className="py-3 text-muted-foreground">
                              {d.customerName ?? "—"}
                            </td>
                            <td className="py-3">{d.dueDate ?? "—"}</td>
                            <td className="py-3 text-right tabular-nums font-medium">
                              {d.total.toLocaleString("th-TH", {
                                minimumFractionDigits: 2,
                              })}{" "}
                              ฿
                            </td>
                            <td className="py-3">
                              <StatusBadge
                                status={d.paymentStatus ?? "unpaid"}
                                label={
                                  paymentStatusLabels[
                                    d.paymentStatus ?? "unpaid"
                                  ]
                                }
                              />
                            </td>
                            <td className="py-3 text-right">
                              <Button
                                type="button"
                                size="sm"
                                className="rounded-lg"
                                disabled={!companyId || !user}
                                onClick={() => {
                                  if (!companyId || !user) return;
                                  void (async () => {
                                    try {
                                      await markInvoicePaid({
                                        companyId,
                                        userId: user.uid,
                                        documentId: d.id,
                                        docNumber: d.docNumber,
                                        amount: d.total,
                                      });
                                      toast.success("บันทึกชำระเงินแล้ว");
                                    } catch (e) {
                                      console.error(e);
                                      toast.error("บันทึกไม่สำเร็จ");
                                    }
                                  })();
                                }}
                              >
                                ทำเครื่องหมายชำระ
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Summary({ title, value }: { title: string; value: number }) {
  return (
    <Card className="rounded-2xl border-border/80 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
