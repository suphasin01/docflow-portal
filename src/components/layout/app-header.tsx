"use client";

import type { ReactNode } from "react";
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
      <header className="glass-toolbar sticky top-0 z-30 h-14 border-b" />
    );
  }
  return (
    <header className="glass-toolbar relative z-20 border-b lg:sticky lg:top-0">
      {showTrialBanner ? (
        <div className="flex items-center justify-between gap-3 border-b border-separator bg-transparent px-4 py-2 text-xs text-muted-foreground sm:px-6">
          <span>พื้นที่ทำงานแยกตามบริษัท<span className="hidden sm:inline"> · workspace เดียวต่อผู้ใช้</span></span>
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6">
        <div className="min-w-0">
          {title ? (
            <h1
              className={cn(
                "text-xl font-semibold tracking-tight text-foreground sm:text-2xl",
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
          <div className="flex max-w-full flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
