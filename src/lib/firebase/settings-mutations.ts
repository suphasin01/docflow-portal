"use client";

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "./client";
import type { DocumentSettingsFormValues } from "@/lib/schemas/settings";
import { DEFAULT_DOCUMENT_SETTINGS } from "@/lib/schemas/settings";

/** โหลด document settings ของบริษัท (คืน default ถ้ายังไม่มี) */
export async function loadDocumentSettings(
  companyId: string
): Promise<DocumentSettingsFormValues> {
  const db = getFirebaseDb();
  if (!db) return { ...DEFAULT_DOCUMENT_SETTINGS };

  const ref = doc(db, "settings", companyId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return { ...DEFAULT_DOCUMENT_SETTINGS };

  const data = snap.data();
  return {
    defaultVatRate: data.defaultVatRate ?? DEFAULT_DOCUMENT_SETTINGS.defaultVatRate,
    defaultWithholdingTaxRate:
      data.defaultWithholdingTaxRate ??
      DEFAULT_DOCUMENT_SETTINGS.defaultWithholdingTaxRate,
    documentNumberDateFormat:
      data.documentNumberDateFormat ??
      DEFAULT_DOCUMENT_SETTINGS.documentNumberDateFormat,
    documentRunningDigits:
      data.documentRunningDigits ?? DEFAULT_DOCUMENT_SETTINGS.documentRunningDigits,
    documentNumberSeparator:
      data.documentNumberSeparator ?? DEFAULT_DOCUMENT_SETTINGS.documentNumberSeparator,
    deletedNumberBehavior:
      data.deletedNumberBehavior ?? DEFAULT_DOCUMENT_SETTINGS.deletedNumberBehavior,
    documentDisplayDateFormat:
      data.documentDisplayDateFormat ??
      DEFAULT_DOCUMENT_SETTINGS.documentDisplayDateFormat,
  };
}

/** บันทึก document settings ของบริษัท */
export async function saveDocumentSettings(
  companyId: string,
  values: DocumentSettingsFormValues
): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  const ref = doc(db, "settings", companyId);
  await setDoc(
    ref,
    {
      companyId,
      ...values,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
