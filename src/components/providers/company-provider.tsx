"use client";

import type { ReactNode } from "react";
import { useAuth } from "./auth-provider";
import { useUserCompanies } from "@/hooks/use-workspace-data";

/**
 * ฟัง companies แบบ real-time หลัง auth โหลดเสร็จ
 * ต้องอยู่ใต้ AuthProvider
 */
function CompanyProviderInner({ children }: { children: ReactNode }) {
  const { user, accessStatus } = useAuth();
  // อย่าเปิด listener ของข้อมูลบริษัทก่อนตรวจสิทธิ์เสร็จ เพราะจะเกิด
  // permission-denied ระหว่างหน้า login และทำให้ session ดูเหมือนค้าง
  useUserCompanies(accessStatus === "approved" ? (user?.uid ?? null) : null);
  return <>{children}</>;
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  return <CompanyProviderInner>{children}</CompanyProviderInner>;
}
