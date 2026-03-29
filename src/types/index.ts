import type { Timestamp } from "firebase/firestore";

/** ฟิลด์พื้นฐานทุกเรคอร์ดใน Firestore */
export interface FirestoreTimestamps {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface BaseEntity extends FirestoreTimestamps {
  companyId: string;
}

export type DocumentType =
  | "quotation"
  | "sales_order"
  | "invoice"
  | "billing_note"
  | "tax_invoice"
  | "receipt"
  | "delivery_order"
  | "credit_note"
  | "purchase_order"
  | "purchase_request"
  | "goods_receipt"
  | "payment_voucher";

export type DocumentStatus =
  | "draft"
  | "issued"
  | "paid"
  | "partial"
  | "overdue"
  | "cancelled";

export type PaymentStatus = "unpaid" | "partial" | "paid" | "overdue";

/** บันทึกเมื่อเปลี่ยนสถานะการชำระเงิน (เก็บในเอกสาร) */
export type PaymentStatusHistoryEntry = {
  at: Timestamp;
  from: PaymentStatus;
  to: PaymentStatus;
  userId: string;
  userEmail?: string | null;
  /** บันทึกเมื่อเปลี่ยนเป็น paid */
  paymentMethod?: string | null;
};

export type VatType = "inclusive" | "exclusive" | "zero" | "exempt";

/** ประเภทรายการ สินค้า หรือ บริการ */
export type ItemType = "product" | "service";

/** ประเภท VAT สำหรับ catalog */
export type CatalogVatType = "vat3" | "vat7" | "custom";

/** สินค้า/บริการ (catalog model) */
export interface CatalogItem extends FirestoreTimestamps {
  companyId: string;
  /** รหัสสินค้า เช่น P0001 */
  code: string;
  /** ลำดับสำหรับ auto-increment */
  codeNumber: number;
  itemType: ItemType;
  name: string;
  description?: string;
  unit?: string;
  salePrice: number;
  costPrice?: number;
  vatType: CatalogVatType;
  /** อัตรา VAT จริง (3, 7, หรือค่ากำหนดเอง) */
  customVatRate?: number;
  isArchived: boolean;
}

export interface UserProfile extends FirestoreTimestamps {
  companyId: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface Company extends FirestoreTimestamps {
  /** Firestore doc id — ใช้เป็น companyId ทั่วทั้งแอป */
  id?: string;
  /** uid ของเจ้าของบริษัท */
  ownerId: string;
  name: string;
  nameEn?: string;
  officeType?: "none" | "hq" | "branch";
  taxId?: string;
  branch?: string;
  branchName?: string;
  branchCode?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  signerName?: string;
  signerPosition?: string;
  isDefault?: boolean;
  archived?: boolean;
}

export interface Customer extends BaseEntity {
  name: string;
  taxId?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  active: boolean;
}

export interface Vendor extends BaseEntity {
  name: string;
  taxId?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  active: boolean;
}

export type PartnerType = "customer" | "vendor";
export type ContactOfficeType = "none" | "hq" | "branch";

/** ลูกค้า/ผู้ขาย (unified contact model) */
export interface Contact extends FirestoreTimestamps {
  companyId: string;
  partnerType: PartnerType;
  /** รหัส เช่น C0001 */
  code: string;
  /** ลำดับตัวเลขสำหรับ auto-increment */
  codeNumber: number;
  nameTh: string;
  nameEn?: string;
  taxId?: string;
  phone?: string;
  email?: string;
  address?: string;
  officeType: ContactOfficeType;
  branchName?: string;
  branchCode?: string;
  logoBase64?: string;
  isArchived: boolean;
}

export interface Product extends BaseEntity {
  name: string;
  sku?: string;
  category?: string;
  unit: string;
  defaultPrice: number;
  cost?: number;
  vatType: VatType;
  active: boolean;
}

export interface DocumentItem extends BaseEntity {
  documentId: string;
  lineNo: number;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  vatRate: number;
  lineTotal: number;
}

export interface BusinessDocument extends BaseEntity {
  docNumber: string;
  type: DocumentType;
  status: DocumentStatus;
  workflowStatus?: "draft" | "billed";
  customerId?: string;
  customerName?: string;
  vendorId?: string;
  vendorName?: string;
  issueDate: string;
  dueDate?: string;
  subtotal: number;
  discountTotal: number;
  vatAmount: number;
  total: number;
  notes?: string;
  paymentStatus?: PaymentStatus;
  /** ช่องทางชำระเงิน (key เช่น cash, transfer) — ตั้งเมื่อชำระแล้ว */
  paymentMethod?: string | null;
  /** ประวัติการเปลี่ยนสถานะชำระเงิน (ล่าสุดต่อท้ายเมื่อใช้ arrayUnion) */
  paymentStatusHistory?: PaymentStatusHistoryEntry[];
  refDocumentId?: string | null;
  sourceDocumentId?: string | null;
  chainId?: string | null;
  createdFromFlowAction?: string | null;
  nextDocumentsCreated?: string[];
  companySnapshot?: Record<string, unknown>;
  partnerSnapshot?: Record<string, unknown>;
  previewData?: {
    step1Data?: Record<string, unknown> | null;
    step2Data?: Record<string, unknown> | null;
    step3Data?: Record<string, unknown> | null;
  };
}

export interface Payment extends BaseEntity {
  documentId: string;
  docNumber: string;
  amount: number;
  paidAt: string;
  method?: string;
  note?: string;
}

export interface ReportsCache extends BaseEntity {
  key: string;
  payload: Record<string, unknown>;
  refreshedAt: Timestamp;
}

export interface CompanySettings extends BaseEntity {
  currency: string;
  vatRateDefault: number;
  docNumberPrefixes: Partial<Record<DocumentType, string>>;
}

export type DocumentNumberDateFormat =
  | "TH_YYMM"
  | "TH_YY"
  | "TH_YYYY"
  | "AD_YYMM"
  | "AD_YYYY";

export type DeletedNumberBehavior = "fill_gap" | "continue_max";

export type DocumentDisplayDateFormat =
  | "TH_SHORT_BE"
  | "TH_LONG_BE"
  | "TH_NUMERIC_BE"
  | "EN_SHORT_AD"
  | "EN_LONG_AD"
  | "EN_NUMERIC_AD"
  | "ISO_8601";

/** ตั้งค่าเอกสาร ต่อบริษัท — เก็บใน /settings/{companyId} */
export interface DocumentSettings {
  companyId: string;
  defaultVatRate: number;
  defaultWithholdingTaxRate: number;
  documentNumberDateFormat: DocumentNumberDateFormat;
  documentRunningDigits: number;
  documentNumberSeparator: string;
  deletedNumberBehavior: DeletedNumberBehavior;
  documentDisplayDateFormat: DocumentDisplayDateFormat;
  updatedAt?: unknown;
}
