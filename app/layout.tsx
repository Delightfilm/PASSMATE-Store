import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = {
  title: "PASSMATE | 합격까지 함께하는 요약노트",
  description: "시험에 필요한 핵심만 압축한 자격증 요약노트 PASSMATE",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <SiteHeader />
        <main><PageTransition>{children}</PageTransition></main>
        <SiteFooter />
      </body>
    </html>
  );
}
