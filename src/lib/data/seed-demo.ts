"use client";

import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import {
  mockCompany,
  mockCustomers,
  mockDocuments,
  mockPayments,
  mockProducts,
  mockVendors,
} from "./mock-seed";

export async function seedDemoData(params: {
  companyId: string;
  userId: string;
}): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  const { companyId, userId } = params;
  const ts = serverTimestamp();

  await updateDoc(doc(db, "companies", companyId), {
    ...mockCompany,
    companyId,
    updatedAt: ts,
  });

  const batch = writeBatch(db);

  const customerIds: string[] = [];
  for (const c of mockCustomers) {
    const ref = doc(collection(db, "customers"));
    customerIds.push(ref.id);
    batch.set(ref, {
      ...c,
      companyId,
      createdBy: userId,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  for (const v of mockVendors) {
    const ref = doc(collection(db, "vendors"));
    batch.set(ref, {
      ...v,
      companyId,
      createdBy: userId,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  for (const p of mockProducts) {
    const ref = doc(collection(db, "products"));
    batch.set(ref, {
      ...p,
      companyId,
      createdBy: userId,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  await batch.commit();

  let paidInvoiceRefId: string | null = null;

  for (let i = 0; i < mockDocuments.length; i++) {
    const d = mockDocuments[i]!;
    const ref = await addDoc(collection(db, "documents"), {
      ...d,
      companyId,
      customerId:
        d.type !== "purchase_order"
          ? customerIds[i % customerIds.length]
          : undefined,
      createdBy: userId,
      createdAt: ts,
      updatedAt: ts,
    });
    if (d.docNumber === "INV-2025-0138") {
      paidInvoiceRefId = ref.id;
    }
  }

  if (paidInvoiceRefId) {
    for (const pay of mockPayments) {
      await addDoc(collection(db, "payments"), {
        ...pay,
        documentId: paidInvoiceRefId,
        companyId,
        createdBy: userId,
        createdAt: ts,
        updatedAt: ts,
      });
    }
  }
}
