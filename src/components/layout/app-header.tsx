"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  showTrialBanner?: boolean;
  /** ซ่อนแถบหัวทั้งก้อน เหลือเฉพาะพื้นที่ว่างบาง (เช่น หน้าบริษัท) */
  minimal?: boolean;
  titleClassName?: string;
  subtitleClassName?: string;
};

export function AppHeader({
  title,
  subtitle,
  actions,
  showTrialBanner = true,
  minimal = false,
  titleClassName,
  subtitleClassName,
}: AppHeaderProps) {
  if (minimal) {
    return (
      <header className="sticky top-0 z-30 h-14 border-b border-border/80 bg-[#f6f7f9]/95 backdrop-blur supports-[backdrop-filter]:bg-[#f6f7f9]/80" />
    );
  }
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-[#f6f7f9]/95 backdrop-blur supports-[backdrop-filter]:bg-[#f6f7f9]/80">
      {showTrialBanner ? (
        <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-white px-6 py-2 text-xs text-muted-foreground">
          <span>ข้อมูลของคุณแยกตามบริษัท (workspace เดียวต่อผู้ใช้)</span>
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-4">
        <div className="min-w-0">
          {title ? (
            <h1
              className={cn(
                "text-2xl font-semibold tracking-tight text-foreground",
                titleClassName,
              )}
            >
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p
              className={cn(
                "mt-1 text-sm text-muted-foreground",
                subtitleClassName,
              )}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      <Separator className="opacity-60" />
    </header>
  );
}
