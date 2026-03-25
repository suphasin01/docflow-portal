export type DocumentItemRow = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  vatRate: number;
  lineTotal: number;
};

export function createEmptyItemRow(): DocumentItemRow {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `row-${Date.now()}`,
    description: "",
    quantity: 1,
    unitPrice: 0,
    discountAmount: 0,
    vatRate: 7,
    lineTotal: 0,
  };
}

export function calculateLineTotal(
  r: Pick<
    DocumentItemRow,
    "quantity" | "unitPrice" | "discountAmount" | "vatRate"
  >
) {
  const base = Math.max(0, r.quantity * r.unitPrice - r.discountAmount);
  const vat = base * (r.vatRate / 100);
  return Math.round((base + vat) * 100) / 100;
}

export function summarizeItems(rows: DocumentItemRow[]) {
  const subtotal = rows.reduce(
    (s, r) => s + (r.quantity * r.unitPrice - r.discountAmount),
    0
  );
  const vat = rows.reduce((s, r) => {
    const base = Math.max(0, r.quantity * r.unitPrice - r.discountAmount);
    return s + base * (r.vatRate / 100);
  }, 0);
  const total = subtotal + vat;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    vat: Math.round(vat * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}
