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
import type { CatalogFormValues } from "@/lib/schemas/catalog";
import { resolveVatRate } from "@/lib/schemas/catalog";

/** คำนวณรหัสถัดไปของสินค้า/บริการในบริษัทนั้น (P0001, P0002, ...) */
export async function getNextProductCode(
  companyId: string
): Promise<{ code: string; codeNumber: number }> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  const q = query(
    collection(db, "products"),
    where("companyId", "==", companyId),
    orderBy("codeNumber", "desc"),
    limit(1)
  );
  const snap = await getDocs(q);
  const latestNum = (snap.docs[0]?.data()?.codeNumber as number | undefined) ?? 0;
  const next = latestNum + 1;
  return {
    code: `P${String(next).padStart(4, "0")}`,
    codeNumber: next,
  };
}

/** สร้างสินค้า/บริการใหม่ */
export async function addCatalogItem(params: {
  companyId: string;
  userId: string;
  code: string;
  codeNumber: number;
  data: CatalogFormValues;
}): Promise<string> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  const { data, companyId, userId, code, codeNumber } = params;
  const vatRate = resolveVatRate(data.vatType, data.customVatRate);

  const ref = await addDoc(collection(db, "products"), {
    companyId,
    code,
    codeNumber,
    itemType: data.itemType,
    name: data.name.trim(),
    description: data.description?.trim() ?? "",
    unit: data.unit?.trim() ?? "",
    salePrice: data.salePrice,
    costPrice: data.costPrice ?? 0,
    vatType: data.vatType,
    customVatRate: vatRate,
    isArchived: false,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** อัปเดตสินค้า/บริการ */
export async function updateCatalogItem(params: {
  itemId: string;
  data: CatalogFormValues;
}): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  const { data, itemId } = params;
  const vatRate = resolveVatRate(data.vatType, data.customVatRate);

  await updateDoc(doc(db, "products", itemId), {
    itemType: data.itemType,
    name: data.name.trim(),
    description: data.description?.trim() ?? "",
    unit: data.unit?.trim() ?? "",
    salePrice: data.salePrice,
    costPrice: data.costPrice ?? 0,
    vatType: data.vatType,
    customVatRate: vatRate,
    updatedAt: serverTimestamp(),
  });
}

/** soft delete */
export async function archiveCatalogItem(itemId: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");
  await updateDoc(doc(db, "products", itemId), {
    isArchived: true,
    updatedAt: serverTimestamp(),
  });
}
