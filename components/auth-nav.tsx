"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export function AuthNav() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);

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

  if (!ready) {
    return <div className="auth-nav" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <div className="auth-nav">
        <Link className="auth-nav-link" href="/account/login/">로그인</Link>
      </div>
    );
  }

  return (
    <div className="auth-nav">
      <span className="auth-nav-user">{user.email}</span>
      {isAdmin && (
        <Link className="auth-nav-link" href="/admin/">관리자</Link>
      )}
      <Link className="auth-nav-link" href="/account/">내 계정</Link>
    </div>
  );
}
