import type { Metadata } from "next";
import { PublicCompanyCardPage } from "@/components/pages/public-company-card-page";

export const metadata: Metadata = {
  title: "นามบัตรบริษัท | Beyond Dev",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() { return <PublicCompanyCardPage />; }
