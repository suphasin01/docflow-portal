"use client";

import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { WORKSPACE_COMPANY_ID } from "@/config/workspace";
import { getFirebaseDb } from "./client";
import type { Company } from "@/types";

type CompanyPatch = Partial<Pick<Company,
  "name" | "nameEn" | "officeType" | "taxId" | "branch" | "branchName" |
  "branchCode" | "address" | "phone" | "email" | "logoUrl" | "signerName" | "signerPosition"
>>;

/** Edit the existing workspace profile; no company creation or archival. */
export async function updateCompany(params: { companyId: string; patch: CompanyPatch }): Promise<void> {
  if (params.companyId !== WORKSPACE_COMPANY_ID) throw new Error("แก้ไขได้เฉพาะ workspace กลาง Beyond Dev");
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");
  await updateDoc(doc(db, "companies", WORKSPACE_COMPANY_ID), {
    ...params.patch, updatedAt: serverTimestamp(),
  });
}
