"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@heroui/react";
import { Stepper } from "@heroui-pro/react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { DocumentCreateStep1 } from "./document-create-step1";
import {
  DocumentCreateStep2,
  mergeStep2Initial,
} from "./document-create-step2";
import {
  DocumentCreateStep3,
  mergeStep3Initial,
} from "./document-create-step3";
import { PreviewDialog } from "./document-preview-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { useCompanyStore } from "@/stores/company-store";
import {
  step1PrefillSchema,
  step1Schema,
  type Step1FormValues,
} from "@/lib/schemas/document-draft";
import type { Step2FormValues } from "@/lib/schemas/document-step2";
import {
  buildDefaultStep3Values,
  type Step3FormValues,
} from "@/lib/schemas/document-step3";
import { DOC_TYPE_CONFIG, type ExtDocType } from "@/lib/doc-types";
import type { BusinessDocument } from "@/types";
import {
  buildRelatedDocumentDraftPayload,
  createBusinessDocumentDraft,
  getBusinessDocumentById,
  updateBusinessDocumentFromWizard,
} from "@/lib/firebase/document-detail-mutations";

function isExtDocType(s: string): s is ExtDocType {
  return Object.prototype.hasOwnProperty.call(DOC_TYPE_CONFIG, s);
}

const STEPS = [
  { label: "ส่วนหัว", description: "ข้อมูลเอกสาร" },
  { label: "รายการและสรุป", description: "สินค้าและยอดรวม" },
  { label: "ส่วนเสริม", description: "หมายเหตุและลายเซ็น" },
];

function StepperHeader({ current }: { current: number }) {
  return (
    <div className="glass-toolbar relative z-10 border-b px-4 py-4 sm:px-6">
      <Stepper
        aria-label="ขั้นตอนการออกเอกสาร"
        className="mx-auto max-w-3xl"
        currentStep={current - 1}
      >
        {STEPS.map((step) => (
          <Stepper.Step key={step.label}>
            <Stepper.Indicator />
            <Stepper.Content>
              <Stepper.Title>{step.label}</Stepper.Title>
              <Stepper.Description className="hidden sm:block">
                {step.description}
              </Stepper.Description>
            </Stepper.Content>
            <Stepper.Separator />
          </Stepper.Step>
        ))}
      </Stepper>
    </div>
  );
}

