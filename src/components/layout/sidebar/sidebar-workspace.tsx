"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { useCompanyStore } from "@/stores/company-store";
import type { SidebarBaseProps } from "./sidebar-types";

export function SidebarWorkspace({ collapsed }: SidebarBaseProps) {
  const company = useCompanyStore((s) => s.companies[0]);
  return (
    <Link href="/company" title="ข้อมูลบริษัท Beyond Dev"
      className="flex items-center gap-2 rounded-xl p-3 text-foreground">
      <Building2 className="size-5 shrink-0" />
      {!collapsed && <span className="truncate">{company?.name ?? "Beyond Dev"}</span>}
    </Link>
  );
}
