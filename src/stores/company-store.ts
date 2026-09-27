"use client";

import { create } from "zustand";
import { WORKSPACE_COMPANY_ID } from "@/config/workspace";
import type { Company } from "@/types";

type CompanyWithId = Company & { id: string };
type CompanyStore = {
  companies: CompanyWithId[];
  activeCompanyId: string | null;
  companiesLoading: boolean;
  workspaceError: string | null;
  setCompanies: (companies: CompanyWithId[]) => void;
  setActiveCompanyId: (id: string) => void;
  setCompaniesLoading: (loading: boolean) => void;
  setWorkspaceError: (error: string | null) => void;
  resetCompanyStore: () => void;
  activeCompany: () => CompanyWithId | null;
};

// Ignore legacy localStorage selections: all approved accounts use the same ID.
export const useCompanyStore = create<CompanyStore>((set, get) => ({
  companies: [],
  activeCompanyId: null,
  companiesLoading: true,
  workspaceError: null,
  setCompanies: (companies) => {
    const shared = companies.filter((company) => company.id === WORKSPACE_COMPANY_ID);
    set({ companies: shared, activeCompanyId: shared.length ? WORKSPACE_COMPANY_ID : null });
  },
  setActiveCompanyId: (id) => {
    if (id === WORKSPACE_COMPANY_ID) set({ activeCompanyId: id });
  },
  setCompaniesLoading: (companiesLoading) => set({ companiesLoading }),
  setWorkspaceError: (workspaceError) => set({ workspaceError }),
  resetCompanyStore: () => set({ companies: [], activeCompanyId: null, companiesLoading: true, workspaceError: null }),
  activeCompany: () => get().companies.find((c) => c.id === WORKSPACE_COMPANY_ID) ?? null,
}));
