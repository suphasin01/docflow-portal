"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/layout/app-header";
import { DocumentCreateStep1 } from "./document-create-step1";
import { DocumentCreateStep2 } from "./document-create-step2";
import { DocumentCreateStep3 } from "./document-create-step3";
import type { Step1FormValues } from "@/lib/schemas/document-draft";
import type { Step2FormValues } from "@/lib/schemas/document-step2";
import type { Step3FormValues } from "@/lib/schemas/document-step3";

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
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1FormValues | null>(null);
  const [step2Data, setStep2Data] = useState<Step2FormValues | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [step3Data, setStep3Data] = useState<Step3FormValues | null>(null);

  return (
    <div className="min-h-screen">
      <AppHeader title="ออกเอกสาร" subtitle="สร้างเอกสารธุรกิจ" />
      <StepperHeader current={step} />

      {step === 1 && (
        <DocumentCreateStep1
          onNext={(values) => {
            setStep1Data(values);
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <DocumentCreateStep2
          step1Data={step1Data}
          onBack={() => setStep(1)}
          onNext={(values) => {
            setStep2Data(values);
            setStep(3);
          }}
        />
      )}

      {step === 3 && (
        <DocumentCreateStep3
          step1Data={step1Data}
          step2Data={step2Data}
          onBack={() => setStep(2)}
          onSave={(values) => {
            setStep3Data(values);
            // TODO: persist full draft to Firestore
            console.log("Draft complete", { step1Data, step2Data, values });
          }}
        />
      )}
    </div>
  );
}
