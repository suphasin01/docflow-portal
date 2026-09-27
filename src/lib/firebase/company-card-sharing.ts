"use client";

import { collection, doc, runTransaction } from "firebase/firestore";
import { getFirebaseDb } from "./client";
import { WORKSPACE_COMPANY_ID } from "@/config/workspace";
import { publicCompanyCardSchema, type PublicCompanyCard } from "@/lib/company-card";

export async function publishCompanyCard(card: PublicCompanyCard): Promise<string> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase is not configured");
  const safeCard = publicCompanyCardSchema.parse(card);
  const settings = doc(db, "companyCardSettings", WORKSPACE_COMPANY_ID);
  const fresh = doc(collection(db, "publicCompanyCards"));
  // Serialize concurrent owner actions; never leave orphaned public snapshots.
  return runTransaction(db, async (tx) => {
    const current = await tx.get(settings);
    const id = current.exists() ? current.data().shareId as string : fresh.id;
    tx.set(doc(db, "publicCompanyCards", id), { schemaVersion: 1, card: safeCard });
    tx.set(settings, { shareId: id });
    return id;
  });
}

export async function revokeCompanyCard() {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase is not configured");
  const settings = doc(db, "companyCardSettings", WORKSPACE_COMPANY_ID);
  await runTransaction(db, async (tx) => {
    const current = await tx.get(settings);
    if (current.exists()) tx.delete(doc(db, "publicCompanyCards", current.data().shareId));
    tx.delete(settings);
  });
}
