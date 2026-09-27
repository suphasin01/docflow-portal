"use client";

import { usePathname, useRouter } from "next/navigation";
import { Avatar, Button, Dropdown, Label, Separator, Spinner } from "@heroui/react";
import { Sidebar } from "@heroui-pro/react";
import {
  Building2,
  Check,
  ChevronDown,
  FileText,
  LogOut,
  Plus,
  Settings,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { mainNav } from "@/lib/navigation";
import { useCompanyStore } from "@/stores/company-store";

const NAV_GROUPS = [
  {
    label: "ภาพรวม",
    hrefs: ["/", "/documents/create", "/documents/history", "/payments"],
  },
  {
    label: "ข้อมูลธุรกิจ",
    hrefs: ["/catalog", "/contacts", "/company", "/users"],
  },
  { label: "วิเคราะห์", hrefs: ["/reports"] },
];

function isCurrentPath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Brand() {
  return (
    <div className="flex w-full items-center gap-3 px-1 py-2">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <FileText className="size-4" />
      </div>
      <div className="min-w-0" data-sidebar="label">
        <div className="truncate text-sm font-semibold">Beyond Doc</div>
        <div className="truncate text-xs text-muted-foreground">จัดการเอกสารธุรกิจ</div>
      </div>
    </div>
  );
}

function WorkspaceMenu() {
  const router = useRouter();
  const companies = useCompanyStore((state) => state.companies);
  const activeCompanyId = useCompanyStore((state) => state.activeCompanyId);
  const setActiveCompanyId = useCompanyStore(
    (state) => state.setActiveCompanyId,
  );
  const companiesLoading = useCompanyStore((state) => state.companiesLoading);
  const activeCompany = companies.find((company) => company.id === activeCompanyId);

  return (
    <Dropdown>
      <Button
        fullWidth
        className="h-auto justify-start px-2 py-2"
        variant="ghost"
        aria-label="เลือกบริษัท"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-surface-secondary">
          {activeCompany?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeCompany.logoUrl}
              alt=""
              className="size-8 rounded-xl object-cover"
            />
          ) : (
            <Building2 className="size-4 text-muted-foreground" />
          )}
        </span>
        <span className="min-w-0 flex-1 text-left" data-sidebar="label">
          <span className="block truncate text-sm font-medium">
            {companiesLoading
              ? "กำลังโหลดบริษัท…"
              : (activeCompany?.name ?? "บริษัทของฉัน")}
          </span>
          <span className="block truncate text-xs text-muted-foreground">พื้นที่ทำงาน</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" data-sidebar="label" />
      </Button>
      <Dropdown.Popover className="min-w-64" placement="bottom start">
        <Dropdown.Menu
          aria-label="เลือกพื้นที่ทำงาน"
          onAction={(key) => {
            const action = String(key);
            if (action.startsWith("company:")) {
              setActiveCompanyId(action.slice("company:".length));
              return;
            }
            if (action === "manage") router.push("/company");
            if (action === "create") router.push("/company?action=create");
          }}
        >
          {companiesLoading ? (
            <Dropdown.Item id="loading" isDisabled textValue="กำลังโหลดบริษัท">
              <Spinner size="sm" />
              <Label>กำลังโหลดบริษัท</Label>
            </Dropdown.Item>
          ) : null}
          {companies.map((company) => (
            <Dropdown.Item
              key={company.id}
              id={`company:${company.id}`}
              textValue={company.name}
            >
              <Building2 className="size-4 text-muted-foreground" />
              <Label className="min-w-0 flex-1 truncate">{company.name}</Label>
              {company.id === activeCompanyId ? (
                <Check className="size-4 text-primary" />
              ) : null}
            </Dropdown.Item>
          ))}
          <Separator />
          <Dropdown.Item id="manage" textValue="จัดการบริษัท">
            <Settings className="size-4 text-muted-foreground" />
            <Label>จัดการบริษัท</Label>
          </Dropdown.Item>
          <Dropdown.Item id="create" textValue="เพิ่มบริษัท">
            <Plus className="size-4 text-muted-foreground" />
            <Label>เพิ่มบริษัท</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function Navigation() {
  const pathname = usePathname();
  const { accessRole } = useAuth();
  const navByHref = new Map(mainNav.map((item) => [item.href, item]));

  return (
    <>
      {NAV_GROUPS.map((group) => (
        <Sidebar.Group key={group.label}>
          <Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>
          <Sidebar.Menu aria-label={group.label}>
            {group.hrefs.map((href) => {
              const item = navByHref.get(href);
              if (!item || (item.adminOnly && accessRole !== "admin")) {
                return null;
              }
              const Icon = item.icon;
              return (
                <Sidebar.MenuItem
                  key={item.href}
                  href={item.href}
                  id={item.href}
                  isCurrent={isCurrentPath(pathname, item.href)}
                  textValue={item.label}
                  tooltip={item.label}
                >
                  <Sidebar.MenuIcon>
                    <Icon />
                  </Sidebar.MenuIcon>
                  <Sidebar.MenuLabel>{item.label}</Sidebar.MenuLabel>
                </Sidebar.MenuItem>
              );
            })}
          </Sidebar.Menu>
        </Sidebar.Group>
      ))}
    </>
  );
}

function UserMenu() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const fallback = (user?.displayName || user?.email || "U")
    .trim()
    .slice(0, 1)
    .toUpperCase();

  return (
    <Dropdown>
      <Button
        fullWidth
        className="h-auto justify-start px-2 py-2"
        variant="ghost"
        aria-label="เมนูบัญชีผู้ใช้"
      >
        <Avatar size="sm">
          {user?.photoURL ? (
            <Avatar.Image src={user.photoURL} alt={user.displayName ?? "ผู้ใช้"} />
          ) : null}
          <Avatar.Fallback>{fallback}</Avatar.Fallback>
        </Avatar>
        <span className="min-w-0 flex-1 text-left" data-sidebar="label">
          <span className="block truncate text-sm font-medium">
            {user?.displayName || "บัญชีผู้ใช้"}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" data-sidebar="label" />
      </Button>
      <Dropdown.Popover className="min-w-56" placement="top start">
        <Dropdown.Menu
          aria-label="เมนูบัญชี"
          onAction={(key) => {
            if (key === "settings") router.push("/settings");
            if (key === "signout") void signOut();
          }}
        >
          <Dropdown.Item id="settings" textValue="ตั้งค่า">
            <Settings className="size-4 text-muted-foreground" />
            <Label>ตั้งค่า</Label>
          </Dropdown.Item>
          <Separator />
          <Dropdown.Item id="signout" textValue="ออกจากระบบ">
            <LogOut className="size-4 text-muted-foreground" />
            <Label>ออกจากระบบ</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function SidebarContents() {
  return (
    <>
      <Sidebar.Header>
        <Brand />
        <WorkspaceMenu />
      </Sidebar.Header>
      <Sidebar.Content>
        <Navigation />
      </Sidebar.Content>
      <Sidebar.Footer>
        <UserMenu />
      </Sidebar.Footer>
    </>
  );
}

export function AppSidebar() {
  return (
    <>
      <Sidebar>
        <SidebarContents />
        <Sidebar.Rail />
      </Sidebar>
      <Sidebar.Mobile>
        <SidebarContents />
      </Sidebar.Mobile>
    </>
  );
}
