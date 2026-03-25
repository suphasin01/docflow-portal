"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "./auth-provider";
import { CompanyProvider } from "./company-provider";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <CompanyProvider>
          {children}
          <Toaster richColors position="top-right" />
        </CompanyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
