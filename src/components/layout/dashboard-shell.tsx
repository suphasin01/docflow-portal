"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tooltip } from "@heroui/react";
import { AppLayout, Navbar, Sidebar } from "@heroui-pro/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { ThemeSwitcher } from "./theme-switcher";
import { mainNav } from "@/lib/navigation";

const ROUTE_TITLES: Record<string, string> = {
  "/documents/detail": "รายละเอียดเอกสาร",
  "/settings": "ตั้งค่า",
};

function currentTitle(pathname: string) {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  return (
    [...mainNav]
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) =>
        item.href === "/"
          ? pathname === "/"
          : pathname.startsWith(item.href),
      )?.label ?? "Beyond Doc"
  );
}

function AppNavbar() {
  const pathname = usePathname();

  return (
    <Navbar className="glass-toolbar border-0" maxWidth="full">
      <Navbar.Header className="gap-2 px-4 sm:gap-4 sm:px-6">
        <AppLayout.MenuToggle aria-label="เปิดเมนู" tooltip="เปิดเมนู" />
        <Tooltip delay={0}>
          <Sidebar.Trigger aria-label="ย่อหรือขยายเมนู" />
          <Tooltip.Content placement="bottom">
            ย่อหรือขยายเมนู
          </Tooltip.Content>
        </Tooltip>
        <span className="truncate text-sm font-semibold">
          {currentTitle(pathname)}
        </span>
        <Navbar.Spacer />
        <ThemeSwitcher />
      </Navbar.Header>
    </Navbar>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The workspace scrolls inside main, not the window managed by Next.js.
    contentRef.current?.closest("main")?.scrollTo({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    // Keep HeroUI's native mobile drawer; reserve more workspace on tablets.
    const compact = window.matchMedia("(max-width: 1024px)");
    const update = () => setSidebarOpen(!compact.matches);
    update();
    compact.addEventListener("change", update);
    return () => compact.removeEventListener("change", update);
  }, []);

  return (
    <AppLayout
      className="workspace-layout bg-transparent"
      navbar={<AppNavbar />}
      sidebar={<AppSidebar />}
      sidebarCollapsible="icon"
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={setSidebarOpen}
      scrollMode="content"
      navigate={(href) => router.push(href)}
    >
      <div ref={contentRef} key={pathname} className="page-enter min-w-0">{children}</div>
    </AppLayout>
  );
}
