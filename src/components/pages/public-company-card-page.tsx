"use client";

import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { Button } from "@heroui/react";
import { Download, Link2Off } from "lucide-react";
import { toast } from "sonner";
import { getFirebaseDb } from "@/lib/firebase/client";
import { companyShareIdPattern, publicCompanyCardSchema, type PublicCompanyCard } from "@/lib/company-card";
import { CompanyHoloCard } from "@/components/business/company-holo-card";
import { exportCompanyCard } from "@/lib/export-company-card";

export function PublicCompanyCardPage() {
  const [card, setCard] = useState<PublicCompanyCard | null>(null);
  const [status, setStatus] = useState("กำลังเปิดนามบัตร…");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id") ?? "";
    const db = getFirebaseDb();
    if (!db || !companyShareIdPattern.test(id)) { setStatus("ลิงก์ไม่ถูกต้องหรือถูกปิดแล้ว"); return; }
    // Read only this public snapshot. No company/document/workspace query.
    return onSnapshot(doc(db, "publicCompanyCards", id), (snapshot) => {
      const result = publicCompanyCardSchema.safeParse(snapshot.data()?.card);
      if (!snapshot.exists() || snapshot.data()?.schemaVersion !== 1 || !result.success) {
        setCard(null); setStatus("ลิงก์ไม่ถูกต้องหรือถูกปิดแล้ว"); return;
      }
      setCard(result.data); setStatus("");
    }, () => { setCard(null); setStatus("เปิดนามบัตรไม่ได้ กรุณาตรวจสอบการเชื่อมต่อหรือติดต่อผู้ส่งลิงก์"); });
  }, []);

  async function download() {
    const element = ref.current?.querySelector<HTMLElement>("[data-company-card-image]");
    if (!element) return;
    setBusy(true);
    try { await exportCompanyCard(element); toast.success("บันทึกรูปแล้ว"); }
    catch { toast.error("บันทึกรูปไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { setBusy(false); }
  }

  return <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10 sm:px-8">
    <h1 className="text-sm font-medium text-muted">Beyond Dev · นามบัตรบริษัท</h1>
    {card ? <>
      <div ref={ref} className="w-full max-w-2xl"><CompanyHoloCard card={card} interactive={!busy} /></div>
      <Button variant="secondary" onPress={download} isPending={busy}><Download className="size-4" />บันทึกรูป</Button>
      <p className="text-center text-xs text-muted">ข้อมูลบริษัทที่ผู้ส่งเผยแพร่ · ไม่มีสิทธิ์เข้าถึงระบบภายใน</p>
    </> : <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl bg-surface p-8 text-center" role="status"><Link2Off className="size-6 text-muted" /><p>{status}</p></div>}
  </main>;
}
