"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchFilterToolbarProps = {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (v: string) => void;
  filters?: ReactNode;
  className?: string;
};

export function SearchFilterToolbar({
  searchPlaceholder = "ค้นหา…",
  searchValue,
  onSearchChange,
  filters,
  className,
}: SearchFilterToolbarProps) {
  return (
    <div
      className={cn(
        "glass-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <Input
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        className="h-10 max-w-md rounded-xl border-border/80 bg-field"
      />
      {filters ? (
        <div className="flex flex-wrap items-center gap-2">{filters}</div>
      ) : null}
    </div>
  );
}
