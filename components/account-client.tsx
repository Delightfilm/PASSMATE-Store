"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Profile = { id: string; display_name: string | null; role: string };

export function AccountClient() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();

    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!active) return;
      if (!userData.user) {
        router.replace("/account/login/?next=/account/");
        return;
      }
      setUser(userData.user);
      const { data } = await supabase.from("profiles").select("id,display_name,role").eq("id", userData.user.id).maybeSingle();
      if (!active) return;
      const row = (data ?? null) as Profile | null;
      setProfile(row);
      setDisplayName(row?.display_name ?? "");
      setLoading(false);
    }

    void load();
    return () => { active = false; };
  }, [router]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || displayName.trim().length < 2) return;
    setSaving(true);
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("profiles").update({ display_name: displayName.trim() }).eq("id", user.id);
    setSaving(false);
    setMessage(error ? "이름을 저장하지 못했습니다." : "이름을 저장했습니다.");
    if (!error) setProfile((current) => current ? { ...current, display_name: displayName.trim() } : current);
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  if (loading) return <p className="library-loading">계정 정보를 불러오는 중입니다...</p>;

  return (
    <div className="account-card">
      <div className="account-summary">
        <span>이메일</span><strong>{user?.email ?? "-"}</strong>
        <span>계정</span><strong>{profile?.display_name || "PASSMATE 회원"}</strong>
      </div>
      <form className="auth-form" onSubmit={saveProfile}>
        <div className="auth-field"><label htmlFor="profile-name">표시 이름</label><input id="profile-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} minLength={2} required /></div>
        <button className="button button-primary auth-submit" type="submit" disabled={saving}>{saving ? "저장 중..." : "이름 저장"}</button>
      </form>
      {message && <p className="auth-note">{message}</p>}
      <div className="account-actions">
        <Link className="button button-ghost" href="/library/">내 자료 보기</Link>
        <Link className="button button-ghost" href="/account/forgot-password/">비밀번호 변경</Link>
        <button className="button button-ghost auth-submit" type="button" onClick={signOut}>로그아웃</button>
      </div>
    </div>
  );
}
