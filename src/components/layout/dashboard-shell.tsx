"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tooltip } from "@heroui/react";
import { AppLayout, Navbar, Sidebar } from "@heroui-pro/react";
import type { ReactNode } from "react";
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
    <Navbar className="glass-toolbar border-b" maxWidth="full">
      <Navbar.Header>
        <AppLayout.MenuToggle tooltip="เปิดเมนู" />
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

  return (
    <AppLayout
      className="bg-transparent"
      navbar={<AppNavbar />}
      sidebar={<AppSidebar />}
      sidebarCollapsible="icon"
      scrollMode="content"
      navigate={(href) => router.push(href)}
    >
      {children}
    </AppLayout>
  );
}
