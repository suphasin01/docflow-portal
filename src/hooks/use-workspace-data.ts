"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { WORKSPACE_COMPANY_ID } from "@/config/workspace";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useCompanyStore } from "@/stores/company-store";
import type {
  BusinessDocument,
  CatalogItem,
  Company,
  Contact,
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
      queueMicrotask(() => {
        setData([]);
        setLoading(false);
      });
      return;
    }
    const db = getFirebaseDb();
    if (!db) {
      queueMicrotask(() => setLoading(false));
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

/** สินค้า/บริการ (catalog model) — กรอง isArchived = false และเรียงตาม codeNumber */
export function useCatalogItems(companyId: string | null) {
  const [data, setData] = useState<(CatalogItem & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      queueMicrotask(() => {
        setData([]);
        setLoading(false);
      });
      return;
    }
    const db = getFirebaseDb();
    if (!db) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    const q = query(
      collection(db, "products"),
      where("companyId", "==", companyId),
      where("isArchived", "==", false)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as CatalogItem) }))
          .sort((a, b) => (a.codeNumber ?? 0) - (b.codeNumber ?? 0));
        setData(rows);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [companyId]);

  return { data, loading };
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

export function useContacts(companyId: string | null) {
  const [data, setData] = useState<(Contact & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      queueMicrotask(() => {
        setData([]);
        setLoading(false);
      });
      return;
    }
    const db = getFirebaseDb();
    if (!db) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    const q = query(
      collection(db, "contacts"),
      where("companyId", "==", companyId),
      where("isArchived", "==", false)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Contact) }))
          .sort((a, b) => a.codeNumber - b.codeNumber);
        setData(rows);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [companyId]);

  return { data, loading };
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
      queueMicrotask(() => {
        setCompany(null);
        setLoading(false);
      });
      return;
    }
    const db = getFirebaseDb();
    if (!db) {
      queueMicrotask(() => setLoading(false));
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

/** Subscribe to the one shared workspace only after approval. */
export function useUserCompanies(userId: string | null) {
  const setCompanies = useCompanyStore((s) => s.setCompanies);
  const setCompaniesLoading = useCompanyStore((s) => s.setCompaniesLoading);
  const setWorkspaceError = useCompanyStore((s) => s.setWorkspaceError);

  useEffect(() => {
    setCompanies([]);
    setWorkspaceError(null);
    setCompaniesLoading(!!userId);
    if (!userId) return;
    const db = getFirebaseDb();
    if (!db) {
      setWorkspaceError("Firestore ยังไม่พร้อม");
      setCompaniesLoading(false);
      return;
    }
    return onSnapshot(doc(db, "companies", WORKSPACE_COMPANY_ID), (snap) => {
      if (!snap.exists() || snap.data().archived === true) {
        setCompanies([]);
        setWorkspaceError("ไม่พบ workspace กลาง Beyond Dev");
      } else {
        setCompanies([{ ...snap.data(), id: snap.id } as Company & { id: string }]);
        setWorkspaceError(null);
      }
      setCompaniesLoading(false);
    }, () => {
      setCompanies([]);
      setWorkspaceError("โหลด workspace กลางไม่ได้ กรุณาตรวจสอบสิทธิ์และการเชื่อมต่อ");
      setCompaniesLoading(false);
    });
  }, [userId, setCompanies, setCompaniesLoading, setWorkspaceError]);
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
