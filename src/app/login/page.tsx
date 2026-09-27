"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, Card, Chip, Spinner } from "@heroui/react";
import { CheckCircle2, Clock3, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";

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

function firebaseAuthErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return null;
}

function isDismissedGooglePopup(error: unknown) {
  const code = firebaseAuthErrorCode(error);
  return (
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request"
  );
}

export default function LoginPage() {
  const {
    user,
    sessionPhase,
    accessError,
    signInGoogle,
    signOut,
    refreshAccess,
    requestAccess,
  } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<
    "google" | "signout" | "refresh" | "request" | null
  >(null);

  useEffect(() => {
    if (sessionPhase === "approved") router.replace("/");
  }, [router, sessionPhase]);

  async function run(
    action: NonNullable<typeof busy>,
    task: () => Promise<void>,
    failureMessage: string,
  ) {
    setBusy(action);
    try {
      await task();
    } catch (error) {
      // การปิดหน้าต่างเลือกบัญชีเป็นการยกเลิกตามปกติ ไม่ใช่ข้อผิดพลาด
      // และไม่ควรส่ง Error object เข้า console.error เพราะ Next Dev Overlay
      // จะยกขึ้นเป็น error เต็มหน้าจอ
      if (action === "google" && isDismissedGooglePopup(error)) return;

      if (
        action === "google" &&
        firebaseAuthErrorCode(error) === "auth/popup-blocked"
      ) {
        toast.error("เบราว์เซอร์บล็อกหน้าต่าง Google กรุณาอนุญาต pop-up แล้วลองใหม่");
        return;
      }

      console.error(error);
      toast.error(failureMessage);
    } finally {
      setBusy(null);
    }
  }

  if (sessionPhase === "unconfigured") {
    return (
      <AuthFrame>
        <Card className="glass-surface w-full max-w-md">
          <Card.Content className="p-8">
            <h1 className="text-xl font-semibold">ตั้งค่า Firebase</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              ไม่พบ Firebase public config กรุณาตรวจสอบ environment ของโปรเจกต์
            </p>
          </Card.Content>
        </Card>
      </AuthFrame>
    );
  }

  const isChecking =
    sessionPhase === "initializing" ||
    sessionPhase === "checking" ||
    sessionPhase === "approved";
  const isWaiting = sessionPhase === "pending" || sessionPhase === "rejected";

  return (
    <AuthFrame>
      <Card className="glass-surface w-full max-w-md overflow-visible">
        <Card.Content className="p-8 sm:p-10">
          <Brand />

          {isChecking ? (
            <div className="flex min-h-56 flex-col items-center justify-center text-center">
              <Spinner size="lg" />
              <h1 className="mt-6 text-xl font-semibold">กำลังเตรียมพื้นที่ทำงาน</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                ตรวจสอบบัญชีและสิทธิ์เข้าใช้งานเพียงครู่เดียว
              </p>
            </div>
          ) : null}

          {isWaiting && user ? (
            <div className="space-y-6">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-surface-secondary">
                {sessionPhase === "pending" ? (
                  <Clock3 className="size-6 text-warning" />
                ) : (
                  <ShieldCheck className="size-6 text-danger" />
                )}
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {sessionPhase === "pending"
                    ? "รอผู้ดูแลอนุมัติ"
                    : "ยังไม่มีสิทธิ์เข้าใช้งาน"}
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {sessionPhase === "pending"
                    ? "หน้านี้จะพาเข้าสู่ระบบให้อัตโนมัติทันทีที่ได้รับอนุมัติ"
                    : "ส่งคำขอใหม่ได้จากหน้านี้โดยไม่ต้องออกจากระบบก่อน"}
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-surface-secondary p-3">
                <Avatar>
                  {user.photoURL ? (
                    <Avatar.Image src={user.photoURL} alt={user.displayName ?? "บัญชี Google"} />
                  ) : null}
                  <Avatar.Fallback>
                    {initials(user.displayName, user.email)}
                  </Avatar.Fallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {user.displayName || "Google user"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                </div>
                <Chip
                  color={sessionPhase === "pending" ? "warning" : "danger"}
                  size="sm"
                  variant="soft"
                >
                  <Chip.Label>
                    {sessionPhase === "pending" ? "รออนุมัติ" : "ยังไม่อนุมัติ"}
                  </Chip.Label>
                </Chip>
              </div>

              {accessError ? (
                <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground">
                  {accessError}
                </p>
              ) : null}

              <div className="grid gap-2">
                {sessionPhase === "pending" ? (
                  <Button
                    fullWidth
                    variant="secondary"
                    isPending={busy === "refresh"}
                    onPress={() =>
                      void run("refresh", refreshAccess, "ตรวจสอบสิทธิ์ไม่สำเร็จ")
                    }
                  >
                    <RefreshCw className="size-4" />
                    ตรวจสอบอีกครั้ง
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    isPending={busy === "request"}
                    onPress={() =>
                      void run("request", requestAccess, "ส่งคำขอใหม่ไม่สำเร็จ")
                    }
                  >
                    ส่งคำขอใหม่
                  </Button>
                )}
                <Button
                  fullWidth
                  variant="ghost"
                  isPending={busy === "signout"}
                  onPress={() =>
                    void run("signout", signOut, "ออกจากระบบไม่สำเร็จ")
                  }
                >
                  <LogOut className="size-4" />
                  ใช้บัญชีอื่น
                </Button>
              </div>
            </div>
          ) : null}

          {sessionPhase === "signed_out" ? (
            <div>
              <Chip color="success" size="sm" variant="soft">
                <CheckCircle2 className="size-3.5" />
                <Chip.Label>พื้นที่ทำงานปลอดภัย</Chip.Label>
              </Chip>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight">
                ยินดีต้อนรับ
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                จัดการเอกสาร ข้อมูลธุรกิจ และทีมของคุณในที่เดียว
              </p>

              {accessError ? (
                <p className="mt-5 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground">
                  {accessError}
                </p>
              ) : null}

              <Button
                className={accessError ? "mt-4" : "mt-8"}
                fullWidth
                size="lg"
                variant="outline"
                isPending={busy === "google"}
                onPress={() =>
                  void run(
                    "google",
                    signInGoogle,
                    "ไม่สามารถเข้าสู่ระบบด้วย Google ได้",
                  )
                }
              >
                <GoogleLogo />
                ดำเนินการต่อด้วย Google
              </Button>

              <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
                  บัญชีใหม่ต้องได้รับอนุมัติจากเจ้าของร่วมก่อนเข้าใช้งาน
              </p>
            </div>
          ) : null}
        </Card.Content>
      </Card>
    </AuthFrame>
  );
}

function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-transparent p-6">
      <div className="absolute right-4 top-4">
        <ThemeSwitcher />
      </div>
      {children}
    </main>
  );
}

function Brand() {
  return (
    <div className="mb-8 flex flex-col items-start gap-3">
      {/* Keep the original brand colors legible in both themes. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/beyonddev-logo.png"
        alt="Beyond Dev Tech Solution"
        width={917}
        height={338}
        className="h-auto w-44 max-w-full rounded-lg bg-white p-2"
      />
      <div>
        <div className="text-base font-semibold tracking-tight">Beyond Doc</div>
        <div className="text-xs text-muted-foreground">Business documents, simplified</div>
      </div>
    </div>
  );
}
