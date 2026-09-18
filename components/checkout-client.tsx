"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPublicSupabaseConfig } from "@/lib/public-supabase-config";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type PaymentStart = {
  orderId: string;
  paymentAttemptId: string;
  paymentId: string;
  idempotencyKey: string;
  storeId: string;
  channelKey: string;
  orderName: string;
  amountKrw: number;
  currency: "KRW";
  payMethod: "CARD";
};

type PortOneResponse = {
  code?: string;
  message?: string;
  paymentId?: string;
  pgCode?: string;
  pgMessage?: string;
};

declare global {
  interface Window {
    PortOne?: {
      requestPayment(input: {
        storeId: string;
        channelKey: string;
        paymentId: string;
        orderName: string;
        totalAmount: number;
        currency: "CURRENCY_KRW";
        payMethod: "CARD";
        customer?: { email?: string };
        redirectUrl?: string;
      }): Promise<PortOneResponse | undefined>;
    };
  }
}

const DEFAULT_PRODUCT = "computer-literacy-2";

export function CheckoutClient() {
  const router = useRouter();
  const [productSlug, setProductSlug] = useState(DEFAULT_PRODUCT);
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusKind, setStatusKind] = useState<"info" | "error" | "success">("info");
  const [statusText, setStatusText] = useState(
    "현재 결제 오픈을 준비하고 있습니다."
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setProductSlug(params.get("product") || DEFAULT_PRODUCT);

    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setReady(true);
    });
  }, []);

  function goToResult(paymentId: string) {
    const next =
      "/checkout/complete/?paymentId=" +
      encodeURIComponent(paymentId);
    router.replace(next);
  }

  async function startPayment() {
    if (!email) {
      router.replace(
        "/account/login/?next=" +
          encodeURIComponent("/checkout/?product=" + productSlug)
      );
      return;
    }

    setBusy(true);
    setStatusKind("info");
    setStatusText("결제를 준비하고 있습니다.");

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        router.replace(
          "/account/login/?next=" +
            encodeURIComponent("/checkout/?product=" + productSlug)
        );
        return;
      }

      const { url, key } = getPublicSupabaseConfig();
      const response = await fetch(url + "/functions/v1/payment-start", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          apikey: key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productSlug,
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      if (!response.ok) {
        if (response.status === 503) {
          setStatusKind("info");
          setStatusText(
            "결제 오픈을 준비하고 있습니다. 결제 설정이 완료되면 바로 이용할 수 있습니다."
          );
          return;
        }

        if (response.status === 409) {
          setStatusKind("info");
          setStatusText(
            "아직 판매 준비가 완료되지 않은 상품입니다."
          );
          return;
        }

        throw new Error("payment-start:" + response.status);
      }

      const payment = (await response.json()) as PaymentStart;

      if (!window.PortOne) {
        throw new Error("portone-sdk-not-ready");
      }

      setStatusText("결제창을 여는 중입니다.");

      const result = await window.PortOne.requestPayment({
        storeId: payment.storeId,
        channelKey: payment.channelKey,
        paymentId: payment.paymentId,
        orderName: payment.orderName,
        totalAmount: payment.amountKrw,
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
        customer: { email },
        redirectUrl: window.location.origin + "/checkout/complete/",
      });

      // Mobile may redirect instead of resolving this Promise.
      if (!result) return;

      if (result.code) {
        setStatusKind("error");
        setStatusText(
          result.message || "결제가 완료되지 않았습니다."
        );
        return;
      }

      // Browser response is not authoritative. The completion page only
      // observes the own-order state changed by the verified webhook.
      goToResult(result.paymentId || payment.paymentId);
    } catch (error) {
      console.error("[PASSMATE] payment start failed", error);
      setStatusKind("error");
      setStatusText(
        "결제를 시작하지 못했습니다. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container checkout-grid">
      <div>
        <span className="eyebrow">CHECKOUT</span>
        <h1 className="page-title">구매하기</h1>
        <p className="page-lead">
          결제 완료 후 구매한 자료는 내 자료에서 확인할 수 있습니다.
        </p>

        <div className="checkout-steps">
          <p><b>1</b> 로그인 확인</p>
          <p><b>2</b> 카드 결제</p>
          <p><b>3</b> 결제 확인</p>
          <p><b>4</b> 내 자료에서 확인</p>
        </div>

        <p
          className={"checkout-status checkout-status--" + statusKind}
          role="status"
        >
          {statusText}
        </p>
      </div>

      <aside className="order-box">
        <span>2027 컴퓨터활용능력 2급</span>
        <strong>6,900원</strong>

        {!ready ? (
          <button disabled>계정 확인 중</button>
        ) : (
          <button
            type="button"
            onClick={startPayment}
            disabled={busy}
            className="checkout-pay-button"
          >
            {busy
              ? "처리 중..."
              : email
                ? "결제 준비하기"
                : "로그인 후 구매"}
          </button>
        )}

        <p className="checkout-account-note">
          {email
            ? email + " 계정으로 구매합니다."
            : "구매하려면 먼저 로그인해주세요."}
        </p>

        <Link href="/products/computer-literacy-2">
          ← 상품으로 돌아가기
        </Link>
      </aside>
    </div>
  );
}
