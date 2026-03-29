import { DOC_TYPE_CONFIG, type ExtDocType } from "@/lib/doc-types";

/** ทางเดินเอกสารต่อเนื่อง — สเปกธุรกิจ (pre-chain ที่อนุญาตให้สร้างจากหน้า detail) */
export type RelatedActionHint = "direct" | "skip" | "special";

export type RelatedDocumentAction = {
  nextType: ExtDocType;
  hint: RelatedActionHint;
  /** ข้อความหลังป้ายประเภท (ยกเว้น hint=special จะแสดงคำว่า "เอกสารพิเศษ" จาก UI) */
  label: string;
};

export const DOCUMENT_FLOW_CONFIG: Record<
  ExtDocType,
  RelatedDocumentAction[]
> = {
  // ใบเสนอราคา
  quotation: [
    { nextType: "sales_order", hint: "direct", label: "สร้างเอกสารใหม่" },
    { nextType: "invoice", hint: "skip", label: "สร้างเอกสารใหม่" },
    { nextType: "delivery_order", hint: "skip", label: "สร้างเอกสารใหม่" },
  ],
  // ใบสั่งขาย
  sales_order: [
    { nextType: "invoice", hint: "direct", label: "สร้างเอกสารใหม่" },
    { nextType: "delivery_order", hint: "skip", label: "สร้างเอกสารใหม่" },
  ],
  // ใบแจ้งหนี้
  invoice: [
    { nextType: "tax_invoice", hint: "direct", label: "สร้างใหม่" },
    { nextType: "receipt", hint: "skip", label: "สร้างเอกสารใหม่" },
    { nextType: "billing_note", hint: "skip", label: "สร้างเอกสารใหม่" },
    { nextType: "credit_note", hint: "special", label: "" },
  ],
  // ใบเสร็จรับเงิน — ไม่มีตัวต่อ
  receipt: [],
  // ใบวางบิล
  billing_note: [
    { nextType: "receipt", hint: "direct", label: "สร้างใหม่" },
  ],
  // ใบส่งของ
  delivery_order: [
    { nextType: "invoice", hint: "direct", label: "สร้างใหม่" },
  ],
  // ใบขอซื้อ
  purchase_request: [
    { nextType: "purchase_order", hint: "direct", label: "สร้างใหม่" },
  ],
  // ใบสั่งซื้อ
  purchase_order: [
    { nextType: "goods_receipt", hint: "direct", label: "สร้างใหม่" },
  ],
  // ใบรับสินค้า
  goods_receipt: [
    { nextType: "payment_voucher", hint: "direct", label: "สร้างใหม่" },
  ],
  // ใบสำคัญจ่าย — ไม่มีตัวต่อ
  payment_voucher: [],
  // ใบกำกับภาษี
  tax_invoice: [
    { nextType: "receipt", hint: "direct", label: "สร้างใหม่" },
    { nextType: "credit_note", hint: "special", label: "" },
  ],
  // ใบลดหนี้ — ไม่มีตัวต่อ
  credit_note: [],
};

export function getNextDocumentActions(docType: ExtDocType) {
  return DOCUMENT_FLOW_CONFIG[docType] ?? [];
}

/** prefix แถวแบบข้ามขั้น — ใช้คู่กับป้ายประเภทปลายทาง */
export function getRelationHintLabel(hint: RelatedActionHint) {
  if (hint === "skip") return "ข้าม ->";
  if (hint === "special") return "เอกสารพิเศษ";
  return "";
}

export function getDocumentTypeBadgeLabel(docType: ExtDocType) {
  return DOC_TYPE_CONFIG[docType]?.label ?? docType;
}

