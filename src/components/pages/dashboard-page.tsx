"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { DashboardFilterBar } from "@/components/dashboard/dashboard-filter-bar";
import { DashboardKpiCards } from "@/components/dashboard/dashboard-kpi-cards";
import { DashboardQuickActions } from "@/components/dashboard/dashboard-quick-actions";
import { PendingWorkflowCard } from "@/components/dashboard/pending-workflow-card";
import { SalesTrendChart } from "@/components/dashboard/sales-trend-chart";
import { TopCustomersCard } from "@/components/dashboard/top-customers-card";
import { TopItemsCard } from "@/components/dashboard/top-items-card";
import { UnpaidDocumentsCard } from "@/components/dashboard/unpaid-documents-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  computeKpis,
  computePendingWorkflow,
  computeSixMonthTrend,
  computeTopItems,
  computeTopPartners,
  computeUnpaidDocuments,
  filterDashboardDocuments,
  getDashboardRange,
  getExistingTypesForFlow,
  getPeriodHintLabel,
  type DashDoc,
  type DashboardDatePreset,
  type DashboardFlowFilter,
} from "@/lib/dashboard/dashboard-analytics";
import { useCompanyStore } from "@/stores/company-store";
import { useDocuments } from "@/hooks/use-workspace-data";
import type { DocumentType } from "@/types";

export function DashboardPage() {
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const { data: documents, loading } = useDocuments(companyId);

  const rows = useMemo(
    () => documents.filter((d) => d.status !== "cancelled") as DashDoc[],
    [documents],
  );

  const [datePreset, setDatePreset] =
    useState<DashboardDatePreset>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [flow, setFlow] = useState<DashboardFlowFilter>("income");
  const [docType, setDocType] = useState<DocumentType | "all">("all");

  const range = useMemo(
    () => getDashboardRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  );

  const periodHint = useMemo(
    () => getPeriodHintLabel(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  );

  const existingTypes = useMemo(
    () => getExistingTypesForFlow(rows, flow),
    [rows, flow],
  );

  const filteredDocs = useMemo(
    () => filterDashboardDocuments(rows, flow, docType, range.from, range.to),
    [rows, flow, docType, range.from, range.to],
  );

  const kpis = useMemo(() => computeKpis(filteredDocs), [filteredDocs]);

  const trend = useMemo(
    () => computeSixMonthTrend(rows, flow, docType),
    [rows, flow, docType],
  );

  const topPartners = useMemo(
    () => computeTopPartners(filteredDocs, flow, 5),
    [filteredDocs, flow],
  );

  const topPartnersTitle =
    flow === "income" ? "ลูกค้ายอดนิยม" : "ผู้ขายยอดนิยม";

  const topItems = useMemo(
    () => computeTopItems(filteredDocs, 5),
    [filteredDocs],
  );

  const unpaidRows = useMemo(
    () => computeUnpaidDocuments(filteredDocs, 5),
    [filteredDocs],
  );

  const pendingRows = useMemo(
    () => computePendingWorkflow(filteredDocs, rows, 5),
    [filteredDocs, rows],
  );

  return (
    <div className="min-h-screen bg-surface-secondary">
      <AppHeader title="แดชบอร์ด" subtitle="สรุปภาพรวมเอกสารและการเงิน" />
      <div className="space-y-6 px-6 py-8">
        <DashboardFilterBar
          datePreset={datePreset}
          onDatePresetChange={setDatePreset}
          customFrom={customFrom}
          customTo={customTo}
          onCustomChange={(from, to) => {
            setCustomFrom(from);
            setCustomTo(to);
          }}
          flow={flow}
          onFlowChange={setFlow}
          docType={docType}
          onDocTypeChange={setDocType}
          existingTypes={existingTypes}
        />

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : (
          <DashboardKpiCards kpis={kpis} periodHint={periodHint} />
        )}

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            {loading ? (
              <Skeleton className="h-[380px] w-full rounded-2xl" />
            ) : (
              <SalesTrendChart data={trend} />
            )}
          </div>
          <div className="xl:col-span-1">
            {loading ? (
              <Skeleton className="h-[380px] w-full rounded-2xl" />
            ) : (
              <TopCustomersCard rows={topPartners} title={topPartnersTitle} />
            )}
          </div>
        </div>

        {loading ? (
          <Skeleton className="h-72 w-full rounded-2xl" />
        ) : (
          <TopItemsCard rows={topItems} />
        )}

        {loading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : (
          <UnpaidDocumentsCard rows={unpaidRows} />
        )}

        {loading ? (
          <Skeleton className="h-80 w-full rounded-2xl" />
        ) : (
          <PendingWorkflowCard rows={pendingRows} />
        )}

        <DashboardQuickActions />
      </div>
    </div>
  );
}