export function DocumentCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const fromDocParam = searchParams.get("fromDoc");
  const nextParam = searchParams.get("next");
  const { user } = useAuth();
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const setActiveCompanyId = useCompanyStore((s) => s.setActiveCompanyId);

  const [step, setStep] = useState(1);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pageRef.current?.closest("main")?.scrollTo({ top: 0 });
  }, [step]);
  const [step1Data, setStep1Data] = useState<Step1FormValues | null>(null);
  const [step2Data, setStep2Data] = useState<Step2FormValues | null>(null);
  const [step3Data, setStep3Data] = useState<Step3FormValues | null>(null);

  /** ค่า step1 ตอนโหลดโหมดแก้ไข (ส่งให้ฟอร์มครั้งแรกเท่านั้น) */
  const [initialStep1ForEdit, setInitialStep1ForEdit] =
    useState<Step1FormValues | null>(null);
  const [editDocumentId, setEditDocumentId] = useState<string | null>(null);
  const [editLoadStatus, setEditLoadStatus] = useState<
    "idle" | "loading" | "ready"
  >("idle");

  /** เอกสารต้นทางเมื่อมาจาก «สร้างต่อเนื่อง» — ส่งตอนบันทึกเพื่อผูกโซ่ / workflow */
  const [sourceDocumentForCreate, setSourceDocumentForCreate] = useState<
    (BusinessDocument & { id: string }) | null
  >(null);
  const [chainPrefillStatus, setChainPrefillStatus] = useState<
    "idle" | "loading" | "ready"
  >("idle");

  /** ใช้ไม่ให้ effect ของโหมดแก้ไขล้างฟอร์มตอนไม่มี editId แต่กำลัง prefill จาก chain */
  const hadEditInUrlRef = useRef(false);

  // ── Centralized preview state ──────────────────────────────────────────────
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<{
    s1: Step1FormValues | null;
    s2: Step2FormValues | null;
    s3: Step3FormValues | null;
  }>({ s1: null, s2: null, s3: null });
  /** ซิงก์ตำแหน่งตราประทับจากพรีวิวเข้าฟอร์ม step 3 */
  const [previewStampLayout, setPreviewStampLayout] = useState<{
    x: number;
    y: number;
    r: number;
  } | null>(null);

  const step3ForPreview = useMemo(
    () => step3Data ?? previewSnapshot.s3 ?? null,
    [step3Data, previewSnapshot.s3],
  );

  const handleStampLayoutChange = useCallback(
    (
      layout: Pick<
        Step3FormValues["stamp"],
        "positionX" | "positionY" | "rotationDeg"
      >,
    ) => {
      setPreviewSnapshot((prev) => {
        const base = prev.s3 ?? buildDefaultStep3Values();
        return {
          ...prev,
          s3: {
            ...base,
            stamp: { ...base.stamp, ...layout },
          },
        };
      });
      setPreviewStampLayout({
        x: layout.positionX,
        y: layout.positionY,
        r: layout.rotationDeg,
      });
    },
    [],
  );

  useEffect(() => {
    if (!editId) {
      const shouldResetForm = hadEditInUrlRef.current;
      hadEditInUrlRef.current = false;
      queueMicrotask(() => {
        setEditDocumentId(null);
        setEditLoadStatus("idle");
        if (shouldResetForm) {
          setInitialStep1ForEdit(null);
          setStep1Data(null);
          setStep2Data(null);
          setStep3Data(null);
          setSourceDocumentForCreate(null);
        }
      });
      return;
    }

    hadEditInUrlRef.current = true;
    if (!user) return;

    let cancelled = false;

    void (async () => {
      setEditLoadStatus("loading");
      try {
        setSourceDocumentForCreate(null);
        const docRow = await getBusinessDocumentById(editId);
        if (cancelled) return;
        if (!docRow?.previewData?.step1Data) {
          toast.error("ไม่พบข้อมูลฟอร์มของเอกสาร");
          router.replace("/documents/create");
          return;
        }

        const p1 = step1Schema.safeParse(docRow.previewData.step1Data);
        if (!p1.success) {
          toast.error("ข้อมูลเอกสารไม่สมบูรณ์");
          router.replace("/documents/create");
          return;
        }

        setActiveCompanyId(docRow.companyId);
        const s2 = mergeStep2Initial(
          docRow.previewData.step2Data as Step2FormValues | undefined,
        );
        const s3 = mergeStep3Initial(
          docRow.previewData.step3Data as Step3FormValues | undefined,
        );

        setInitialStep1ForEdit(p1.data);
        setStep1Data(p1.data);
        setStep2Data(s2);
        setStep3Data(s3);
        setEditDocumentId(editId);
        setStep(1);
        setEditLoadStatus("ready");
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          toast.error("โหลดเอกสารไม่สำเร็จ");
          router.replace("/documents/create");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editId, user, router, setActiveCompanyId]);

  /** prefill step1–3 จากเอกสารต้นทาง (ปุ่มสร้างต่อเนื่องบนหน้ารายละเอียด) */
  useEffect(() => {
    if (editId) {
      return;
    }

    if (!fromDocParam || !nextParam) {
      return;
    }
    if (!user) return;

    if (!isExtDocType(nextParam)) {
      toast.error("ประเภทเอกสารไม่ถูกต้อง");
      router.replace("/documents/create");
      return;
    }

    let cancelled = false;

    void (async () => {
      setChainPrefillStatus("loading");
      try {
        const docRow = await getBusinessDocumentById(fromDocParam);
        if (cancelled) return;
        if (!docRow?.previewData?.step1Data) {
          toast.error("ไม่พบข้อมูลฟอร์มของเอกสารต้นทาง");
          router.replace("/documents/create");
          return;
        }

        const cloned = buildRelatedDocumentDraftPayload({
          sourceDocument: { ...docRow, id: fromDocParam },
          nextType: nextParam,
        });

        const p1 = step1PrefillSchema.safeParse(cloned.step1Data);
        if (!p1.success) {
          toast.error("ข้อมูลเอกสารต้นทางไม่สมบูรณ์");
          router.replace("/documents/create");
          return;
        }

        setActiveCompanyId(docRow.companyId);
        const s2 = mergeStep2Initial(cloned.step2Data);
        const s3 = mergeStep3Initial(cloned.step3Data);

        setSourceDocumentForCreate({ ...docRow, id: fromDocParam });
        setInitialStep1ForEdit(p1.data);
        setStep1Data(p1.data);
        setStep2Data(s2);
        setStep3Data(s3);
        setEditDocumentId(null);
        setStep(1);
        setChainPrefillStatus("ready");
        router.replace("/documents/create", { scroll: false });
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          toast.error("โหลดข้อมูลสำหรับสร้างต่อไม่สำเร็จ");
          router.replace("/documents/create");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    editId,
    fromDocParam,
    nextParam,
    user,
    router,
    setActiveCompanyId,
  ]);

  function openPreview(
    s1: Step1FormValues | null,
    s2: Step2FormValues | null,
    s3: Step3FormValues | null,
  ) {
    setPreviewSnapshot({ s1, s2, s3 });
    setPreviewOpen(true);
  }

  const isEditMode = Boolean(editDocumentId);
  const showEditLoader = Boolean(editId) && editLoadStatus !== "ready";
  const showChainPrefillLoader =
    !editId &&
    Boolean(fromDocParam && nextParam) &&
    chainPrefillStatus !== "ready";
  const showPageLoader = showEditLoader || showChainPrefillLoader;

  const formRootKey =
    editDocumentId ??
    (sourceDocumentForCreate
      ? `from-${sourceDocumentForCreate.id}`
      : "new");

  const previewDialogStep3 = useMemo(
    () => previewSnapshot.s3 ?? buildDefaultStep3Values(),
    [previewSnapshot.s3],
  );

  return (
    <div ref={pageRef} className="min-h-[calc(100dvh-4rem)]">
      <AppHeader
        title={isEditMode ? "แก้ไขเอกสาร" : "ออกเอกสาร"}
        subtitle={
          isEditMode ? "ปรับปรุงรายละเอียดแล้วบันทึก" : "สร้างเอกสารธุรกิจ"
        }
        actions={
          editId ? (
            <Button
              type="button"
              variant="secondary"
              onPress={() =>
                router.push(
                  `/documents/detail?id=${encodeURIComponent(editDocumentId ?? editId)}`,
                )
              }
            >
              ยกเลิกการแก้ไข
            </Button>
          ) : null
        }
      />
      <StepperHeader current={step} />

      {showPageLoader && (
        <div className="px-6 py-16 text-center text-sm text-muted-foreground">
          {showChainPrefillLoader
            ? "กำลังเตรียมแบบฟอร์มจากเอกสารต้นทาง…"
            : "กำลังโหลดเอกสาร…"}
        </div>
      )}

      <div key={`${formRootKey}-${step}`} className="page-enter">
      {!showPageLoader && step === 1 && (
        <DocumentCreateStep1
          key={`${formRootKey}-1`}
          initialValues={step1Data ?? initialStep1ForEdit}
          lockChainReference={!!sourceDocumentForCreate}
          onNext={(values) => {
            setStep1Data(values);
            setStep(2);
          }}
          onPreview={(values) =>
            openPreview(values, step2Data, step3ForPreview)
          }
        />
      )}

      {!showPageLoader && step === 2 && (
        <DocumentCreateStep2
          key={`${formRootKey}-2`}
          step1Data={step1Data}
          initialValues={step2Data}
          onBack={(values) => {
            setStep2Data(values);
            setStep(1);
          }}
          onNext={(values) => {
            setStep2Data(values);
            setStep(3);
          }}
          onPreview={(values) =>
            openPreview(step1Data, values, step3ForPreview)
          }
        />
      )}

      {!showPageLoader && step === 3 && (
        <DocumentCreateStep3
          key={`${formRootKey}-3`}
          step1Data={step1Data}
          step2Data={step2Data}
          initialValues={mergeStep3Initial(step3Data ?? previewSnapshot.s3)}
          previewStampLayout={previewStampLayout}
          onBack={(values) => {
            setStep3Data(values);
            setStep(2);
          }}
          onSave={async (values) => {
            if (!user || !companyId || !step1Data || !step2Data) {
              toast.error("ข้อมูลเอกสารยังไม่พร้อมสำหรับบันทึก");
              return;
            }

            try {
              setStep3Data(values);
              if (editDocumentId) {
                await updateBusinessDocumentFromWizard({
                  documentId: editDocumentId,
                  companyId,
                  step1Data,
                  step2Data,
                  step3Data: values,
                });
                toast.success("บันทึกการแก้ไขเรียบร้อยแล้ว");
                router.push(`/documents/detail?id=${editDocumentId}`);
              } else {
                const id = await createBusinessDocumentDraft({
                  companyId,
                  userId: user.uid,
                  step1Data,
                  step2Data,
                  step3Data: values,
                  sourceDocument: sourceDocumentForCreate ?? undefined,
                  nextType: sourceDocumentForCreate
                    ? step1Data.documentType
                    : undefined,
                  createdFromFlowAction: sourceDocumentForCreate
                    ? step1Data.documentType
                    : null,
                });
                setSourceDocumentForCreate(null);
                toast.success("บันทึกเอกสารเรียบร้อยแล้ว");
                router.push(`/documents/detail?id=${id}`);
              }
            } catch (error) {
              console.error(error);
              toast.error(
                editDocumentId
                  ? "ไม่สามารถบันทึกการแก้ไขได้"
                  : "ไม่สามารถบันทึกเอกสารได้",
              );
            }
          }}
          onPreview={(values) => openPreview(step1Data, step2Data, values)}
        />
      )}

      </div>
      {/* Single shared PreviewDialog across all steps */}
      <PreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        step1Data={previewSnapshot.s1}
        step2Data={previewSnapshot.s2}
        step3Data={previewDialogStep3}
        onStampLayoutChange={handleStampLayoutChange}
      />
    </div>
  );
}
