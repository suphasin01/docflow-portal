import { LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { SidebarBaseProps } from "./sidebar-types";

type SidebarFooterProps = SidebarBaseProps & {
  onSignOut: () => void;
};

export function SidebarFooter({ collapsed, onSignOut }: SidebarFooterProps) {
  return (
    <div className="mt-auto border-t border-white/10 p-3">
      <Button
        variant="ghost"
        className={cn(
          "mb-1 rounded-xl text-white/80 hover:bg-white/10 hover:text-white",
          collapsed
            ? "w-full justify-center px-2"
            : "w-full justify-start gap-2",
        )}
        type="button"
        title={collapsed ? "ตั้งค่า" : undefined}
      >
        <Settings className="size-4" />
        {!collapsed ? "ตั้งค่า" : null}
      </Button>
      <Button
        variant="ghost"
        className={cn(
          "w-full rounded-xl text-white/80 hover:bg-white/10 hover:text-white",
          collapsed ? "justify-center px-2" : "justify-start gap-2",
        )}
        type="button"
        onClick={onSignOut}
        title={collapsed ? "ออกจากระบบ" : undefined}
      >
        <LogOut className="size-4" />
        {!collapsed ? "ออกจากระบบ" : null}
      </Button>
    </div>
  );
}
