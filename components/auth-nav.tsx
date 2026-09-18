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
        <Link className="auth-nav-link" href="/admin/">관리</Link>
      )}
      <Link className="auth-nav-link" href="/account/">내 계정</Link>
    </div>
  );
}
