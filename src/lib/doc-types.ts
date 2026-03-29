export type FlowType = "income" | "expense";
export type DocumentGroup = "sales" | "finance" | "purchase";
export type ExtDocType = DocumentGroup extends never
  ? never
  :
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

export type PartnerRole = "customer" | "vendor";
export type CompanyNameSize = "S" | "M" | "L" | "XL";

interface DocTypeConfig {
  label: string;
  /** ชื่อประเภทเอกสารภาษาอังกฤษ (พรีวิว / หัวกระดาษ) */
  labelEn: string;
  prefix: string;
  group: DocumentGroup;
  flow: FlowType;
  /** null = ไม่มี extra date field */
  extraDateLabel: "ใช้ได้ถึง" | "วันครบกำหนด" | null;
  partnerRole: PartnerRole;
}

export const DOC_TYPE_CONFIG: Record<ExtDocType, DocTypeConfig> = {
  // income — sales
  quotation: {
    label: "ใบเสนอราคา",
    labelEn: "Quotation",
    prefix: "QUO",
    group: "sales",
    flow: "income",
    extraDateLabel: "ใช้ได้ถึง",
    partnerRole: "customer",
  },
  sales_order: {
    label: "ใบสั่งขาย",
    labelEn: "Sales Order",
    prefix: "SO",
    group: "sales",
    flow: "income",
    extraDateLabel: "วันครบกำหนด",
    partnerRole: "customer",
  },
  invoice: {
    label: "ใบแจ้งหนี้",
    labelEn: "Invoice",
    prefix: "INV",
    group: "sales",
    flow: "income",
    extraDateLabel: "วันครบกำหนด",
    partnerRole: "customer",
  },
  billing_note: {
    label: "ใบวางบิล",
    labelEn: "Billing Note",
    prefix: "BN",
    group: "sales",
    flow: "income",
    extraDateLabel: "วันครบกำหนด",
    partnerRole: "customer",
  },
  tax_invoice: {
    label: "ใบกำกับภาษี",
    labelEn: "Tax Invoice",
    prefix: "TAX",
    group: "sales",
    flow: "income",
    extraDateLabel: null,
    partnerRole: "customer",
  },
  receipt: {
    label: "ใบเสร็จรับเงิน",
    labelEn: "Receipt",
    prefix: "RCP",
    group: "sales",
    flow: "income",
    extraDateLabel: null,
    partnerRole: "customer",
  },
  delivery_order: {
    label: "ใบส่งของ",
    labelEn: "Delivery Order",
    prefix: "DO",
    group: "sales",
    flow: "income",
    extraDateLabel: "วันครบกำหนด",
    partnerRole: "customer",
  },
  // income — finance
  credit_note: {
    label: "ใบลดหนี้",
    labelEn: "Credit Note",
    prefix: "CN",
    group: "finance",
    flow: "income",
    extraDateLabel: null,
    partnerRole: "customer",
  },
  // expense — purchase
  purchase_order: {
    label: "ใบสั่งซื้อ",
    labelEn: "Purchase Order",
    prefix: "PO",
    group: "purchase",
    flow: "expense",
    extraDateLabel: "ใช้ได้ถึง",
    partnerRole: "vendor",
  },
  purchase_request: {
    label: "ใบขอซื้อ",
    labelEn: "Purchase Request",
    prefix: "PR",
    group: "purchase",
    flow: "expense",
    extraDateLabel: "วันครบกำหนด",
    partnerRole: "vendor",
  },
  goods_receipt: {
    label: "ใบรับสินค้า",
    labelEn: "Goods Receipt",
    prefix: "GR",
    group: "purchase",
    flow: "expense",
    extraDateLabel: null,
    partnerRole: "vendor",
  },
  // expense — finance
  payment_voucher: {
    label: "ใบสำคัญจ่าย",
    labelEn: "Payment Voucher",
    prefix: "PV",
    group: "finance",
    flow: "expense",
    extraDateLabel: null,
    partnerRole: "vendor",
  },
};

/** ประเภทเอกสารที่ใช้สถานะการชำระเงิน (แสดงในรายละเอียด / แดชบอร์ด) */
export const DOCUMENT_TYPES_WITH_PAYMENT_STATUS = new Set<ExtDocType>([
  "receipt",
  "invoice",
  "payment_voucher",
  "sales_order",
  "purchase_order",
  "goods_receipt",
  "billing_note",
  "tax_invoice",
]);

export function documentTypeSupportsPaymentStatus(
  type: string | undefined | null,
): boolean {
  if (!type) return false;
  return DOCUMENT_TYPES_WITH_PAYMENT_STATUS.has(type as ExtDocType);
}

export const ALL_EXT_DOC_TYPES = Object.keys(DOC_TYPE_CONFIG) as ExtDocType[];

export function getDocTypesByFlowAndGroup(
  flow: FlowType,
  group: DocumentGroup,
): ExtDocType[] {
  return ALL_EXT_DOC_TYPES.filter(
    (k) =>
      DOC_TYPE_CONFIG[k].flow === flow && DOC_TYPE_CONFIG[k].group === group,
  );
}

export function getDefaultDocGroupForFlow(flow: FlowType): DocumentGroup {
  return flow === "income" ? "sales" : "purchase";
}

export function getDefaultDocTypeForFlowGroup(
  flow: FlowType,
  group: DocumentGroup,
): ExtDocType {
  return getDocTypesByFlowAndGroup(flow, group)[0] ?? "quotation";
}

export function getGroupsForFlow(
  flow: FlowType,
): { value: DocumentGroup; label: string }[] {
  if (flow === "income") {
    return [
      { value: "sales", label: "เอกสารขาย" },
      { value: "finance", label: "เอกสารการเงิน" },
    ];
  }
  return [
    { value: "purchase", label: "เอกสารจัดซื้อ" },
    { value: "finance", label: "เอกสารการเงิน" },
  ];
}

export const COMPANY_NAME_FONT_SIZE: Record<CompanyNameSize, number> = {
  S: 14,
  M: 16,
  L: 18,
  XL: 20,
};
