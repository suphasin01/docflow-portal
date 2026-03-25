import type {
  BusinessDocument,
  Company,
  Customer,
  Payment,
  Product,
  Vendor,
} from "@/types";

/** ข้อมูลตัวอย่างสำหรับอ้างอิง / ทดสอบ UI — ใช้กับฟังก์ชัน seedDemoData */
export const mockCompany: Partial<Company> & { name: string } = {
  name: "บริษัท ด็อกโฟลว์ จำกัด",
  taxId: "0105567890123",
  branch: "สำนักงานใหญ่",
  address: "เลขที่ 88 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110",
  phone: "02-123-4567",
  email: "contact@docflow.example",
};

export const mockCustomers: Omit<
  Customer,
  "companyId" | "createdAt" | "updatedAt" | "createdBy"
>[] = [
  {
    name: "ห้างหุ้นส่วนจำกัด ไทยซัพพลาย",
    taxId: "0905543210987",
    contactName: "คุณสมชาย",
    phone: "081-111-2222",
    email: "buyer@thaisupply.example",
    address: "จ.เชียงใหม่",
    active: true,
  },
  {
    name: "บริษัท เมก้า รีเทล จำกัด",
    taxId: "0105567000999",
    contactName: "คุณวิภา",
    phone: "089-888-7777",
    email: "ap@megaretail.example",
    address: "ถนนรัชดา กรุงเทพฯ",
    active: true,
  },
];

export const mockVendors: Omit<
  Vendor,
  "companyId" | "createdAt" | "updatedAt" | "createdBy"
>[] = [
  {
    name: "บริษัท เวิลด์ ออฟฟิศ จำกัด",
    taxId: "0105533111222",
    contactName: "ฝ่ายขาย",
    phone: "02-999-0000",
    email: "sales@worldoffice.example",
    address: "ลาดพร้าว กรุงเทพฯ",
    active: true,
  },
];

export const mockProducts: Omit<
  Product,
  "companyId" | "createdAt" | "updatedAt" | "createdBy"
>[] = [
  {
    name: "บริการออกแบบโลโก้",
    sku: "SRV-LOGO",
    category: "บริการ",
    unit: "โครงการ",
    defaultPrice: 15000,
    cost: 4000,
    vatType: "exclusive",
    active: true,
  },
  {
    name: "ซอฟต์แวร์สำนักงาน (รายปี)",
    sku: "LIC-OFF365",
    category: "สินค้า",
    unit: "ใบ",
    defaultPrice: 3200,
    cost: 2100,
    vatType: "exclusive",
    active: true,
  },
];

export const mockDocuments: Omit<
  BusinessDocument,
  "companyId" | "createdAt" | "updatedAt" | "createdBy"
>[] = [
  {
    docNumber: "INV-2025-0142",
    type: "invoice",
    status: "issued",
    customerName: "ห้างหุ้นส่วนจำกัด ไทยซัพพลาย",
    issueDate: "2025-03-01",
    dueDate: "2025-03-15",
    subtotal: 28000,
    discountTotal: 0,
    vatAmount: 1960,
    total: 29960,
    paymentStatus: "unpaid",
  },
  {
    docNumber: "INV-2025-0138",
    type: "invoice",
    status: "paid",
    customerName: "บริษัท เมก้า รีเทล จำกัด",
    issueDate: "2025-02-20",
    dueDate: "2025-03-05",
    subtotal: 45000,
    discountTotal: 500,
    vatAmount: 3115,
    total: 47615,
    paymentStatus: "paid",
  },
  {
    docNumber: "QT-2025-0099",
    type: "quotation",
    status: "draft",
    customerName: "บริษัท เมก้า รีเทล จำกัด",
    issueDate: "2025-03-10",
    dueDate: "2025-03-25",
    subtotal: 120000,
    discountTotal: 0,
    vatAmount: 8400,
    total: 128400,
    paymentStatus: "unpaid",
  },
];

export const mockPayments: Omit<
  Payment,
  "companyId" | "createdAt" | "updatedAt" | "createdBy"
>[] = [
  {
    documentId: "doc-paid-1",
    docNumber: "INV-2025-0138",
    amount: 47615,
    paidAt: "2025-03-04",
    method: "โอนเงิน",
    note: "ชำระครบถ้วน",
  },
];
