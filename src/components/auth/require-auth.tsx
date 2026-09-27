"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button, Card, Spinner } from "@heroui/react";
import { useCompanyStore } from "@/stores/company-store";
import { useAuth } from "@/components/providers/auth-provider";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { sessionPhase } = useAuth();
  const { activeCompanyId, workspaceError } = useCompanyStore();
  const router = useRouter();

  useEffect(() => {
    if (
      sessionPhase === "signed_out" ||
      sessionPhase === "pending" ||
      sessionPhase === "rejected"
    ) {
      router.replace("/login");
    }
  }, [router, sessionPhase]);

  if (sessionPhase === "unconfigured") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-secondary p-6">
        <Card className="w-full max-w-md">
          <Card.Content className="p-8">
            <h1 className="text-xl font-semibold">ตั้งค่า Firebase</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              ยังไม่ได้ตั้งค่า Firebase กรุณาเพิ่มค่าในไฟล์{" "}
              <code className="rounded bg-default px-1.5 py-0.5">.env.local</code>
            </p>
          </Card.Content>
        </Card>
      </div>
    );
  }

  if (sessionPhase !== "approved") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-secondary">
        <Spinner size="lg" />
        <p className="text-sm text-muted-foreground">กำลังตรวจสอบ session…</p>
      </div>
    );
  }

  if (workspaceError) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <Card.Header>
            <Card.Title>ยังเชื่อมต่อพื้นที่ทำงานไม่ได้</Card.Title>
            <Card.Description>{workspaceError}</Card.Description>
          </Card.Header>
          <Card.Content><p className="text-sm text-muted">ระบบจะไม่สร้างบริษัทใหม่แทนข้อมูลเดิม</p></Card.Content>
          <Card.Footer><Button onPress={() => window.location.reload()}>ลองอีกครั้ง</Button></Card.Footer>
        </Card>
      </main>
    );
  }
  if (!activeCompanyId) {
    return <main className="flex min-h-screen items-center justify-center gap-3"><Spinner /><span>กำลังโหลดพื้นที่ทำงาน Beyond Dev…</span></main>;
  }
  return <>{children}</>;
}
