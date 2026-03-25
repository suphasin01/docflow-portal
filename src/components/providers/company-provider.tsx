"use client";

import type { ReactNode } from "react";
import { useAuth } from "./auth-provider";
import { useUserCompanies } from "@/hooks/use-workspace-data";

/**
 * ฟัง companies แบบ real-time หลัง auth โหลดเสร็จ
 * ต้องอยู่ใต้ AuthProvider
 */
function CompanyProviderInner({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  useUserCompanies(user?.uid ?? null);
  return <>{children}</>;
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  return <CompanyProviderInner>{children}</CompanyProviderInner>;
}
