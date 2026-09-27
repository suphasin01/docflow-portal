import { z } from "zod";
import type { Company } from "@/types";

// An explicit public projection. Never spread a Company/Firestore record here.
export const publicCompanyCardSchema = z.object({
  name: z.string().min(1).max(300),
  nameEn: z.string().max(300),
  taxId: z.string().max(30),
  address: z.string().max(2000),
  phone: z.string().max(100),
  email: z.string().max(254),
}).strict();

export type PublicCompanyCard = z.infer<typeof publicCompanyCardSchema>;

export function companyCardData(company: Company): PublicCompanyCard {
  // The branded face uses the app's bundled high-resolution Beyond Dev logo.
  // Do not publish document-logo uploads, signatures or external tracking URLs.
  return {
    name: company.name, nameEn: company.nameEn ?? "", taxId: company.taxId ?? "",
    address: company.address ?? "", phone: company.phone ?? "", email: company.email ?? "",
  };
}

export const companyShareIdPattern = /^[A-Za-z0-9]{20}$/;

export function companyCardLink(id: string) {
  const url = new URL("/share/company", window.location.origin);
  url.searchParams.set("id", id);
  return url.toString();
}
