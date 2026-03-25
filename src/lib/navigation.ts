import {
  Building2,
  ClipboardList,
  FileBarChart,
  FileEdit,
  FileText,
  LayoutDashboard,
  Package,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
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
];

export const documentTypeLabels: Record<string, string> = {
  quotation: "ใบเสนอราคา",
  invoice: "ใบแจ้งหนี้",
  receipt: "ใบเสร็จ",
  purchase_order: "ใบสั่งซื้อ",
  billing_note: "ใบวางบิล",
};

export const documentStatusLabels: Record<string, string> = {
  draft: "ฉบับร่าง",
  issued: "ออกแล้ว",
  paid: "ชำระแล้ว",
  partial: "ชำระบางส่วน",
  overdue: "เกินกำหนด",
  cancelled: "ยกเลิก",
};

export const paymentStatusLabels: Record<string, string> = {
  unpaid: "ค้างชำระ",
  partial: "ชำระบางส่วน",
  paid: "ชำระครบ",
  overdue: "เกินกำหนด",
};
