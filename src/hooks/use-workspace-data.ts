"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useCompanyStore } from "@/stores/company-store";
import type {
  BusinessDocument,
  Company,
  Customer,
  Payment,
  Product,
  Vendor,
} from "@/types";

function sortRows<T extends { id: string }>(
  collectionName: string,
  rows: T[]
): T[] {
  const copy = [...rows];
  if (collectionName === "documents") {
    return copy.sort((a, b) =>
      String((b as { issueDate?: string }).issueDate ?? "").localeCompare(
        String((a as { issueDate?: string }).issueDate ?? "")
      )
    );
  }
  if (
    collectionName === "products" ||
    collectionName === "customers" ||
    collectionName === "vendors"
  ) {
    return copy.sort((a, b) =>
      String((a as { name?: string }).name ?? "").localeCompare(
        String((b as { name?: string }).name ?? ""),
        "th"
      )
    );
  }
  if (collectionName === "payments") {
    return copy.sort((a, b) =>
      String((b as { paidAt?: string }).paidAt ?? "").localeCompare(
        String((a as { paidAt?: string }).paidAt ?? "")
      )
    );
  }
  return copy;
}

function useCompanyCollection<T extends { id: string }>(
  companyId: string | null,
  collectionName: string
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setData([]);
      setLoading(false);
      return;
    }
    const db = getFirebaseDb();
    if (!db) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, collectionName),
      where("companyId", "==", companyId)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as T
        );
        setData(sortRows(collectionName, rows));
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [companyId, collectionName]);

  return { data, loading };
}

export function useDocuments(companyId: string | null) {
  return useCompanyCollection<BusinessDocument & { id: string }>(
    companyId,
    "documents"
  );
}

export function useProducts(companyId: string | null) {
  return useCompanyCollection<Product & { id: string }>(companyId, "products");
}

export function useCustomers(companyId: string | null) {
  return useCompanyCollection<Customer & { id: string }>(
    companyId,
    "customers"
  );
}

export function useVendors(companyId: string | null) {
  return useCompanyCollection<Vendor & { id: string }>(companyId, "vendors");
}

export function usePayments(companyId: string | null) {
  return useCompanyCollection<Payment & { id: string }>(
    companyId,
    "payments"
  );
}

/** ฟัง company document ของ companyId ที่กำหนด */
export function useCompany(companyId: string | null) {
  const [company, setCompany] = useState<(Company & { id: string }) | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setCompany(null);
      setLoading(false);
      return;
    }
    const db = getFirebaseDb();
    if (!db) {
      setLoading(false);
      return;
    }
    const ref = doc(db, "companies", companyId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setCompany(null);
        } else {
          setCompany({
            id: snap.id,
            ...(snap.data() as Company),
          });
        }
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [companyId]);

  return { company, loading };
}

/** ฟัง companies ทั้งหมดของ user แบบ real-time และ sync เข้า store */
export function useUserCompanies(userId: string | null) {
  const setCompanies = useCompanyStore((s) => s.setCompanies);
  const setCompaniesLoading = useCompanyStore((s) => s.setCompaniesLoading);

  useEffect(() => {
    if (!userId) {
      setCompanies([]);
      setCompaniesLoading(false);
      return;
    }
    const db = getFirebaseDb();
    if (!db) {
      setCompaniesLoading(false);
      return;
    }

    const q = query(
      collection(db, "companies"),
      where("ownerId", "==", userId),
      where("archived", "==", false)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Company),
        }));
        // เรียงบริษัท default ขึ้นก่อน แล้วตามชื่อ
        list.sort((a, b) => {
          if (a.isDefault && !b.isDefault) return -1;
          if (!a.isDefault && b.isDefault) return 1;
          return (a.name ?? "").localeCompare(b.name ?? "", "th");
        });
        setCompanies(list);
        setCompaniesLoading(false);
      },
      () => setCompaniesLoading(false)
    );

    return () => unsub();
  }, [userId, setCompanies, setCompaniesLoading]);
}

export function useDashboardStats(companyId: string | null) {
  const { data: documents, loading: docLoading } = useDocuments(companyId);
  const { data: payments, loading: payLoading } = usePayments(companyId);

  const stats = useMemo(() => {
    const invoices = documents.filter((d) => d.type === "invoice");
    const unpaid = invoices.filter((d) =>
      ["unpaid", "partial", "overdue"].includes(d.paymentStatus ?? "unpaid")
    );
    const paid = invoices.filter((d) => d.paymentStatus === "paid");
    const overdue = invoices.filter((d) => d.paymentStatus === "overdue");

    const sum = (arr: typeof invoices) =>
      arr.reduce((s, d) => s + (d.total ?? 0), 0);

    const paidAmount = sum(paid);
    const unpaidAmount = sum(unpaid);
    const overdueAmount = sum(overdue);

    const monthly = new Map<string, number>();
    for (const p of payments) {
      const key = (p.paidAt ?? "").slice(0, 7);
      if (!key) continue;
      monthly.set(key, (monthly.get(key) ?? 0) + p.amount);
    }

    return {
      totalDocuments: documents.length,
      unpaidAmount,
      paidAmount,
      overdueAmount,
      monthlyRevenue: Array.from(monthly.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({ month, amount })),
      paymentBreakdown: {
        paid: paid.length,
        unpaid: invoices.filter((d) => d.paymentStatus === "unpaid").length,
        partial: invoices.filter((d) => d.paymentStatus === "partial").length,
        overdue: overdue.length,
      },
    };
  }, [documents, payments]);

  return {
    stats,
    recentDocuments: documents.slice(0, 8),
    loading: docLoading || payLoading,
  };
}
