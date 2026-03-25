"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { cn } from "@/lib/utils";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem("sidebar-collapsed");
    setCollapsed(raw === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-[#f1f3f6]">
      <AppSidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <div className={cn("min-h-screen transition-[padding] duration-200", collapsed ? "pl-[84px]" : "pl-[260px]")}>
        {children}
      </div>
    </div>
  );
}
