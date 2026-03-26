"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/layout/app-header";
import { DocumentCreateStep1 } from "./document-create-step1";

const STEPS = [
  { n: 1, label: "ส่วนหัว" },
  { n: 2, label: "รายการ+สรุป" },
  { n: 3, label: "ส่วนเสริม" },
];

function StepperHeader({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 bg-white px-6 py-4 border-b border-border/60">
      {STEPS.map((step, idx) => (
        <div key={step.n} className="flex items-center">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                step.n === current
                  ? "bg-primary text-white"
                  : step.n < current
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {step.n < current ? <Check className="size-3.5" /> : step.n}
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                step.n === current
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div className="mx-4 h-px w-12 bg-border/60" />
          )}
        </div>
      ))}
    </div>
  );
}

export function DocumentCreatePage() {
  return (
    <div className="min-h-screen">
      <AppHeader title="ออกเอกสาร" subtitle="สร้างเอกสารธุรกิจ" />
      <StepperHeader current={1} />
      <DocumentCreateStep1 />
    </div>
  );
}
