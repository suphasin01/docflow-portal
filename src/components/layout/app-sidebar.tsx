"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { SidebarFooter } from "./sidebar/sidebar-footer";
import { SidebarHeader } from "./sidebar/sidebar-header";
import { SidebarNav } from "./sidebar/sidebar-nav";
import { SidebarWorkspace } from "./sidebar/sidebar-workspace";

const SIDEBAR_BG = "bg-[#0c1a2e]";

type AppSidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export function AppSidebar({ collapsed, onToggleCollapsed }: AppSidebarProps) {
  const pathname = usePathname();
  const { signOut } = useAuth();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/10 text-white",
        SIDEBAR_BG,
        collapsed ? "w-[84px]" : "w-[260px]",
      )}
    >
      <SidebarHeader
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
      />
      <SidebarWorkspace collapsed={collapsed} />
      <SidebarNav collapsed={collapsed} pathname={pathname} />
      <SidebarFooter collapsed={collapsed} onSignOut={() => void signOut()} />
    </aside>
  );
}
