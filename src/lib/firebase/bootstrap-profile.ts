"use client";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { WORKSPACE_COMPANY_ID } from "@/config/workspace";
import { getFirebaseDb } from "./client";
import type { Company } from "@/types";

/** All approved accounts use the existing workspace. Never create a fallback company. */
export async function bootstrapUserCompanies(user: User): Promise<(Company & { id: string })[]> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");
  const company = await getDoc(doc(db, "companies", WORKSPACE_COMPANY_ID));
  if (!company.exists() || company.data().archived === true) {
    throw new Error("ไม่พบ workspace กลาง Beyond Dev กรุณาติดต่อผู้ดูแล");
  }
  await setDoc(doc(db, "users", user.uid), {
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return [{ ...company.data(), id: company.id } as Company & { id: string }];
}

export async function ensureUserCompanyProfile(user: User): Promise<string> {
  await bootstrapUserCompanies(user);
  return WORKSPACE_COMPANY_ID;
}
