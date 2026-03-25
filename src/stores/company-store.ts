"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Company } from "@/types";

type CompanyWithId = Company & { id: string };

type CompanyStore = {
  /** รายการบริษัทของ user ที่ login อยู่ */
  companies: CompanyWithId[];
  /** id บริษัทที่กำลังใช้งานอยู่ */
  activeCompanyId: string | null;
  /** loading ขณะดึงข้อมูลบริษัท */
  companiesLoading: boolean;

  setCompanies: (companies: CompanyWithId[]) => void;
  setActiveCompanyId: (id: string) => void;
  setCompaniesLoading: (loading: boolean) => void;
  /** รีเซ็ตเมื่อ logout */
  resetCompanyStore: () => void;
  /** บริษัทที่ active อยู่ตอนนี้ */
  activeCompany: () => CompanyWithId | null;
};

export const useCompanyStore = create<CompanyStore>()(
  persist(
    (set, get) => ({
      companies: [],
      activeCompanyId: null,
      companiesLoading: true,

      setCompanies: (companies) => {
        const state = get();
        const ids = new Set(companies.map((c) => c.id));

        // ถ้า activeCompanyId ปัจจุบันยังอยู่ใน list ใหม่ → คงไว้
        // ถ้าไม่ → ใช้ตัวแรก (isDefault ก่อน)
        let nextActiveId = state.activeCompanyId;
        if (!nextActiveId || !ids.has(nextActiveId)) {
          const defaultCompany = companies.find((c) => c.isDefault);
          nextActiveId = defaultCompany?.id ?? companies[0]?.id ?? null;
        }

        set({ companies, activeCompanyId: nextActiveId });
      },

      setActiveCompanyId: (id) => set({ activeCompanyId: id }),

      setCompaniesLoading: (loading) => set({ companiesLoading: loading }),

      resetCompanyStore: () =>
        set({ companies: [], activeCompanyId: null, companiesLoading: true }),

      activeCompany: () => {
        const { companies, activeCompanyId } = get();
        return companies.find((c) => c.id === activeCompanyId) ?? null;
      },
    }),
    {
      name: "docflow-active-company",
      // persist เฉพาะ activeCompanyId เพื่อ restore ข้ามหน้า
      partialize: (state) => ({ activeCompanyId: state.activeCompanyId }),
    }
  )
);
