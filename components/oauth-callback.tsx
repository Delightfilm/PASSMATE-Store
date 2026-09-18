"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSafeNextPath } from "@/lib/auth-ui";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

function getProviderError(): string | null {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  return search.get("error_description") || search.get("error") || hash.get("error_description") || hash.get("error");
}

export function OAuthCallback() {
  const router = useRouter();
  const [loginPath, setLoginPath] = useState("/account/login/");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextPath = getSafeNextPath(params.get("next"));
    const loginUrl = new URL("/account/login/", window.location.origin);
    loginUrl.searchParams.set("next", nextPath);
    setLoginPath(`${loginUrl.pathname}${loginUrl.search}`);

    const providerError = getProviderError();
    if (providerError) {
      loginUrl.searchParams.set(
        "oauth_error",
        /access_denied|cancel/i.test(providerError) ? "cancelled" : "failed"
      );
      router.replace(`${loginUrl.pathname}${loginUrl.search}`);
      return;
    }

    let active = true;
    let completed = false;
    const supabase = getSupabaseBrowserClient();

    const finish = () => {
      if (!active || completed) return;
      completed = true;
      router.replace(nextPath);
      router.refresh();
    };

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish();
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || completed) return;
      if (data.session) {
        finish();
        return;
      }
      if (error || !data.session) setFailed(true);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="account-shell">
      <span className="eyebrow">SNS LOGIN</span>
      <h1 className="page-title">로그인 확인 중</h1>
      <p className="page-lead">PASSMATE 계정과 안전하게 연결하고 있습니다.</p>
      <div className="auth-card auth-callback" aria-live="polite">
        {failed ? (
          <>
            <p className="auth-message auth-message--error">SNS 로그인을 완료하지 못했습니다. 다시 시도해주세요.</p>
            <Link className="button button-primary button-wide" href={loginPath}>로그인 화면으로 돌아가기</Link>
          </>
        ) : (
          <p className="auth-note">잠시만 기다려주세요...</p>
        )}
      </div>
    </div>
  );
}
