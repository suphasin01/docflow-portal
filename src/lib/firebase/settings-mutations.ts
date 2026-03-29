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
import {
  buildDefaultPresets,
  coerceStep3PresetStore,
  type Step3PresetStore,
} from "@/lib/schemas/document-step3";

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

/** Preset ขั้นตอนที่ 3 ต่อบริษัท — เก็บใน settings/{companyId}.step3Presets */
export async function loadStep3Presets(
  companyId: string,
): Promise<Step3PresetStore> {
  const db = getFirebaseDb();
  if (!db) return buildDefaultPresets();

  const ref = doc(db, "settings", companyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return buildDefaultPresets();

  return coerceStep3PresetStore(snap.data().step3Presets);
}

export async function saveStep3Presets(
  companyId: string,
  store: Step3PresetStore,
): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  const ref = doc(db, "settings", companyId);
  await setDoc(
    ref,
    {
      companyId,
      step3Presets: store,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
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
