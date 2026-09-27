"use client";

import type { ReactNode } from "react";
import { Calendar } from "lucide-react";
import { Button, Label } from "@heroui/react";
import { NativeSelect, Segment } from "@heroui-pro/react";
import { Input } from "@/components/ui/input";
import {
  DASHBOARD_PRESET_LABELS,
  type DashboardDatePreset,
  type DashboardFlowFilter,
} from "@/lib/dashboard/dashboard-analytics";
import { DOC_TYPE_CONFIG, type ExtDocType } from "@/lib/doc-types";
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
    <div className="glass-panel p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="size-4 shrink-0 text-muted-foreground" />
            {DATE_PRESETS.map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={datePreset === key ? "primary" : "secondary"}
                onPress={() => onDatePresetChange(key)}
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

          <Segment
            selectedKey={flow}
            size="sm"
            onSelectionChange={(key) => {
              const nextFlow = String(key);
              if (nextFlow === "income" || nextFlow === "expense") {
                onFlowChange(nextFlow);
                onDocTypeChange("all");
              }
            }}
          >
            <Segment.Item id="income">รายรับ</Segment.Item>
            <Segment.Item id="expense">รายจ่าย</Segment.Item>
          </Segment>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end lg:w-auto lg:shrink-0">
          <NativeSelect className="min-w-[220px]" fullWidth>
            <Label>ประเภทเอกสาร</Label>
            <NativeSelect.Trigger
              name="dashboard-document-type"
              value={docType}
              onChange={(e) => {
                const v = e.target.value;
                onDocTypeChange(v === "all" ? "all" : (v as DocumentType));
              }}
            >
              <NativeSelect.Option value="all">ทั้งหมด</NativeSelect.Option>
              {existingTypes.map((t) => (
                <NativeSelect.Option key={t} value={t}>
                  {DOC_TYPE_CONFIG[t as ExtDocType]?.label ?? t}
                </NativeSelect.Option>
              ))}
              <NativeSelect.Indicator />
            </NativeSelect.Trigger>
          </NativeSelect>
          {seedButton ? <div className="sm:pb-0.5">{seedButton}</div> : null}
        </div>
      </div>
    </div>
  );
}
