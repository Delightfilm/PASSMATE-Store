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
