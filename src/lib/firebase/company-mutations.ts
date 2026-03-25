"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "./client";
import type { Company } from "@/types";

type CompanyPatch = Partial<
  Pick<
    Company,
    | "name"
    | "nameEn"
    | "officeType"
    | "taxId"
    | "branch"
    | "branchName"
    | "branchCode"
    | "address"
    | "phone"
    | "email"
    | "logoUrl"
    | "signerName"
    | "signerPosition"
    | "isDefault"
    | "archived"
  >
>;

/** สร้างบริษัทใหม่ — คืน id ของ document ที่สร้าง */
export async function createCompany(params: {
  ownerId: string;
  data: CompanyPatch & { name: string };
}): Promise<string> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  const ref = await addDoc(collection(db, "companies"), {
    ownerId: params.ownerId,
    ...params.data,
    archived: false,
    isDefault: false,
    createdBy: params.ownerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

/** อัปเดตข้อมูลบริษัท */
export async function updateCompany(params: {
  companyId: string;
  patch: CompanyPatch;
}): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");
  await updateDoc(doc(db, "companies", params.companyId), {
    ...params.patch,
    updatedAt: serverTimestamp(),
  });
}

/** เก็บถาวรบริษัท (soft delete) */
export async function archiveCompany(companyId: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");
  await updateDoc(doc(db, "companies", companyId), {
    archived: true,
    updatedAt: serverTimestamp(),
  });
}

/** ลบบริษัทถาวร */
export async function deleteCompany(companyId: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");
  await deleteDoc(doc(db, "companies", companyId));
}
