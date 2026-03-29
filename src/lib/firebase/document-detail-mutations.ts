"use client";

import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import {
  computeTotals,
  type Step2FormValues,
} from "@/lib/schemas/document-step2";
import { DOC_TYPE_CONFIG, type ExtDocType } from "@/lib/doc-types";
import type { Step1FormValues } from "@/lib/schemas/document-draft";
import type { Step3FormValues } from "@/lib/schemas/document-step3";
import type {
  BusinessDocument,
  PaymentStatus,
  PaymentStatusHistoryEntry,
} from "@/types";
import { DEFAULT_DOCUMENT_SETTINGS } from "@/lib/schemas/settings";
import {
  buildDocNumber,
  getNextRunningNumber,
} from "@/lib/firebase/doc-number-utils";

type CreateDocumentPayload = {
  companyId: string;
  userId: string;
  step1Data: Step1FormValues;
  step2Data: Step2FormValues;
  step3Data: Step3FormValues;
  sourceDocument?: (BusinessDocument & { id: string }) | null;
  nextType?: ExtDocType;
  createdFromFlowAction?: string | null;
};

function buildPartnerSummary(step1Data: Step1FormValues) {
  const partnerRole = DOC_TYPE_CONFIG[step1Data.documentType].partnerRole;
  const partnerName = step1Data.partnerSnapshot.name?.trim() ?? "";
  return partnerRole === "customer"
    ? { customerName: partnerName, vendorName: "" }
    : { customerName: "", vendorName: partnerName };
}

