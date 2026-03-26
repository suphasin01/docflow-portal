"use client";

import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "./client";
import type { DocumentSettingsFormValues } from "@/lib/schemas/settings";

/** สร้างส่วน date ของเลขที่เอกสาร */
function buildDatePart(
  format: DocumentSettingsFormValues["documentNumberDateFormat"]
): string {
  const now = new Date();
  const adYear = now.getFullYear();
  const beYear = adYear + 543;
  const month = String(now.getMonth() + 1).padStart(2, "0");
  switch (format) {
    case "TH_YYMM": return `${String(beYear).slice(-2)}${month}`;
    case "TH_YY":   return String(beYear).slice(-2);
    case "TH_YYYY": return String(beYear);
    case "AD_YYMM": return `${String(adYear).slice(-2)}${month}`;
    case "AD_YYYY": return String(adYear);
    default:        return `${String(beYear).slice(-2)}${month}`;
  }
}

/** สร้างเลขที่เอกสารเต็ม จาก prefix + settings + running number */
export function buildDocNumber(
  prefix: string,
  settings: DocumentSettingsFormValues,
  running: number
): string {
  const datePart   = buildDatePart(settings.documentNumberDateFormat);
  const runPart    = String(running).padStart(settings.documentRunningDigits, "0");
  const sep        = settings.documentNumberSeparator ?? "";
  return `${prefix}${datePart}${sep}${runPart}`;
}

/**
 * หา running number ถัดไปสำหรับ docType นี้ในบริษัท
 * ใช้ count ของเอกสารทั้งหมด (ทั้งที่ลบแล้ว) + 1 เพื่อไม่ให้ซ้ำ
 */
export async function getNextRunningNumber(
  companyId: string,
  docType: string
): Promise<number> {
  const db = getFirebaseDb();
  if (!db) return 1;

  const q = query(
    collection(db, "documents"),
    where("companyId", "==", companyId),
    where("type", "==", docType)
  );
  const snap = await getDocs(q);
  return snap.size + 1;
}

/** ตรวจสอบว่าเลขที่เอกสารซ้ำหรือไม่ */
export async function isDocNumberUnique(
  companyId: string,
  docNumber: string
): Promise<boolean> {
  if (!docNumber.trim()) return true;
  const db = getFirebaseDb();
  if (!db) return true;

  const q = query(
    collection(db, "documents"),
    where("companyId", "==", companyId),
    where("docNumber", "==", docNumber.trim()),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.empty;
}
