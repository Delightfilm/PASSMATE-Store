"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { accountDisplayName } from "@/lib/account-display-name";
import { AccountStudy } from "@/components/account-study";
import { AccountReveal } from "@/components/account-reveal";

type Profile = { id: string; display_name: string | null; role: string };

export function AccountClient({ qualificationNames }: { qualificationNames: Record<string, string> }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [accountError, setAccountError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const signingOut = useRef(false);

  useEffect(() => {
    let active = true;
    let loadedId = "";
    const supabase = getSupabaseBrowserClient();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);

    async function load() {
      try {
        const { data: userData, error } = await supabase.auth.getUser();
        if (!active) return;
        if (!userData.user) {
          if (error && error.name !== "AuthSessionMissingError" && error.status !== 401) throw error;
          router.replace("/account/login/?next=/account/");
          return;
        }
        if (error) throw error;
        setUser(userData.user);
        loadedId = userData.user.id;
        const { data } = await supabase.from("profiles").select("id,display_name,role").eq("id", loadedId).abortSignal(controller.signal).maybeSingle();
        if (!active) return;
        const row = (data ?? null) as Profile | null;
        setProfile(row);
        setDisplayName(accountDisplayName(userData.user, row?.display_name));
        setLoading(false);
      } catch { if (active) { setAccountError(true); setLoading(false); } }
      finally { clearTimeout(timeout); }
    }

    setLoading(true); setAccountError(false);
    void load();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!loadedId || session?.user.id === loadedId) return;
      setUser(null); setProfile(null); setDisplayName(""); setLoading(true);
      if (!session && !signingOut.current) router.replace("/account/login/?next=/account/");
      else if (session) setRefresh(value => value + 1);
    });
    return () => { active = false; controller.abort(); clearTimeout(timeout); listener.subscription.unsubscribe(); };
  }, [router, refresh]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || displayName.trim().length < 2) return;
    setSaving(true);
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    try {
      const { error } = await supabase.from("profiles").update({ display_name: displayName.trim() }).eq("id", user.id);
      if (error) throw error;
      setMessage("이름을 저장했습니다.");
      setProfile((current) => current ? { ...current, display_name: displayName.trim() } : current);
      window.dispatchEvent(new CustomEvent("passmate-profile-updated", { detail: { userId: user.id, displayName: displayName.trim() } }));
    } catch { setMessage("이름을 저장하지 못했습니다."); }
    finally { setSaving(false); }
  }

  async function signOut() {
    signingOut.current = true;
    try {
      const { error } = await getSupabaseBrowserClient().auth.signOut();
      if (error) throw error;
      router.replace("/");
      router.refresh();
    } catch { signingOut.current = false; setMessage("로그아웃하지 못했습니다. 다시 시도해주세요."); }
  }

  if (loading) return <p className="account-muted" role="status">계정 정보를 불러오는 중입니다...</p>;
  if (accountError) return <div className="account-empty"><p>계정 정보를 불러오지 못했어요.</p><button className="button button-ghost" onClick={() => setRefresh(value => value + 1)}>다시 시도</button></div>;
  const name = accountDisplayName(user, profile?.display_name);

  return (
    <div className="account-dashboard">
      <div className="account-welcome">
        <div><h2>{name ? `${name} 님의 학습 현황` : "나의 학습 현황"}</h2><p className="account-muted">로그인 계정에 저장된 기록을 모았어요.</p></div>
        <div className="account-primary-actions"><Link className="button button-primary" href="/cbt/">문제 풀기</Link><Link className="button button-ghost" href="/library/">내 자료</Link></div>
      </div>
      {user && <AccountStudy key={user.id} userId={user.id} qualificationNames={qualificationNames} />}
      <AccountReveal className="account-panel account-settings" labelledBy="account-settings-title">
        <h3 id="account-settings-title">계정 설정</h3>
        <p className="account-email account-muted">{user?.email}</p>
        <form className="auth-form account-profile-form" onSubmit={saveProfile}>
          <div className="auth-field"><label htmlFor="profile-name">표시 이름</label><input id="profile-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} minLength={2} required /></div>
          <button className="button button-primary auth-submit" type="submit" disabled={saving}>{saving ? "저장 중..." : "이름 저장"}</button>
        </form>
        <p className="account-save-status account-muted" role="status">{message}</p>
        <div className="account-settings-actions">
          {profile?.role === "admin" && <Link className="account-text-link" href="/admin/">관리자 대시보드</Link>}
          <Link className="account-text-link" href="/account/forgot-password/">비밀번호 변경</Link>
          <button className="account-text-link" type="button" onClick={signOut}>로그아웃</button>
        </div>
      </AccountReveal>
    </div>
  );
}