export async function createBusinessDocumentDraft(
  payload: CreateDocumentPayload,
) {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  const docRef = doc(collection(db, "documents"));
  const batch = writeBatch(db);

  const step1Data: Step1FormValues = {
    ...payload.step1Data,
    documentType: payload.nextType ?? payload.step1Data.documentType,
  };

  const totals = computeTotals(payload.step2Data);
  const partnerSummary = buildPartnerSummary(step1Data);
  const chainId =
    payload.sourceDocument?.chainId || payload.sourceDocument?.id || docRef.id;
  const paymentStatus: PaymentStatus = payload.sourceDocument
    ? (payload.sourceDocument.paymentStatus ?? "unpaid")
    : "unpaid";
  const documentNumber =
    step1Data.documentNumber.trim() ||
    buildDocNumber(
      DOC_TYPE_CONFIG[step1Data.documentType].prefix,
      DEFAULT_DOCUMENT_SETTINGS,
      await getNextRunningNumber(payload.companyId, step1Data.documentType),
    );
  const persistedStep1Data: Step1FormValues = {
    ...step1Data,
    documentNumber,
  };

  batch.set(docRef, {
    companyId: payload.companyId,
    docNumber: documentNumber,
    type: persistedStep1Data.documentType,
    status: "draft",
    workflowStatus: "draft",
    paymentStatus,
    issueDate: persistedStep1Data.documentDate,
    dueDate: persistedStep1Data.extraDateValue || null,
    subtotal: totals.itemSubtotal,
    discountTotal: totals.rowDiscountTotal + totals.documentDiscountTotal,
    vatAmount: totals.vatIncludedAmount || totals.vatTotal,
    total: totals.netTotal,
    notes: payload.step3Data.note.text ?? "",
    refDocumentId: payload.sourceDocument?.id ?? null,
    sourceDocumentId: payload.sourceDocument?.id ?? null,
    chainId,
    createdFromFlowAction: payload.createdFromFlowAction ?? null,
    nextDocumentsCreated: [],
    companySnapshot: persistedStep1Data.companySnapshot,
    partnerSnapshot: persistedStep1Data.partnerSnapshot,
    previewData: {
      step1Data: persistedStep1Data,
      step2Data: payload.step2Data,
      step3Data: payload.step3Data,
    },
    ...partnerSummary,
    createdBy: payload.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (payload.sourceDocument) {
    const nextTypes = Array.from(
      new Set([
        ...(payload.sourceDocument.nextDocumentsCreated ?? []),
        step1Data.documentType,
      ]),
    );
    batch.update(doc(db, "documents", payload.sourceDocument.id), {
      nextDocumentsCreated: nextTypes,
      /** เอกสารต้นทางถูกใช้สร้างเอกสารถัดไปแล้ว — แสดงเป็น «ออกบิลแล้ว» ใน UI */
      workflowStatus: "billed",
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
  return docRef.id;
}

export function buildRelatedDocumentDraftPayload(params: {
  sourceDocument: BusinessDocument & { id: string };
  nextType: ExtDocType;
}) {
  const previewData = params.sourceDocument.previewData;
  const step1Data = previewData?.step1Data as Step1FormValues | undefined;
  const step2Data = previewData?.step2Data as Step2FormValues | undefined;
  const step3Data = previewData?.step3Data as Step3FormValues | undefined;

  if (!step1Data || !step2Data || !step3Data) {
    throw new Error("ไม่พบข้อมูล preview ของเอกสารต้นทาง");
  }

  const cfg = DOC_TYPE_CONFIG[params.nextType];
  return {
    step1Data: {
      ...step1Data,
      documentType: params.nextType,
      flowType: cfg.flow,
      documentGroup: cfg.group,
      documentNumber: "",
      showReferenceNumber: true,
      referenceNumber: params.sourceDocument.docNumber,
    } satisfies Step1FormValues,
    step2Data,
    step3Data,
  };
}

export async function propagatePaymentStatusForward(params: {
  companyId: string;
  chainId: string;
  sourceDocumentId: string;
  paymentStatus: PaymentStatus;
}) {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  const snap = await getDocs(
    query(
      collection(db, "documents"),
      where("companyId", "==", params.companyId),
      where("chainId", "==", params.chainId),
    ),
  );

  const docs = snap.docs.map((row) => ({
    id: row.id,
    ...(row.data() as BusinessDocument),
  }));

  const childrenByParent = new Map<string, string[]>();
  for (const row of docs) {
    const parentId = row.refDocumentId ?? row.sourceDocumentId;
    if (!parentId) continue;
    childrenByParent.set(parentId, [
      ...(childrenByParent.get(parentId) ?? []),
      row.id,
    ]);
  }

  const queue = [params.sourceDocumentId];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    for (const childId of childrenByParent.get(current) ?? []) {
      queue.push(childId);
    }
  }

  const batch = writeBatch(db);
  for (const id of visited) {
    batch.update(doc(db, "documents", id), {
      paymentStatus: params.paymentStatus,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function updateDocumentWorkflowStatus(params: {
  documentId: string;
  workflowStatus: "draft" | "billed";
}) {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");
  await updateDoc(doc(db, "documents", params.documentId), {
    workflowStatus: params.workflowStatus,
    updatedAt: serverTimestamp(),
  });
}

/** เปลี่ยนสถานะการชำระเงิน + บันทึกประวัติ (จาก A เป็น B, เวลา, ผู้ทำรายการ) */
export async function updateDocumentPaymentStatus(params: {
  documentId: string;
  companyId: string;
  userId: string;
  userEmail?: string | null;
  nextStatus: PaymentStatus;
  paymentMethod?: string | null;
}) {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  const ref = doc(db, "documents", params.documentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("ไม่พบเอกสาร");

  const data = snap.data() as BusinessDocument;
  if (data.companyId !== params.companyId) {
    throw new Error("เอกสารไม่ตรงกับบริษัทที่เลือก");
  }

  const from = (data.paymentStatus ?? "unpaid") as PaymentStatus;
  if (from === params.nextStatus) return;

  const hist: PaymentStatusHistoryEntry = {
    at: Timestamp.now(),
    from,
    to: params.nextStatus,
    userId: params.userId,
    userEmail: params.userEmail?.trim() || null,
  };
  if (params.nextStatus === "paid" && params.paymentMethod?.trim()) {
    hist.paymentMethod = params.paymentMethod.trim();
  }

  const patch: Record<string, unknown> = {
    paymentStatus: params.nextStatus,
    updatedAt: serverTimestamp(),
    paymentStatusHistory: arrayUnion(hist),
  };
  if (params.nextStatus === "paid") {
    patch.paymentMethod = params.paymentMethod?.trim() || null;
  } else {
    patch.paymentMethod = null;
  }

  await updateDoc(ref, patch);
}

export async function getBusinessDocumentById(
  documentId: string,
): Promise<(BusinessDocument & { id: string }) | null> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");
  const snap = await getDoc(doc(db, "documents", documentId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as BusinessDocument) };
}

/** อัปเดตเอกสารที่มีอยู่จากข้อมูล wizard (แก้ไขจากหน้า create) */
export async function updateBusinessDocumentFromWizard(payload: {
  documentId: string;
  companyId: string;
  step1Data: Step1FormValues;
  step2Data: Step2FormValues;
  step3Data: Step3FormValues;
}) {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  const ref = doc(db, "documents", payload.documentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("ไม่พบเอกสาร");

  const existing = snap.data() as BusinessDocument;
  if (existing.companyId !== payload.companyId) {
    throw new Error("เอกสารไม่ตรงกับบริษัทที่เลือก");
  }

  const step1Data = payload.step1Data;
  const totals = computeTotals(payload.step2Data);
  const partnerSummary = buildPartnerSummary(step1Data);
  const documentNumber = step1Data.documentNumber.trim();
  const persistedStep1: Step1FormValues = {
    ...step1Data,
    documentNumber,
  };

  await updateDoc(ref, {
    docNumber: documentNumber,
    type: step1Data.documentType,
    issueDate: step1Data.documentDate,
    dueDate: step1Data.extraDateValue || null,
    subtotal: totals.itemSubtotal,
    discountTotal: totals.rowDiscountTotal + totals.documentDiscountTotal,
    vatAmount: totals.vatIncludedAmount || totals.vatTotal,
    total: totals.netTotal,
    notes: payload.step3Data.note.text ?? "",
    companySnapshot: persistedStep1.companySnapshot,
    partnerSnapshot: persistedStep1.partnerSnapshot,
    previewData: {
      step1Data: persistedStep1,
      step2Data: payload.step2Data,
      step3Data: payload.step3Data,
    },
    ...partnerSummary,
    updatedAt: serverTimestamp(),
  });
}
