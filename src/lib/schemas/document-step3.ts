// ─── Preset Types ─────────────────────────────────────────────────────────────

export interface SignaturePreset {
  id: string;
  name: string;
  titleText: string;
  signerName: string;
  signatureImageUrl: string;
}

export interface StampPreset {
  id: string;
  name: string;
  sourceType: "logo" | "upload";
  stampImageUrl: string;
}

export interface PaymentTermPreset {
  id: string;
  name: string;
  paymentTermType: string;
  customPaymentTermText: string;
}

export interface TextPreset {
  id: string;
  name: string;
  text: string;
}

// ─── Core Types ───────────────────────────────────────────────────────────────

export type SignatureRole = "receiver" | "approver" | "issuer";

export interface SignatureBlock {
  enabled: boolean;
  titleText: string;
  signerName: string;
  signatureImageUrl: string;
  signatureDate: string;
}

/** พิกัด px บนหน้า A4 (เดียวกับพรีวิว/PDF) — มุมซ้ายบนของกรอบตราประทับ */
export const DEFAULT_STAMP_POSITION_X = 430;
export const DEFAULT_STAMP_POSITION_Y = 240;
export const DEFAULT_STAMP_ROTATION_DEG = 0;

export interface Step3FormValues {
  signatures: Record<SignatureRole, SignatureBlock>;
  stamp: {
    enabled: boolean;
    sourceType: "logo" | "upload";
    stampImageUrl: string;
    positionX: number;
    positionY: number;
    rotationDeg: number;
  };
  paymentMethods: {
    visibleMethods: string[];
    checkedMethods: string[];
    customOtherLabel: string;
  };
  paymentTerm: {
    enabled: boolean;
    paymentTermType: string;
    customPaymentTermText: string;
  };
  note: { text: string };
  terms: { text: string };
}

/** Preset collection kept outside form state (dynamic arrays) */
export interface Step3PresetStore {
  signatures: Record<SignatureRole, SignaturePreset[]>;
  stamp: StampPreset[];
  paymentTerm: PaymentTermPreset[];
  note: TextPreset[];
  terms: TextPreset[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const PAYMENT_METHODS = [
  { key: "cash", label: "เงินสด" },
  { key: "transfer", label: "โอนเงิน" },
  { key: "cheque", label: "เช็ค" },
  { key: "credit_card", label: "บัตรเครดิต" },
  { key: "promptpay", label: "พร้อมเพย์" },
  { key: "credit", label: "เครดิต (เงินเชื่อ)" },
  { key: "other", label: "อื่นๆ" },
] as const;

export const PAYMENT_TERM_OPTIONS = [
  { key: "cash", label: "เงินสด" },
  { key: "credit7", label: "เครดิต 7 วัน" },
  { key: "credit15", label: "เครดิต 15 วัน" },
  { key: "credit30", label: "เครดิต 30 วัน" },
  { key: "credit45", label: "เครดิต 45 วัน" },
  { key: "credit60", label: "เครดิต 60 วัน" },
  { key: "custom", label: "กำหนดเอง" },
];

export const SIGNATURE_ROLE_LABELS: Record<SignatureRole, string> = {
  receiver: "ผู้รับเอกสาร",
  approver: "ลงนามเพิ่มเติม",
  issuer: "ผู้ออกเอกสาร",
};

export const SIGNATURE_ROLE_PREFIX: Record<SignatureRole, string> = {
  receiver: "ผู้รับ",
  approver: "ผู้อนุมัติ",
  issuer: "ผู้ออก",
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

function emptySignatureBlock(): SignatureBlock {
  return {
    enabled: false,
    titleText: "",
    signerName: "",
    signatureImageUrl: "",
    signatureDate: "",
  };
}

export function buildDefaultStep3Values(): Step3FormValues {
  return {
    signatures: {
      receiver: emptySignatureBlock(),
      approver: emptySignatureBlock(),
      issuer: { ...emptySignatureBlock(), enabled: true },
    },
    stamp: {
      enabled: false,
      sourceType: "upload",
      stampImageUrl: "",
      positionX: DEFAULT_STAMP_POSITION_X,
      positionY: DEFAULT_STAMP_POSITION_Y,
      rotationDeg: DEFAULT_STAMP_ROTATION_DEG,
    },
    paymentMethods: { visibleMethods: [], checkedMethods: [], customOtherLabel: "" },
    paymentTerm: { enabled: false, paymentTermType: "cash", customPaymentTermText: "" },
    note: { text: "" },
    terms: { text: "" },
  };
}

export function buildDefaultPresets(): Step3PresetStore {
  return {
    signatures: { receiver: [], approver: [], issuer: [] },
    stamp: [],
    paymentTerm: [],
    note: [],
    terms: [],
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function genId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function getPaymentTermLabel(type: string): string {
  return PAYMENT_TERM_OPTIONS.find((o) => o.key === type)?.label ?? type;
}
