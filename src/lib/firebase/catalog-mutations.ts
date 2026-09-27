"use client";

import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "./client";
import type { Customer, Vendor, VatType } from "@/types";

export async function addProduct(params: {
  companyId: string;
  userId: string;
  data: {
    name: string;
    sku?: string;
    category?: string;
    unit: string;
    defaultPrice: number;
    cost?: number;
    vatType: VatType;
  };
}) {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");
  await addDoc(collection(db, "products"), {
    companyId: params.companyId,
    ...params.data,
    active: true,
    createdBy: params.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function archiveProduct(params: { productId: string }) {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");
  await updateDoc(doc(db, "products", params.productId), {
    active: false,
    updatedAt: serverTimestamp(),
  });
}

export async function addCustomer(params: {
  companyId: string;
  userId: string;
  data: Omit<
    Customer,
    "companyId" | "createdAt" | "updatedAt" | "createdBy" | "active"
  > & { active?: boolean };
}) {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");
  await addDoc(collection(db, "customers"), {
    companyId: params.companyId,
    ...params.data,
    active: params.data.active ?? true,
    createdBy: params.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function addVendor(params: {
  companyId: string;
  userId: string;
  data: Omit<
    Vendor,
    "companyId" | "createdAt" | "updatedAt" | "createdBy" | "active"
  > & { active?: boolean };
}) {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");
  await addDoc(collection(db, "vendors"), {
    companyId: params.companyId,
    ...params.data,
    active: params.data.active ?? true,
    createdBy: params.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
