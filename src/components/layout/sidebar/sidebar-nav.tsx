import Link from "next/link";
import { mainNav } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SidebarBaseProps } from "./sidebar-types";

type SidebarNavProps = SidebarBaseProps & {
  pathname: string;
};

const NAV_GROUPS: string[][] = [
  ["/", "/documents/create", "/documents/history", "/payments"],
  ["/catalog", "/contacts", "/company"],
  ["/reports"],
];

export function SidebarNav({ collapsed, pathname }: SidebarNavProps) {
  const navByHref = new Map(mainNav.map((item) => [item.href, item]));

  return (
    <ScrollArea className={cn("flex-1", collapsed ? "px-1.5" : "px-2")}>
      <nav className="flex flex-col pb-4">
        {NAV_GROUPS.map((group, groupIdx) => (
          <div key={`group-${groupIdx}`} className="flex flex-col gap-0.5">
            {group.map((href) => {
              const item = navByHref.get(href);
              if (!item) return null;
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-xl text-sm font-medium transition-colors",
                    collapsed
                      ? "justify-center px-2 py-2.5"
                      : "gap-3 px-3 py-2.5",
                    active
                      ? "bg-white/12 text-white shadow-sm"
                      : "text-white/75 hover:bg-white/8 hover:text-white",
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="size-[18px] shrink-0 opacity-90" />
                  {!collapsed ? (
                    <span className="truncate">{item.label}</span>
                  ) : null}
                </Link>
              );
            })}
            {groupIdx < NAV_GROUPS.length - 1 ? (
              <div
                className={cn(
                  "my-2 border-white/10",
                  collapsed ? "mx-2 border-t" : "mx-3 border-t",
                )}
              />
            ) : null}
          </div>
        ))}
      </nav>
    </ScrollArea>
  );
}
