"use client";

import { useSyncExternalStore } from "react";
import { Button, Dropdown, Label, Separator } from "@heroui/react";
import { Check, Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const THEME_OPTIONS = [
  { id: "light", label: "โหมดสว่าง", icon: Sun },
  { id: "dark", label: "โหมดมืด", icon: Moon },
  { id: "system", label: "ตามระบบ", icon: Laptop },
] as const;

const emptySubscribe = () => () => {};

export function ThemeSwitcher() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const currentTheme = mounted ? (theme ?? "system") : "system";
  const TriggerIcon = mounted && resolvedTheme === "dark" ? Moon : Sun;

  return (
    <Dropdown>
      <Button
        aria-label="เปลี่ยนธีม"
        className="gap-2"
        size="sm"
        variant="ghost"
      >
        <TriggerIcon className="size-4" />
        <span className="hidden sm:inline">ธีม</span>
      </Button>
      <Dropdown.Popover className="min-w-48" placement="bottom end">
        <Dropdown.Menu
          aria-label="เลือกธีมการแสดงผล"
          onAction={(key) => setTheme(String(key))}
        >
          {THEME_OPTIONS.slice(0, 2).map((option) => {
            const Icon = option.icon;
            return (
              <Dropdown.Item
                key={option.id}
                id={option.id}
                textValue={option.label}
              >
                <Icon className="size-4 text-muted" />
                <Label className="flex-1">{option.label}</Label>
                {currentTheme === option.id ? <Check className="size-4" /> : null}
              </Dropdown.Item>
            );
          })}
          <Separator />
          {THEME_OPTIONS.slice(2).map((option) => {
            const Icon = option.icon;
            return (
              <Dropdown.Item
                key={option.id}
                id={option.id}
                textValue={option.label}
              >
                <Icon className="size-4 text-muted" />
                <Label className="flex-1">{option.label}</Label>
                {currentTheme === option.id ? <Check className="size-4" /> : null}
              </Dropdown.Item>
            );
          })}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
