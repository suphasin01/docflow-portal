"use client";

import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompanyStore } from "@/stores/company-store";
import type { SidebarBaseProps } from "./sidebar-types";

type SidebarWorkspaceProps = SidebarBaseProps;

export function SidebarWorkspace({ collapsed }: SidebarWorkspaceProps) {
  const router = useRouter();
  const companies = useCompanyStore((s) => s.companies);
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const setActiveCompanyId = useCompanyStore((s) => s.setActiveCompanyId);
  const companiesLoading = useCompanyStore((s) => s.companiesLoading);

  const activeCompany = companies.find((c) => c.id === activeCompanyId);

  if (collapsed) {
    return (
      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={() => router.push("/company")}
          className="flex w-full items-center justify-center rounded-xl bg-white/5 p-2 ring-1 ring-white/10 transition hover:bg-white/10"
          title={activeCompany?.name ?? "บริษัทของฉัน"}
        >
          <Building2 className="size-4 text-white/80" />
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 pb-2">
      <div className="group relative">
        <details className="group/details">
          <summary
            className={cn(
              "flex cursor-pointer list-none items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10 transition",
              "hover:bg-white/10 hover:ring-white/20",
              "[&::-webkit-details-marker]:hidden"
            )}
          >
            {/* logo / icon */}
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
              {activeCompany?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeCompany.logoUrl}
                  alt={activeCompany.name}
                  className="size-7 rounded-lg object-cover"
                />
              ) : (
                <Building2 className="size-3.5 text-white/70" />
              )}
            </div>

            {/* company name */}
            <div className="min-w-0 flex-1">
              {companiesLoading ? (
                <div className="h-3.5 w-24 animate-pulse rounded bg-white/20" />
              ) : (
                <p className="truncate text-sm font-medium text-white">
                  {activeCompany?.name ?? "บริษัทของฉัน"}
                </p>
              )}
            </div>

            <ChevronDown className="size-3.5 shrink-0 text-white/50 transition group-open/details:rotate-180" />
          </summary>

          {/* dropdown */}
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-white/10 bg-[#0c1a2e] shadow-xl">
            {/* รายการบริษัท */}
            <div className="max-h-52 overflow-y-auto">
              {companies.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => {
                    setActiveCompanyId(company.id);
                    // close details
                    const el = document.querySelector(
                      "details.group\\/details"
                    ) as HTMLDetailsElement | null;
                    if (el) el.open = false;
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition",
                    company.id === activeCompanyId
                      ? "bg-white/10 text-white"
                      : "text-white/75 hover:bg-white/8 hover:text-white"
                  )}
                >
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white/10">
                    {company.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={company.logoUrl}
                        alt={company.name}
                        className="size-6 rounded-md object-cover"
                      />
                    ) : (
                      <Building2 className="size-3 text-white/60" />
                    )}
                  </div>
                  <span className="flex-1 truncate font-medium">
                    {company.name}
                  </span>
                  {company.id === activeCompanyId && (
                    <Check className="size-3.5 text-white/60" />
                  )}
                </button>
              ))}
            </div>

            {/* divider + จัดการบริษัท */}
            <div className="border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  router.push("/company");
                  const el = document.querySelector(
                    "details.group\\/details"
                  ) as HTMLDetailsElement | null;
                  if (el) el.open = false;
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white/60 transition hover:bg-white/8 hover:text-white"
              >
                <Building2 className="size-3.5" />
                จัดการบริษัท
              </button>
              <button
                type="button"
                onClick={() => {
                  router.push("/company?action=create");
                  const el = document.querySelector(
                    "details.group\\/details"
                  ) as HTMLDetailsElement | null;
                  if (el) el.open = false;
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white/60 transition hover:bg-white/8 hover:text-white"
              >
                <Plus className="size-3.5" />
                เพิ่มบริษัท
              </button>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
