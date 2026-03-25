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
  | "invoice"
  | "receipt"
  | "purchase_order"
  | "billing_note";

export type DocumentStatus =
  | "draft"
  | "issued"
  | "paid"
  | "partial"
  | "overdue"
  | "cancelled";

export type PaymentStatus =
  | "unpaid"
  | "partial"
  | "paid"
  | "overdue";

export type VatType = "inclusive" | "exclusive" | "zero" | "exempt";

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
