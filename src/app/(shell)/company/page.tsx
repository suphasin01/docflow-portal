"use client";

import { Suspense } from "react";
import { CompanyPage } from "@/components/pages/company-page";

export default function Page() {
  return (
    <Suspense>
      <CompanyPage />
    </Suspense>
  );
}
