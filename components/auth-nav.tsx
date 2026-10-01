"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { readLocalStore, type LocalAttempt } from "@/lib/question-bank";

export function AuthNav({ service = "passmate" }: { service?: "passmate" | "cbt" }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  const [ongoing, setOngoing] = useState<LocalAttempt | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      if (menuRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
      setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMenuOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [menuOpen]);

  function moveMenu(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    if (!menuOpen) {
      event.preventDefault();
      setMenuOpen(true);
      requestAnimationFrame(() => {
        const links = menuRef.current?.querySelectorAll<HTMLAnchorElement>(".auth-menu-panel a");
        links?.[event.key === "ArrowUp" || event.key === "End" ? links.length - 1 : 0]?.focus();
      });
      return;
    }
    const links = Array.from(menuRef.current?.querySelectorAll<HTMLAnchorElement>(".auth-menu-panel a") || []);
    if (!links.length) return;
    event.preventDefault();
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : event.key === "ArrowDown" ? (index + 1) % links.length : (index - 1 + links.length) % links.length;
    links[next].focus();
  }

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

  return (
    <div className="auth-nav">
      {service === "cbt" && ongoing && <ResumeLink attempt={ongoing} />}
      <div className="auth-menu" ref={menuRef} onKeyDown={moveMenu} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false); }}>
        <button ref={triggerRef} type="button" className="auth-nav-link auth-menu-trigger" aria-label={user ? "계정 메뉴" : "메뉴"} aria-expanded={menuOpen} aria-controls="account-menu-panel" onClick={() => setMenuOpen((open) => !open)}><span>{user ? "내 계정" : "메뉴"}</span><span className="auth-menu-icon" aria-hidden="true">☰</span></button>
        <nav id="account-menu-panel" className="auth-menu-panel" aria-label="계정 및 서비스 메뉴" hidden={!menuOpen}>
          {user && <span className="auth-menu-email">{user.email}</span>}
          <Link className="auth-menu-store-link" href="/products/">요약노트</Link>
          <Link className="auth-menu-store-link" href="/library/">내 자료</Link>
          {isAdmin && <Link href="/admin/">관리자</Link>}
          {service === "passmate" && <Link href={user ? "/cart/" : "/account/login/?next=%2Fcart%2F"}>장바구니</Link>}
          <Link href={user ? "/account/" : `/account/login/?next=${encodeURIComponent(service === "cbt" ? "/cbt/" : "/")}`}>{user ? "내 계정" : "로그인"}</Link>
        </nav>
      </div>
    </div>
  );
}

function ResumeLink({ attempt }: { attempt: LocalAttempt }) {
  const cert = attempt.config.certSlug || attempt.config.certId;
  return <Link className="auth-nav-resume" aria-label="이어서 풀기" href={`/cbt/${encodeURIComponent(cert)}/exam/${attempt.id}/`}><span>이어서 풀기</span><span className="auth-resume-icon" aria-hidden="true">▶</span></Link>;
}
