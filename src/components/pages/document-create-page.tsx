"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DocumentItemTable } from "@/components/business/document-item-table";
import { PaymentSummaryCard } from "@/components/business/payment-summary-card";
import { useAuth } from "@/components/providers/auth-provider";
import { useCompanyStore } from "@/stores/company-store";
import { useCustomers } from "@/hooks/use-workspace-data";
import { documentTypeLabels } from "@/lib/navigation";
import {
  createEmptyItemRow,
  summarizeItems,
  type DocumentItemRow,
} from "@/lib/document-item-utils";
import { saveBusinessDocument } from "@/lib/firebase/save-document";
import type { DocumentType } from "@/types";

const types: DocumentType[] = [
  "quotation",
  "invoice",
  "receipt",
  "purchase_order",
  "billing_note",
];

export function DocumentCreatePage() {
  const { user } = useAuth();
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const { data: customers } = useCustomers(companyId);
  const [docType, setDocType] = useState<DocumentType>("invoice");
  const [customerId, setCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [issueDate, setIssueDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<DocumentItemRow[]>([createEmptyItemRow()]);
  const [busy, setBusy] = useState(false);

  const summary = useMemo(() => summarizeItems(rows), [rows]);

  function applyCustomer(id: string) {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    setCustomerName(c?.name ?? "");
  }

  async function onSave(asDraft: boolean) {
    if (!companyId || !user) {
      toast.error("ยังไม่พร้อมบันทึก");
      return;
    }
    if (!customerName.trim()) {
      toast.error("เลือกหรือระบุชื่อลูกค้า/คู่ค้า");
      return;
    }
    const invalid = rows.some((r) => !r.description.trim());
    if (invalid) {
      toast.error("กรอกรายการสินค้า/บริการให้ครบ");
      return;
    }
    setBusy(true);
    try {
      await saveBusinessDocument({
        companyId,
        userId: user.uid,
        type: docType,
        customerName: customerName.trim(),
        customerId: customerId || undefined,
        issueDate,
        dueDate: dueDate || undefined,
        notes,
        items: rows,
        status: asDraft ? "draft" : "issued",
        paymentStatus: docType === "invoice" ? "unpaid" : "paid",
      });
      toast.success(asDraft ? "บันทึกฉบับร่างแล้ว" : "ออกเอกสารแล้ว");
      if (!asDraft) {
        setRows([createEmptyItemRow()]);
        setNotes("");
      }
    } catch (e) {
      console.error(e);
      toast.error("บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader
        title="ออกเอกสาร"
        subtitle="สร้างใบเสนอราคา ใบแจ้งหนี้ ใบเสร็จ และเอกสารอื่น ๆ"
      />
      <div className="space-y-6 px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <Card className="rounded-2xl border-border/80 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  ข้อมูลเอกสาร
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>ประเภทเอกสาร</Label>
                  <Select
                    value={docType}
                    onValueChange={(v) => {
                      if (v) setDocType(v as DocumentType);
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {types.map((t) => (
                        <SelectItem key={t} value={t}>
                          {documentTypeLabels[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>ลูกค้า / คู่ค้า</Label>
                  <Select
                    value={customerId || "__manual__"}
                    onValueChange={(v) => {
                      if (!v) return;
                      if (v === "__manual__") setCustomerId("");
                      else applyCustomer(v);
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="เลือกจากรายชื่อ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__manual__">ระบุเอง</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-10 rounded-xl"
                    placeholder="ชื่อที่แสดงบนเอกสาร"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>วันที่ออกเอกสาร</Label>
                  <Input
                    type="date"
                    className="h-10 rounded-xl"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>วันครบกำหนด (ถ้ามี)</Label>
                  <Input
                    type="date"
                    className="h-10 rounded-xl"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>หมายเหตุ</Label>
                  <Textarea
                    className="min-h-[88px] rounded-xl border-border/80"
                    placeholder="เงื่อนไขการชำระเงิน ข้อกำหนดเพิ่มเติม"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/80 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  รายการสินค้า / บริการ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentItemTable rows={rows} onChange={setRows} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <PaymentSummaryCard
              subtotal={summary.subtotal}
              vat={summary.vat}
              total={summary.total}
            />
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl"
                disabled={busy}
                onClick={() => void onSave(true)}
              >
                บันทึกฉบับร่าง
              </Button>
              <Button
                type="button"
                className="h-11 rounded-xl"
                disabled={busy}
                onClick={() => void onSave(false)}
              >
                ออกเอกสาร
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              การคำนวณ VAT แบบแยกจากยอดก่อนภาษีต่อรายการ — ปรับเปลี่ยนได้ตามนโยบายบริษัท
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
