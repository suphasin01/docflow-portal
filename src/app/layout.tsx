import type { Metadata } from "next";
import { Geist_Mono, Manrope, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Beyond Doc — จัดการเอกสารธุรกิจ",
  description:
    "แอปพลิเคชันจัดการเอกสารสำหรับ SME ไทย — แดชบอร์ด ออกเอกสาร ติดตามชำระเงิน และรายงาน",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${manrope.variable} ${notoSansThai.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background font-sans text-foreground" suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
