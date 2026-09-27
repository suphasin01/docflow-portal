"use client";

import Link from "next/link";
import { ClipboardList, FileEdit, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardQuickActions() {
  return (
    <div className="flex flex-wrap gap-3 [&>a]:focus-visible:outline-2 [&>a]:focus-visible:outline-offset-4 [&>a]:focus-visible:outline-focus">
      <Link
        href="/documents/create"
        className={cn(
          "quick-action inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-6 text-sm font-medium text-accent-foreground hover:bg-accent-hover",
        )}
      >
        <FileEdit className="size-4" />
        สร้างเอกสาร
      </Link>
      <Link
        href="/payments"
        className={cn(
          "quick-action glass-surface inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-6 text-sm font-medium hover:bg-surface-hover",
        )}
      >
        <Wallet className="size-4" />
        ติดตามชำระเงิน
      </Link>
      <Link
        href="/documents/history"
        className={cn(
          "quick-action glass-surface inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-6 text-sm font-medium hover:bg-surface-hover",
        )}
      >
        <ClipboardList className="size-4" />
        ประวัติเอกสาร
      </Link>
    </div>
  );
}
