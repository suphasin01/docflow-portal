"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { Copy, Download, Edit2, Link2, ShieldCheck, Unlink } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import { CompanyHoloCard } from "./company-holo-card";
import { companyCardData, companyCardLink, publicCompanyCardSchema } from "@/lib/company-card";
import { exportCompanyCard } from "@/lib/export-company-card";
import { publishCompanyCard, revokeCompanyCard } from "@/lib/firebase/company-card-sharing";
import { getFirebaseDb } from "@/lib/firebase/client";
import { WORKSPACE_COMPANY_ID } from "@/config/workspace";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Company } from "@/types";

export function CompanyCardPanel({ company, onEdit }: { company: Company; onEdit: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [shareReady, setShareReady] = useState(false);
  const [shareError, setShareError] = useState(false);
  const card = companyCardData(company);

  useEffect(() => {
    if (!sharing) return;
    const db = getFirebaseDb();
    if (!db) return;
    return onSnapshot(doc(db, "companyCardSettings", WORKSPACE_COMPANY_ID), (snapshot) => {
      setShareId(snapshot.exists() ? snapshot.data().shareId : null);
      setShareReady(true);
      setShareError(false);
    }, () => { setShareError(true); setShareReady(false); });
  }, [sharing]);

  async function download() {
    const element = ref.current?.querySelector<HTMLElement>("[data-company-card-image]");
    if (!element) return;
    setExporting(true);
    try { await exportCompanyCard(element); toast.success("บันทึกนามบัตร PNG แล้ว"); }
    catch (error) { console.warn("Company card image export failed", error); toast.error("บันทึกรูปไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { setExporting(false); }
  }

  async function copy(id: string) {
    try { await navigator.clipboard.writeText(companyCardLink(id)); toast.success("คัดลอกลิงก์แล้ว"); }
    catch { toast.info("คัดลอกจากช่องลิงก์ด้านล่างได้เลย"); }
  }

  async function publish() {
    if (!publicCompanyCardSchema.safeParse(card).success) {
      toast.error("ข้อมูลยาวเกินขนาดนามบัตร กรุณาย่อชื่อหรือข้อมูลติดต่อก่อนแชร์");
      return;
    }
    setBusy(true);
    try {
      const id = await publishCompanyCard(card);
      setShareId(id);
      toast.success("เผยแพร่ข้อมูลบนการ์ดแล้ว");
      await copy(id);
    } catch { toast.error("เผยแพร่ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและสิทธิ์"); }
    finally { setBusy(false); }
  }

  async function revoke() {
    setBusy(true);
    try { await revokeCompanyCard(); setShareId(null); toast.success("ปิดลิงก์แล้ว ลิงก์เดิมจะใช้งานไม่ได้"); }
    catch { toast.error("ปิดลิงก์ไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { setBusy(false); }
  }

  return (
    <section className="grid min-w-0 items-center gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(240px,1fr)]">
      <div ref={ref} className="min-w-0 max-w-2xl"><CompanyHoloCard card={card} interactive={!exporting} /></div>
      <div className="max-w-md space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-accent">นามบัตรดิจิทัล</p>
          <h2 className="text-2xl font-semibold tracking-tight">รู้จักเรา ในการ์ดเดียว</h2>
          <p className="text-sm leading-relaxed text-muted">ส่งต่อข้อมูลบริษัทให้ลูกค้าและพาร์ตเนอร์ ด้วยลิงก์ที่เปิดได้ทันที หรือบันทึกเป็นรูปพร้อมใช้งาน</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onPress={() => { setShareReady(false); setShareError(false); setSharing(true); }}><Link2 className="size-4" />แชร์ลิงก์</Button>
          <Button variant="secondary" onPress={download} isPending={exporting}><Download className="size-4" />{exporting ? "กำลังบันทึก…" : "บันทึกรูป"}</Button>
          <Button variant="ghost" onPress={onEdit}><Edit2 className="size-4" />แก้ไขข้อมูลบริษัท</Button>
        </div>
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted"><ShieldCheck className="size-4 shrink-0" />แชร์เฉพาะข้อมูลบนการ์ด ไม่รวมเอกสาร สมาชิก หรือลายเซ็นของบริษัท</p>
      </div>

      <Dialog open={sharing} onOpenChange={(open) => { if (!busy) setSharing(open); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>แชร์นามบัตรบริษัท</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="leading-relaxed text-muted">ทุกคนที่มีลิงก์จะเห็นโลโก้ ชื่อบริษัท เลขผู้เสียภาษี ที่อยู่ โทรศัพท์ และอีเมลตามการ์ดนี้ โดยไม่ต้องเข้าสู่ระบบ</p>
            <p className="rounded-xl bg-surface-secondary p-4">ข้อมูลจะเป็นสำเนา ณ เวลาที่กดเผยแพร่ การแก้ไขบริษัทภายหลังจะไม่เปลี่ยนการ์ดสาธารณะจนกว่าจะกดอัปเดต</p>
            {shareError && <p role="alert" className="text-danger">การแชร์ยังไม่พร้อม กรุณาตรวจสอบการเชื่อมต่อหรืออัปเดตระบบ แล้วเปิดหน้าต่างนี้ใหม่</p>}
            {!shareReady && !shareError && <p role="status">กำลังตรวจสอบลิงก์…</p>}
            {shareId && <div className="space-y-2">
              <label htmlFor="company-share-link" className="font-medium">ลิงก์สาธารณะ</label>
              <input id="company-share-link" readOnly value={companyCardLink(shareId)} onFocus={(event) => event.target.select()} className="w-full min-w-0 rounded-xl bg-field p-3 text-sm text-field-foreground" />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onPress={() => copy(shareId)} isDisabled={busy}><Copy className="size-4" />คัดลอก</Button>
                <Button variant="ghost" className="text-danger" onPress={revoke} isDisabled={busy}><Unlink className="size-4" />ปิดลิงก์</Button>
              </div>
              <p className="text-xs text-muted">ปิดลิงก์แล้วเปิดใหม่จะได้ลิงก์ใหม่ แต่ไม่สามารถเรียกคืนรูปที่ผู้รับบันทึกไว้แล้วได้</p>
            </div>}
            {typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname) && <p className="text-warning">ขณะนี้เปิดบน localhost ลิงก์ใช้ทดสอบในเครื่องเท่านั้น หากส่งให้ภายนอก ให้สร้างลิงก์จากเว็บจริงหลัง deploy</p>}
          </div>
          <DialogFooter><Button variant="secondary" onPress={() => setSharing(false)} isDisabled={busy}>ปิด</Button><Button onPress={publish} isDisabled={!shareReady || busy} isPending={busy}>{shareId ? "อัปเดตข้อมูลที่เผยแพร่" : "เผยแพร่และคัดลอกลิงก์"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
