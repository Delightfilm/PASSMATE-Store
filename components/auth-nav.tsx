"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export function AuthNav() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="auth-nav" aria-hidden="true" />;

  if (!user) {
    return <div className="auth-nav"><Link className="auth-nav-link" href="/account/login/">로그인</Link></div>;
  }

  return (
    <div className="auth-nav">
      <span className="auth-nav-user">{user.email}</span>
      <Link className="auth-nav-link" href="/account/">내 계정</Link>
    </div>
  );
}
