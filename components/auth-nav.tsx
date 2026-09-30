"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { readLocalStore, type LocalAttempt } from "@/lib/question-bank";

export function AuthNav({ service = "passmate" }: { service?: "passmate" | "cbt" }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  const [ongoing, setOngoing] = useState<LocalAttempt | null>(null);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const oauthError =
      search.get("error_description") ||
      search.get("error") ||
      hash.get("error_description") ||
      hash.get("error");

    if (oauthError && !window.location.pathname.startsWith("/account/")) {
      const loginUrl = new URL("/account/login/", window.location.origin);
      loginUrl.searchParams.set("next", "/library/");
      loginUrl.searchParams.set(
        "oauth_error",
        /access_denied|cancel/i.test(oauthError) ? "cancelled" : "failed"
      );
      window.location.replace(`${loginUrl.pathname}${loginUrl.search}`);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    async function sync(sessionUser: User | null) {
      setUser(sessionUser);
      setIsAdmin(false);

      if (sessionUser) {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", sessionUser.id)
          .maybeSingle();

        setIsAdmin(data?.role === "admin");
      }

      setReady(true);
    }

    void supabase.auth.getSession().then(({ data }) => {
      void sync(data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void sync(session?.user ?? null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (service !== "cbt") return;
    const sync = () => setOngoing(readLocalStore().attempts.find((item) => item.status === "in_progress") ?? null);
    sync();
    window.addEventListener("cbt-store", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("cbt-store", sync);
      window.removeEventListener("storage", sync);
    };
  }, [service]);

  if (!ready) {
    return <div className="auth-nav" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <div className="auth-nav">
        {service === "cbt" && ongoing && <ResumeLink attempt={ongoing} />}
        {service === "passmate" && <Link className="auth-nav-link" href="/account/login/?next=%2Fcart%2F">장바구니</Link>}
        <Link className="auth-nav-link" href={`/account/login/?next=${encodeURIComponent(service === "cbt" ? "/cbt/" : "/")}`}>로그인</Link>
      </div>
    );
  }

  return (
    <div className="auth-nav">
      {service === "cbt" && ongoing && <ResumeLink attempt={ongoing} />}
      <span className="auth-nav-user">{user.email}</span>
      {isAdmin && (
        <Link className="auth-nav-link" href="/admin/">관리자</Link>
      )}
      {service === "passmate" && <Link className="auth-nav-link" href="/cart/">장바구니</Link>}
      <Link className="auth-nav-link" href="/account/">내 계정</Link>
    </div>
  );
}

function ResumeLink({ attempt }: { attempt: LocalAttempt }) {
  const cert = attempt.config.certSlug || attempt.config.certId;
  return <Link className="auth-nav-resume" href={`/cbt/${encodeURIComponent(cert)}/exam/${attempt.id}/`}>이어서 풀기</Link>;
}
