import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import "./globals.css";
import "./ui-refinements.css";
import "./store-mobile.css";
import "./store-copy.css";
import "./legal.css";
import "./auth-recent.css";
import "./learning-home.css";
import "./question-editor.css";
import "./account.css";
import "./interactions.css";
import "./store-unavailable.css";
import "@/lib/cbt-home-catalog";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageTransition } from "@/components/page-transition";
import { storeFontGuard } from "@/lib/store-font-guard";
import { SITE_URL, HOME_TITLE, HOME_DESCRIPTION } from "@/lib/seo";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "45 920",
  adjustFontFallback: false,
  fallback: ["system-ui", "-apple-system", "Apple SD Gothic Neo", "Noto Sans KR", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  verification: {
    google: "ftvih_KtvnWky1OkrX2pWm909x1kfjb6SxtMB_aYb9s",
    other: { "naver-site-verification": "0156b86fe73f3e5c2a77d6de82dcaa947c1c9ce5" },
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={pretendard.variable} data-scroll-behavior="smooth">
      <head><script dangerouslySetInnerHTML={{ __html: storeFontGuard }} /></head>
      <body>
        <Suspense><SiteHeader /></Suspense>
        <main><PageTransition>{children}</PageTransition></main>
        <SiteFooter />
      </body>
    </html>
  );
}
