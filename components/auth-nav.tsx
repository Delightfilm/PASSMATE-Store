"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { readLocalStore, type LocalAttempt } from "@/lib/question-bank";
import { accountDisplayName } from "@/lib/account-display-name";

export function AuthNav({ service = "passmate" }: { service?: "passmate" | "cbt" }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [displayName, setDisplayName] = useState("");
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
    const visibleLinks = () => Array.from(menuRef.current?.querySelectorAll<HTMLAnchorElement>(".auth-menu-panel a") || []).filter((link) => link.getClientRects().length > 0);
    if (!menuOpen) {
      event.preventDefault();
      setMenuOpen(true);
      requestAnimationFrame(() => {
        const links = visibleLinks();
        links[event.key === "ArrowUp" || event.key === "End" ? links.length - 1 : 0]?.focus();
      });
      return;
    }
    const links = visibleLinks();
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
    let active = true, revision = 0;
    let syncTimer: ReturnType<typeof setTimeout>;
    let profileController: AbortController | null = null;

    async function sync(sessionUser: User | null) {
      const current = ++revision;
      profileController?.abort();
      if (!active) return;
      setUser(sessionUser);
      setIsAdmin(false);
      setDisplayName(accountDisplayName(sessionUser));
      setReady(true);

      if (sessionUser) {
        const controller = new AbortController();
        profileController = controller;
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
        const { data } = await supabase
          .from("profiles")
          .select("role,display_name")
          .eq("id", sessionUser.id)
          .abortSignal(controller.signal).maybeSingle();

        if (!active || current !== revision) return;
        setIsAdmin(data?.role === "admin");
        setDisplayName(accountDisplayName(sessionUser, data?.display_name));
        } catch { /* Keep the metadata greeting if the profile is unavailable. */ }
        finally { clearTimeout(timeout); }
      }

    }

    void supabase.auth.getSession().then(({ data }) => {
      void sync(data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => { void sync(session?.user ?? null); }, 0);
      }
    );

    return () => { active = false; ++revision; clearTimeout(syncTimer); profileController?.abort(); listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ userId: string; displayName: string }>).detail;
      if (detail?.userId === user?.id && typeof detail.displayName === "string") setDisplayName(detail.displayName.trim());
    };
    window.addEventListener("passmate-profile-updated", update);
    return () => window.removeEventListener("passmate-profile-updated", update);
  }, [user?.id]);

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
    <div className={`auth-nav${user ? " auth-nav--signed-in" : ""}`}>
      <div className="auth-menu" ref={menuRef} onKeyDown={moveMenu} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false); }}>
        <button ref={triggerRef} type="button" className="auth-nav-link auth-menu-trigger" aria-label={user ? `${displayName ? `${displayName} 님의 ` : ""}계정 메뉴` : "메뉴"} aria-haspopup="true" aria-expanded={menuOpen} aria-controls="account-menu-panel" onClick={() => setMenuOpen((open) => !open)}><svg className="auth-menu-user-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c0-4 3-6.5 7.5-6.5s7.5 2.5 7.5 6.5" /></svg><span className="auth-menu-label">{user ? <span className="auth-greeting"><span className="auth-greeting-name">{displayName ? `${displayName} 님` : "내 계정"}</span><span className="auth-greeting-wave" aria-hidden="true">👋</span></span> : "메뉴"}</span><svg className="auth-menu-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m3 6 5 5 5-5" /></svg><span className="auth-menu-icon" aria-hidden="true">☰</span></button>
        <nav id="account-menu-panel" className="auth-menu-panel" aria-label="계정 및 서비스 메뉴" hidden={!menuOpen}>
          {user && <span className="auth-menu-email">{user.email}</span>}
          {service === "cbt" && ongoing && <ResumeLink attempt={ongoing} />}
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
  return <Link className="auth-menu-resume" href={`/cbt/${encodeURIComponent(cert)}/exam/${attempt.id}/`}>이어서 풀기</Link>;
}
