import {
  Building2,
  ClipboardList,
  FileBarChart,
  FileEdit,
  LayoutDashboard,
  Package,
  UserRoundCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { documentTypeSupportsPaymentStatus } from "@/lib/doc-types";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export const mainNav: NavItem[] = [
  { href: "/", label: "แดชบอร์ด", icon: LayoutDashboard },
  { href: "/documents/create", label: "ออกเอกสาร", icon: FileEdit },
  { href: "/documents/history", label: "ประวัติเอกสาร", icon: ClipboardList },
  { href: "/payments", label: "ติดตามชำระเงิน", icon: Wallet },
  { href: "/catalog", label: "สินค้า/บริการ", icon: Package },
  { href: "/contacts", label: "ลูกค้า/ผู้ขาย", icon: Users },
  { href: "/reports", label: "รายงาน", icon: FileBarChart },
  { href: "/company", label: "บริษัทของฉัน", icon: Building2 },
  { href: "/users", label: "จัดการผู้ใช้", icon: UserRoundCog, adminOnly: true },
];

export const documentTypeLabels: Record<string, string> = {
  quotation: "ใบเสนอราคา",
  sales_order: "ใบสั่งขาย",
  invoice: "ใบแจ้งหนี้",
  billing_note: "ใบวางบิล",
  tax_invoice: "ใบกำกับภาษี",
  receipt: "ใบเสร็จรับเงิน",
  delivery_order: "ใบส่งของ",
  credit_note: "ใบลดหนี้",
  purchase_order: "ใบสั่งซื้อ",
  purchase_request: "ใบขอซื้อ",
  goods_receipt: "ใบรับสินค้า",
  payment_voucher: "ใบสำคัญจ่าย",
};

export const documentStatusLabels: Record<string, string> = {
  draft: "ร่าง",
  issued: "ออกแล้ว",
  paid: "ชำระแล้ว",
  partial: "ชำระบางส่วน",
  overdue: "เกินกำหนด",
  cancelled: "ยกเลิก",
};

export const paymentStatusLabels: Record<string, string> = {
  unpaid: "ยังไม่ชำระ",
  partial: "ชำระบางส่วน",
  paid: "ชำระแล้ว",
  overdue: "เกินกำหนด",
};

/** สถานะแสดงผล — ถ้ามีเอกสารต่อเนื่องแล้ว (workflow billed) ให้ขึ้น «ออกบิลแล้ว» */
export function getDocumentStatusDisplay(doc: {
  status: string;
  workflowStatus?: "draft" | "billed" | null;
}): { status: string; label: string } {
  if (doc.workflowStatus === "billed") {
    return { status: "billed", label: "ออกบิลแล้ว" };
  }
  return {
    status: doc.status,
    label: documentStatusLabels[doc.status] ?? doc.status,
  };
}

/** แดชบอร์ด: โฟกัสสถานะชำระเงินเฉพาะประเภทที่รองรับ — ถ้าออกบิลต่อแล้วให้แสดงก่อน */
export function getDashboardDocumentStatusDisplay(doc: {
  status: string;
  type?: string;
  workflowStatus?: "draft" | "billed" | null;
  paymentStatus?: string;
}): { status: string; label: string } {
  if (doc.workflowStatus === "billed") {
    return { status: "billed", label: "ออกบิลแล้ว" };
  }
  const payment = doc.paymentStatus;
  if (documentTypeSupportsPaymentStatus(doc.type) && payment) {
    return {
      status: payment,
      label: paymentStatusLabels[payment] ?? payment,
    };
  }
  return {
    status: doc.status,
    label: documentStatusLabels[doc.status] ?? doc.status,
  };
}
