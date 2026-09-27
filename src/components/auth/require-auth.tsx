"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, firebaseReady, accessStatus } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!firebaseReady || loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (accessStatus !== "approved") {
      router.replace("/login");
    }
  }, [accessStatus, firebaseReady, loading, router, user]);

  if (!firebaseReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f1f3f6] p-6">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-border/80 bg-white p-8 shadow-sm">
          <Skeleton className="h-8 w-48" />
          <p className="text-sm text-muted-foreground">
            ยังไม่ได้ตั้งค่า Firebase กรุณาเพิ่มค่าในไฟล์{" "}
            <code className="rounded bg-muted px-1">.env.local</code>
          </p>
        </div>
      </div>
    );
  }

  if (loading || !user || accessStatus !== "approved") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f1f3f6]">
        <div className="w-full max-w-lg space-y-4 p-6">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
