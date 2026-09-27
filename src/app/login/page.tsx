"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.55h3.24c1.9-1.75 2.98-4.33 2.98-7.42Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.63-2.35l-3.24-2.55c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.63A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.93A6 6 0 0 1 6.08 12c0-.67.12-1.32.31-1.93V7.44H3.04A10 10 0 0 0 2 12c0 1.61.39 3.13 1.04 4.56l3.35-2.63Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.94c1.47 0 2.79.5 3.82 1.5l2.88-2.88A9.67 9.67 0 0 0 12 2a10 10 0 0 0-8.96 5.44l3.35 2.63C7.18 7.7 9.39 5.94 12 5.94Z"
      />
    </svg>
  );
}

function initials(name: string | null, email: string | null) {
  const source = name?.trim() || email?.trim() || "U";
  return source.slice(0, 1).toUpperCase();
}

export default function LoginPage() {
  const {
    user,
    loading,
    firebaseReady,
    accessStatus,
    accessError,
    signInGoogle,
    signOut,
  } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!firebaseReady || loading) return;
    if (user && accessStatus === "approved") router.replace("/");
  }, [accessStatus, firebaseReady, loading, router, user]);

  async function onGoogle() {
    setBusy(true);
    try {
      await signInGoogle();
    } catch (error) {
      console.error(error);
      toast.error("ไม่สามารถเข้าสู่ระบบด้วย Google ได้");
    } finally {
      setBusy(false);
    }
  }

  if (!firebaseReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-md rounded-3xl border-slate-200 shadow-xl shadow-slate-200/50">
          <CardContent className="p-8">
            <h1 className="text-xl font-semibold">ตั้งค่า Firebase</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              ไม่พบ Firebase public config กรุณาตรวจสอบไฟล์ environment
              ของโปรเจกต์
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const waiting = user && (accessStatus === "pending" || accessStatus === "rejected");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f7fb] p-6">
      <div className="pointer-events-none absolute -left-24 -top-28 size-80 rounded-full bg-blue-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 size-96 rounded-full bg-indigo-200/50 blur-3xl" />

      <Card className="relative w-full max-w-md overflow-hidden rounded-[28px] border-white/80 bg-white/95 py-0 shadow-2xl shadow-slate-300/40 backdrop-blur">
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
        <CardContent className="p-8 sm:p-10">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-300">
              <span className="text-lg font-bold">D</span>
            </div>
            <div>
              <div className="text-lg font-bold tracking-[0.12em] text-slate-950">
                DOC FLOW
              </div>
              <div className="text-xs text-slate-500">Business documents, simplified</div>
            </div>
          </div>

          {waiting ? (
            <div className="space-y-6">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                {accessStatus === "pending" ? (
                  <Clock3 className="size-7" />
                ) : (
                  <ShieldCheck className="size-7" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                  {accessStatus === "pending"
                    ? "ส่งคำขอเข้าใช้งานแล้ว"
                    : "คำขอยังไม่ได้รับอนุมัติ"}
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {accessStatus === "pending"
                    ? "ระบบจะแจ้งผู้ดูแลให้ตรวจสอบ เมื่ออนุมัติแล้วหน้านี้จะเข้าสู่ระบบให้อัตโนมัติ"
                    : "กรุณาติดต่อผู้ดูแลระบบ หากต้องการขอสิทธิ์เข้าใช้งานอีกครั้ง"}
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                <Avatar className="size-11">
                  <AvatarImage src={user.photoURL ?? undefined} alt="" />
                  <AvatarFallback>{initials(user.displayName, user.email)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {user.displayName || "Google user"}
                  </div>
                  <div className="truncate text-xs text-slate-500">{user.email}</div>
                </div>
                {accessStatus === "pending" ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                    รออนุมัติ
                  </span>
                ) : null}
              </div>

              {accessError ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                  {accessError}
                </p>
              ) : null}

              <Button
                variant="outline"
                className="h-11 w-full gap-2 rounded-xl"
                onClick={() => void signOut()}
              >
                <LogOut className="size-4" />
                ใช้บัญชีอื่น
              </Button>
            </div>
          ) : (
            <div>
              <div className="mb-8">
                <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
                  <CheckCircle2 className="size-3.5" />
                  Secure workspace
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                  ยินดีต้อนรับ
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  เข้าสู่ระบบเพื่อจัดการเอกสารและข้อมูลธุรกิจในพื้นที่ทำงานของคุณ
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-12 w-full gap-3 rounded-xl border-slate-300 bg-white text-[15px] font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
                onClick={() => void onGoogle()}
                disabled={busy}
              >
                {busy ? (
                  <span className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                ) : (
                  <GoogleLogo />
                )}
                ดำเนินการต่อด้วย Google
              </Button>

              <p className="mt-5 text-center text-xs leading-5 text-slate-400">
                บัญชีใหม่จะส่งคำขอให้ผู้ดูแลอนุมัติก่อนเข้าใช้งาน
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
