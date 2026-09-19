"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  productCode: string;
  productVersion: string;
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isPaymentStart(value: unknown): value is PaymentStart {
  if (!value || typeof value !== "object") return false;

  const payment = value as Record<string, unknown>;
  return (
    isNonEmptyString(payment.orderId) &&
    isNonEmptyString(payment.paymentAttemptId) &&
    isNonEmptyString(payment.paymentId) &&
    isNonEmptyString(payment.idempotencyKey) &&
    isNonEmptyString(payment.storeId) &&
    isNonEmptyString(payment.channelKey) &&
    isNonEmptyString(payment.productCode) &&
    isNonEmptyString(payment.productVersion) &&
    isNonEmptyString(payment.orderName) &&
    typeof payment.amountKrw === "number" &&
    Number.isInteger(payment.amountKrw) &&
    payment.amountKrw >= 0 &&
    payment.currency === "KRW" &&
    payment.payMethod === "CARD"
  );
}

function formatKrw(amountKrw: number) {
  return amountKrw.toLocaleString("ko-KR") + "원";
}

export function CheckoutClient() {
  const router = useRouter();
  const checkoutIdempotencyKey = useRef<string | null>(null);
  const [productSlug, setProductSlug] = useState(DEFAULT_PRODUCT);
  const [productSlugs, setProductSlugs] = useState<string[]>([DEFAULT_PRODUCT]);
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<"idle" | "preparing" | "paying">("idle");
  const [payment, setPayment] = useState<PaymentStart | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [statusKind, setStatusKind] = useState<"info" | "error" | "success">("info");
  const [statusText, setStatusText] = useState(
    "결제할 상품과 금액을 서버에서 확인해주세요."
  );
  const busy = phase !== "idle";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setProductSlug(params.get("product") || DEFAULT_PRODUCT);
    setProductSlugs((params.get("products") || params.get("product") || DEFAULT_PRODUCT).split(",").filter(Boolean));

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

  async function preparePayment() {
    if (!email) {
      router.replace(
        "/account/login/?next=" +
          encodeURIComponent("/checkout/?product=" + productSlug)
      );
      return;
    }

    setPhase("preparing");
    setPayment(null);
    setConfirmed(false);
    setStatusKind("info");
    setStatusText("서버에서 최신 상품과 결제 금액을 확인하고 있습니다.");

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

      // Keep one logical checkout key for retries while this checkout page is
      // mounted. Network retry/re-click therefore resolves to the same order,
      // attempt and PortOne paymentId instead of creating a second pending order.
      checkoutIdempotencyKey.current ??= crypto.randomUUID();

      const { url, key } = getPublicSupabaseConfig();
      const response = await fetch(url + "/functions/v1/payment-start", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          apikey: key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productSlug: productSlugs[0],
          productSlugs,
          idempotencyKey: checkoutIdempotencyKey.current,
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

      const preparedPayment: unknown = await response.json();
      if (!isPaymentStart(preparedPayment)) {
        throw new Error("invalid-payment-start-response");
      }

      if (preparedPayment.idempotencyKey !== checkoutIdempotencyKey.current) {
        throw new Error("checkout-idempotency-mismatch");
      }

      setPayment(preparedPayment);
      setStatusKind("success");
      setStatusText(
        "서버에서 확정된 상품과 금액입니다. 아래 내용을 확인하고 결제에 동의해주세요."
      );
    } catch (error) {
      console.error("[PASSMATE] payment preparation failed", error);
      setStatusKind("error");
      setStatusText(
        "결제 정보를 확인하지 못했습니다. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setPhase("idle");
    }
  }

  async function confirmPayment() {
    if (!payment || !confirmed || busy || !email) return;

    setPhase("paying");
    setStatusKind("info");
    setStatusText("확인한 금액으로 결제창을 여는 중입니다.");

    try {
      if (!window.PortOne) {
        throw new Error("portone-sdk-not-ready");
      }

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
      // observes the own-order state changed by server verification.
      goToResult(result.paymentId || payment.paymentId);
    } catch (error) {
      console.error("[PASSMATE] payment start failed", error);
      setStatusKind("error");
      setStatusText(
        "결제를 시작하지 못했습니다. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setPhase("idle");
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
        {payment ? (
          <>
            <span>{payment.orderName}</span>
            <small>
              상품 코드 {payment.productCode} · 버전 {payment.productVersion}
            </small>
            <strong>{formatKrw(payment.amountKrw)}</strong>
            <p className="checkout-account-note">
              결제 직전 서버에서 확정한 상품과 금액입니다.
            </p>
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                disabled={busy}
              />{" "}
              위 상품과 {formatKrw(payment.amountKrw)} 결제에 동의합니다.
            </label>
            <button
              type="button"
              onClick={confirmPayment}
              disabled={!confirmed || busy}
              className="checkout-pay-button"
            >
              {phase === "paying"
                ? "결제창 여는 중..."
                : formatKrw(payment.amountKrw) + " 결제창 열기"}
            </button>
          </>
        ) : (
          <>
            <span>결제 상품 및 금액</span>
            <strong>서버 확인 전</strong>
            <p className="checkout-account-note">
              최신 상품명, 버전, 결제 금액을 서버에서 확인한 뒤 결제를 진행합니다.
            </p>
            {!ready ? (
              <button disabled>계정 확인 중</button>
            ) : (
              <button
                type="button"
                onClick={preparePayment}
                disabled={busy}
                className="checkout-pay-button"
              >
                {phase === "preparing"
                  ? "결제 정보 확인 중..."
                  : email
                    ? "결제 정보 확인하기"
                    : "로그인 후 구매"}
              </button>
            )}
          </>
        )}

        <p className="checkout-account-note">
          {email
            ? email + " 계정으로 구매합니다."
            : "구매하려면 먼저 로그인해주세요."}
        </p>

        <Link href={"/products/" + encodeURIComponent(productSlug)}>
          ← 상품으로 돌아가기
        </Link>
      </aside>
    </div>
  );
}
