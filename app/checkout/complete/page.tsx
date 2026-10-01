import type { Metadata } from "next";

export const metadata: Metadata = { title: "결제 결과 | PASSMATE", description: "요약노트 결제 결과와 다음 단계를 확인하세요." };

import Script from "next/script";
import { CheckoutCompleteClient } from "@/components/checkout-complete-client";

export default function CheckoutCompletePage() {
  return (
    <>
      <Script
        src="https://cdn.portone.io/v2/browser-sdk.js"
        strategy="afterInteractive"
      />
      <section className="section page-section">
        <CheckoutCompleteClient />
      </section>
    </>
  );
}
