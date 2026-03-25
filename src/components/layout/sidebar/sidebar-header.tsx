import { FileText, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SidebarBaseProps } from "./sidebar-types";

type SidebarHeaderProps = SidebarBaseProps & {
  onToggleCollapsed: () => void;
};

export function SidebarHeader({
  collapsed,
  onToggleCollapsed,
}: SidebarHeaderProps) {
  return (
    <div
      className={cn(
        "group relative flex h-16 items-center",
        collapsed ? "justify-center px-2" : "gap-2 px-4"
      )}
    >
      <div
        className={cn(
          "flex size-9 items-center justify-center rounded-xl bg-white/10 transition-opacity duration-150",
          collapsed ? "group-hover:opacity-0" : ""
        )}
      >
        <FileText className="size-5 text-white" />
      </div>
      {!collapsed ? (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight">DOC FLOW</p>
          <p className="truncate text-xs text-white/60">จัดการเอกสารธุรกิจ</p>
        </div>
      ) : null}
      <button
        type="button"
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
          collapsed
            ? "absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto"
            : "ml-auto"
        )}
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "ขยายเมนูด้านซ้าย" : "ย่อเมนูด้านซ้าย"}
      >
        {collapsed ? (
          <PanelLeftOpen className="size-4" />
        ) : (
          <PanelLeftClose className="size-4" />
        )}
      </button>
    </div>
  );
}
