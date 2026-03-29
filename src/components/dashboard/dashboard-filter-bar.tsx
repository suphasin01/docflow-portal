"use client";

import type { ReactNode } from "react";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DASHBOARD_PRESET_LABELS,
  type DashboardDatePreset,
  type DashboardFlowFilter,
} from "@/lib/dashboard/dashboard-analytics";
import { DOC_TYPE_CONFIG, type ExtDocType } from "@/lib/doc-types";
import { cn } from "@/lib/utils";
import type { DocumentType } from "@/types";

const DATE_PRESETS: DashboardDatePreset[] = [
  "today",
  "this_week",
  "this_month",
  "last_3m",
  "this_year",
  "custom",
];

type Props = {
  datePreset: DashboardDatePreset;
  onDatePresetChange: (p: DashboardDatePreset) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
  flow: DashboardFlowFilter;
  onFlowChange: (f: DashboardFlowFilter) => void;
  docType: DocumentType | "all";
  onDocTypeChange: (t: DocumentType | "all") => void;
  existingTypes: DocumentType[];
  seedButton?: ReactNode;
};

export function DashboardFilterBar({
  datePreset,
  onDatePresetChange,
  customFrom,
  customTo,
  onCustomChange,
  flow,
  onFlowChange,
  docType,
  onDocTypeChange,
  existingTypes,
  seedButton,
}: Props) {
  return (
    <div className="rounded-2xl border border-border/80 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="size-4 shrink-0 text-muted-foreground" />
            {DATE_PRESETS.map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={datePreset === key ? "default" : "secondary"}
                className={cn(
                  "rounded-full px-3.5",
                  datePreset === key &&
                    "bg-slate-900 text-white hover:bg-slate-900",
                )}
                onClick={() => onDatePresetChange(key)}
              >
                {DASHBOARD_PRESET_LABELS[key]}
              </Button>
            ))}
          </div>
          {datePreset === "custom" ? (
            <div className="flex flex-wrap items-center gap-2 pl-6">
              <Input
                type="date"
                className="h-9 w-[150px] rounded-xl text-sm"
                value={customFrom}
                onChange={(e) => onCustomChange(e.target.value, customTo)}
              />
              <span className="text-sm text-muted-foreground">ถึง</span>
              <Input
                type="date"
                className="h-9 w-[150px] rounded-xl text-sm"
                value={customTo}
                onChange={(e) => onCustomChange(customFrom, e.target.value)}
              />
            </div>
          ) : null}

          <Tabs
            value={flow}
            onValueChange={(v) => {
              if (v === "income" || v === "expense") {
                onFlowChange(v);
                onDocTypeChange("all");
              }
            }}
          >
            <TabsList className="h-9 rounded-xl bg-slate-100/90 p-1">
              <TabsTrigger
                value="income"
                className="rounded-lg px-4 text-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white"
              >
                รายรับ
              </TabsTrigger>
              <TabsTrigger
                value="expense"
                className="rounded-lg px-4 text-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white"
              >
                รายจ่าย
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end lg:w-auto lg:shrink-0">
          <label className="flex min-w-[220px] flex-col gap-1.5 text-xs font-medium text-muted-foreground">
            ประเภทเอกสาร
            <select
              className="h-10 rounded-xl border border-border bg-white px-3 text-sm text-foreground shadow-sm"
              value={docType}
              onChange={(e) => {
                const v = e.target.value;
                onDocTypeChange(v === "all" ? "all" : (v as DocumentType));
              }}
            >
              <option value="all">ทั้งหมด</option>
              {existingTypes.map((t) => (
                <option key={t} value={t}>
                  {DOC_TYPE_CONFIG[t as ExtDocType]?.label ?? t}
                </option>
              ))}
            </select>
          </label>
          {seedButton ? <div className="sm:pb-0.5">{seedButton}</div> : null}
        </div>
      </div>
    </div>
  );
}
