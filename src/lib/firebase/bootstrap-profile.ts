"use client";

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebaseDb } from "./client";
import type { Company, UserProfile } from "@/types";

type CompanyWithId = Company & { id: string };

/**
 * Bootstrap หลัง login:
 * 1. สร้าง/อัปเดต user profile ใน /users/{uid}
 * 2. ดึง companies ที่ ownerId == user.uid และ archived == false
 * 3. ถ้าไม่มีเลย → สร้างบริษัทเริ่มต้น "บริษัทของฉัน" พร้อม settings
 * 4. คืน companies ทั้งหมด
 */
export async function bootstrapUserCompanies(
  user: User,
): Promise<CompanyWithId[]> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  // 1. upsert user profile
  const userRef = doc(db, "users", user.uid);
  await setDoc(
    userRef,
    {
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  // 2. โหลด companies ที่ user เป็นเจ้าของ
  //    ต้องมี composite index: ownerId ASC + archived ASC ใน firestore.indexes.json
  const q = query(
    collection(db, "companies"),
    where("ownerId", "==", user.uid),
    where("archived", "==", false),
  );
  const snap = await getDocs(q);
  let companies: CompanyWithId[] = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Company),
  }));

  // 3. ถ้ายังไม่มีบริษัทเลย → สร้างบริษัท default
  if (companies.length === 0) {
    const companyRef = doc(collection(db, "companies"));

    const defaultCompanyData = {
      ownerId: user.uid,
      name: "บริษัทของฉัน",
      nameEn: "",
      officeType: "none" as const,
      taxId: "",
      phone: "",
      email: user.email ?? "",
      address: "",
      signerName: "",
      signerPosition: "",
      logoUrl: "",
      isDefault: true,
      archived: false,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // ขั้นที่ 1: สร้าง company ก่อน
    // (ต้องแยก settings ออก เพราะ settings rule ใช้ get(company) ซึ่ง
    //  ยังไม่ exist ถ้า commit พร้อมกันใน batch เดียว)
    await setDoc(companyRef, defaultCompanyData);

    // ขั้นที่ 2: สร้าง settings หลัง company ถูก commit แล้ว
    try {
      await setDoc(doc(db, "settings", companyRef.id), {
        companyId: companyRef.id,
        // legacy fields
        currency: "THB",
        vatRateDefault: 7,
        docNumberPrefixes: {
          quotation: "QT",
          invoice: "INV",
          receipt: "RCP",
          purchase_order: "PO",
          billing_note: "BN",
        },
        // document settings
        defaultVatRate: 7,
        defaultWithholdingTaxRate: 3,
        documentNumberDateFormat: "TH_YYMM",
        documentRunningDigits: 4,
        documentNumberSeparator: "-",
        deletedNumberBehavior: "continue_max",
        documentDisplayDateFormat: "TH_SHORT_BE",
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (settingsErr) {
      // settings ไม่ได้ critical — log แล้วไปต่อ
      console.warn("สร้าง settings ไม่สำเร็จ:", settingsErr);
    }

    companies = [
      { id: companyRef.id, ...(defaultCompanyData as unknown as Company) },
    ];
  }

  return companies;
}

/** เดิม — backward compat wrapper (ไม่ใช้ในโค้ดใหม่) */
export async function ensureUserCompanyProfile(user: User): Promise<string> {
  const companies = await bootstrapUserCompanies(user);
  return companies.find((c) => c.isDefault)?.id ?? companies[0]!.id;
}
