import type { Metadata } from "next";

export const metadata: Metadata = { title: "결제 | PASSMATE", description: "요약노트 주문 정보를 확인하고 결제를 진행하세요." };

import Script from "next/script";
import { CheckoutClient } from "@/components/checkout-client";

export default function CheckoutPage() {
  return (
    <>
      <Script
        src="https://cdn.portone.io/v2/browser-sdk.js"
        strategy="afterInteractive"
      />
      <section className="section page-section">
        <CheckoutClient />
      </section>
    </>
  );
}
