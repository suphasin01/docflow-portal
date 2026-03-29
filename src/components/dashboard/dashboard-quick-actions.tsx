"use client";

import Link from "next/link";
import { ClipboardList, FileEdit, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardQuickActions() {
  return (
    <div className="flex flex-wrap gap-3">
      <Link
        href="/documents/create"
        className={cn(
          "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800",
        )}
      >
        <FileEdit className="size-4" />
        สร้างเอกสาร
      </Link>
      <Link
        href="/payments"
        className={cn(
          "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white px-6 text-sm font-medium shadow-sm transition-colors hover:bg-muted/50",
        )}
      >
        <Wallet className="size-4" />
        ติดตามชำระเงิน
      </Link>
      <Link
        href="/documents/history"
        className={cn(
          "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white px-6 text-sm font-medium shadow-sm transition-colors hover:bg-muted/50",
        )}
      >
        <ClipboardList className="size-4" />
        ประวัติเอกสาร
      </Link>
    </div>
  );
}
