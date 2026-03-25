"use client";

import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "./client";
import type { ContactFormValues } from "@/lib/schemas/contact";

/** คำนวณรหัสถัดไปของ contact ในบริษัทนั้น */
export async function getNextContactCode(
  companyId: string
): Promise<{ code: string; codeNumber: number }> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  const q = query(
    collection(db, "contacts"),
    where("companyId", "==", companyId),
    orderBy("codeNumber", "desc"),
    limit(1)
  );
  const snap = await getDocs(q);
  const latestNum = (snap.docs[0]?.data()?.codeNumber as number | undefined) ?? 0;
  const next = latestNum + 1;
  return {
    code: `C${String(next).padStart(4, "0")}`,
    codeNumber: next,
  };
}

/** สร้าง contact ใหม่ */
export async function addContact(params: {
  companyId: string;
  userId: string;
  code: string;
  codeNumber: number;
  data: ContactFormValues;
}): Promise<string> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  const { data, companyId, userId, code, codeNumber } = params;

  const ref = await addDoc(collection(db, "contacts"), {
    companyId,
    partnerType: data.partnerType,
    code,
    codeNumber,
    nameTh: data.nameTh.trim(),
    nameEn: data.nameEn?.trim() ?? "",
    taxId: data.taxId?.trim() ?? "",
    phone: data.phone?.trim() ?? "",
    email: data.email?.trim() ?? "",
    address: data.address?.trim() ?? "",
    officeType: data.officeType,
    branchName: data.officeType === "branch" ? (data.branchName?.trim() ?? "") : "",
    branchCode: data.officeType === "branch" ? (data.branchCode?.trim() ?? "") : "",
    logoBase64: data.logoBase64?.trim() ?? "",
    isArchived: false,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** อัปเดต contact */
export async function updateContact(params: {
  contactId: string;
  data: ContactFormValues;
}): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  const { data, contactId } = params;

  await updateDoc(doc(db, "contacts", contactId), {
    partnerType: data.partnerType,
    nameTh: data.nameTh.trim(),
    nameEn: data.nameEn?.trim() ?? "",
    taxId: data.taxId?.trim() ?? "",
    phone: data.phone?.trim() ?? "",
    email: data.email?.trim() ?? "",
    address: data.address?.trim() ?? "",
    officeType: data.officeType,
    branchName: data.officeType === "branch" ? (data.branchName?.trim() ?? "") : "",
    branchCode: data.officeType === "branch" ? (data.branchCode?.trim() ?? "") : "",
    logoBase64: data.logoBase64?.trim() ?? "",
    updatedAt: serverTimestamp(),
  });
}

/** soft delete */
export async function archiveContact(contactId: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");
  await updateDoc(doc(db, "contacts", contactId), {
    isArchived: true,
    updatedAt: serverTimestamp(),
  });
}
