"use client";

import { create } from "zustand";
import {
  persist,
  type PersistStorage,
  type StorageValue,
} from "zustand/middleware";
import type { Company } from "@/types";

/** ต้องตรงกับ `name` ใน persist — ใช้อ่านก่อน rehydrate เสร็จ */
const ACTIVE_COMPANY_STORAGE_KEY = "docflow-active-company";

type PersistedCompanySlice = { activeCompanyId: string | null };

/**
 * ห้ามใช้ createJSONStorage(() => localStorage) — มันเรียก getStorage ครั้งเดียวตอนโหลดโมดูล
 * บน Next SSR ครั้งแรกไม่มี window ทำให้ persist ไม่ผูก storage จริงตลอดไป
 */
function createLazyLocalStorage(): PersistStorage<PersistedCompanySlice> {
  return {
    getItem: (name) => {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.localStorage.getItem(name);
        if (!raw) return null;
        return JSON.parse(raw) as StorageValue<PersistedCompanySlice>;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(name, JSON.stringify(value));
      } catch {
        /* quota / private mode */
      }
    },
    removeItem: (name) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.removeItem(name);
      } catch {
        /* ignore */
      }
    },
  };
}

function readPersistedActiveCompanyId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_COMPANY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StorageValue<PersistedCompanySlice>;
    const id = parsed?.state?.activeCompanyId;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

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

        /**
         * snapshot แรกมักเป็น [] — ห้ามเคลียร์ active หรือให้ persist เขียน activeCompanyId: null
         * ทับ localStorage (จะลบบริษัทที่เลือกล่าสุดและ refresh แล้วเด้งไปตัวแรก)
         */
        if (companies.length === 0) {
          set({ companies: [] });
          return;
        }

        const ids = new Set(companies.map((c) => c.id));

        /**
         * ลำดับความสำคัญ:
         * 1) active ใน memory ที่ยังอยู่ในรายการ (สลับบริษัทใน session)
         * 2) id ใน localStorage — กัน race ก่อน zustand rehydrate หลัง refresh
         * 3) isDefault / ตัวแรก
         */
        const storedId = readPersistedActiveCompanyId();
        const storedOk = Boolean(storedId && ids.has(storedId));
        const memoryOk = Boolean(
          state.activeCompanyId && ids.has(state.activeCompanyId),
        );

        let nextActiveId: string | null = null;
        if (memoryOk) {
          nextActiveId = state.activeCompanyId;
        } else if (storedOk) {
          nextActiveId = storedId;
        } else {
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
      name: ACTIVE_COMPANY_STORAGE_KEY,
      storage: createLazyLocalStorage(),
      partialize: (state) => ({ activeCompanyId: state.activeCompanyId }),
    }
  )
);
