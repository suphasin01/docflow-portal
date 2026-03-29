"use client";

import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseDb } from "./client";
import type { DocumentType, DocumentStatus, PaymentStatus } from "@/types";
import type { DocumentItemRow } from "@/lib/document-item-utils";
import { summarizeItems } from "@/lib/document-item-utils";

type SaveDraftInput = {
  companyId: string;
  userId: string;
  type: DocumentType;
  customerName: string;
  customerId?: string;
  issueDate: string;
  dueDate?: string;
  notes?: string;
  items: DocumentItemRow[];
  status: DocumentStatus;
  paymentStatus: PaymentStatus;
};

export async function saveBusinessDocument(input: SaveDraftInput) {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  const { subtotal, vat, total } = summarizeItems(input.items);
  const docRef = doc(collection(db, "documents"));

  const prefixMap: Record<DocumentType, string> = {
    quotation: "QT",
    sales_order: "SO",
    invoice: "INV",
    billing_note: "BN",
    tax_invoice: "TI",
    receipt: "RCP",
    delivery_order: "DO",
    credit_note: "CN",
    purchase_order: "PO",
    purchase_request: "PR",
    goods_receipt: "GR",
    payment_voucher: "PV",
  };
  const docNumber = `${prefixMap[input.type]}-${new Date().getFullYear()}-${docRef.id.slice(0, 6).toUpperCase()}`;

  const batch = writeBatch(db);

  batch.set(docRef, {
    companyId: input.companyId,
    docNumber,
    type: input.type,
    status: input.status,
    customerId: input.customerId ?? null,
    customerName: input.customerName,
    issueDate: input.issueDate,
    dueDate: input.dueDate ?? null,
    subtotal,
    discountTotal: input.items.reduce((s, r) => s + r.discountAmount, 0),
    vatAmount: vat,
    total,
    notes: input.notes ?? "",
    paymentStatus: input.paymentStatus,
    createdBy: input.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  input.items.forEach((row, idx) => {
    const lineRef = doc(collection(db, "documentItems"));
    const base = Math.max(
      0,
      row.quantity * row.unitPrice - row.discountAmount
    );
    const vatLine = base * (row.vatRate / 100);
    batch.set(lineRef, {
      companyId: input.companyId,
      documentId: docRef.id,
      lineNo: idx + 1,
      description: row.description,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      discountAmount: row.discountAmount,
      vatRate: row.vatRate,
      lineTotal: Math.round((base + vatLine) * 100) / 100,
      createdBy: input.userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
  return docRef.id;
}

export async function markInvoicePaid(params: {
  companyId: string;
  userId: string;
  documentId: string;
  docNumber: string;
  amount: number;
}) {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");
  const batch = writeBatch(db);
  const dRef = doc(db, "documents", params.documentId);
  batch.update(dRef, {
    paymentStatus: "paid",
    status: "paid",
    updatedAt: serverTimestamp(),
  });
  const pRef = doc(collection(db, "payments"));
  batch.set(pRef, {
    companyId: params.companyId,
    documentId: params.documentId,
    docNumber: params.docNumber,
    amount: params.amount,
    paidAt: new Date().toISOString().slice(0, 10),
    method: "บันทึกมือ",
    note: "ทำเครื่องหมายชำระจากหน้าติดตาม",
    createdBy: params.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}
