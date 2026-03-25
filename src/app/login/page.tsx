"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ALLOWED_EMAIL = "saksitpz1011@gmail.com";

export default function LoginPage() {
  const { user, loading, firebaseReady, signInGoogle, signOut } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!firebaseReady || loading) return;
    if (!user) return;

    if (user.email !== ALLOWED_EMAIL) {
      void signOut();
      toast.error("บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานระบบ");
      return;
    }

    router.replace("/");
  }, [firebaseReady, loading, router, signOut, user]);

  if (!firebaseReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f1f3f6] p-6">
        <Card className="w-full max-w-md rounded-2xl border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">ตั้งค่า Firebase</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            คัดลอกค่าจาก Firebase Console ไปที่{" "}
            <code className="rounded bg-muted px-1">.env.local</code>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function onGoogle() {
    setBusy(true);
    try {
      await signInGoogle();
    } catch (e) {
      console.error(e);
      toast.error("ไม่สามารถเข้าสู่ระบบด้วย Google ได้");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f1f3f6] p-6">
      <Card className="w-full max-w-sm rounded-2xl border-border/80 bg-white shadow-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-2xl font-semibold">DOC FLOW</CardTitle>
          <p className="text-sm text-muted-foreground">
            เข้าสู่ระบบเพื่อจัดการเอกสารธุรกิจของคุณ
          </p>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            className="h-11 w-full rounded-xl"
            onClick={() => void onGoogle()}
            disabled={busy || loading}
          >
            เข้าสู่ระบบด้วย Google
          </Button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            เฉพาะบัญชีที่ได้รับอนุญาตเท่านั้น
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
