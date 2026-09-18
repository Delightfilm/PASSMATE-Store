"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type OrderState = {
  status: string;
  fulfillment_status: string;
};

export function CheckoutCompleteClient() {
  const router = useRouter();
  const [state, setState] = useState<
    "checking" | "paid" | "failed" | "timeout" | "invalid"
  >("checking");
  const [detail, setDetail] = useState("결제 결과를 확인하고 있습니다.");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get("paymentId");
    const providerCode = params.get("code");
    const providerMessage = params.get("message");

    if (!paymentId) {
      setState("invalid");
      setDetail("결제 정보를 확인할 수 없습니다.");
      return;
    }

    if (providerCode) {
      setState("failed");
      setDetail(
        providerMessage || "결제가 완료되지 않았습니다."
      );
      return;
    }

    const supabase = getSupabaseBrowserClient();

    async function check() {
      const { data: userData } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!userData.user) {
        const next =
          window.location.pathname + window.location.search;
        router.replace(
          "/account/login/?next=" + encodeURIComponent(next)
        );
        return;
      }

      for (let attempt = 0; attempt < 15; attempt += 1) {
        const { data, error } = await supabase
          .from("orders")
          .select("status,fulfillment_status")
          .eq("provider_order_id", paymentId)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          setState("failed");
          setDetail(
            "결제 결과를 조회하지 못했습니다. 잠시 후 내 자료를 확인해주세요."
          );
          return;
        }

        const order = data as OrderState | null;

        if (order?.status === "paid") {
          setState("paid");
          setDetail(
            order.fulfillment_status === "ready"
              ? "결제가 완료되었고 자료 준비도 끝났습니다."
              : "결제가 완료되었습니다. 자료를 준비하고 있습니다."
          );
          return;
        }

        if (
          order?.status === "failed" ||
          order?.status === "cancelled" ||
          order?.status === "refunded"
        ) {
          setState("failed");
          setDetail("결제가 완료되지 않았습니다.");
          return;
        }

        await new Promise((resolve) =>
          window.setTimeout(resolve, 1000)
        );
      }

      if (!cancelled) {
        setState("timeout");
        setDetail(
          "결제 확인이 조금 지연되고 있습니다. 잠시 후 내 자료에서 확인해주세요."
        );
      }
    }

    void check();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const title =
    state === "paid"
      ? "결제가 완료되었습니다."
      : state === "checking"
        ? "결제를 확인하고 있습니다."
        : "결제 상태를 확인해주세요.";

  return (
    <div className="container checkout-result-wrap">
      <span className="eyebrow">PAYMENT RESULT</span>
      <h1 className="page-title">{title}</h1>
      <p className="page-lead">{detail}</p>

      <div className={"checkout-result-card checkout-result-card--" + state}>
        <div className="checkout-result-icon">
          {state === "paid"
            ? "✓"
            : state === "checking"
              ? "…"
              : "!"}
        </div>
        <strong>
          {state === "paid"
            ? "구매 완료"
            : state === "checking"
              ? "확인 중"
              : "확인 필요"}
        </strong>
        <p>
          결제창의 응답만으로 구매를 확정하지 않고,
          서버에서 확인된 주문 상태를 기준으로 표시합니다.
        </p>
      </div>

      <div className="account-actions">
        <Link className="button button-primary" href="/library/">
          내 자료 보기
        </Link>
        <Link className="button button-ghost" href="/products/">
          요약노트 보기
        </Link>
      </div>
    </div>
  );
}
