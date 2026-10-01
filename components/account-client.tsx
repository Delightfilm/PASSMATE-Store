"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { readLocalStore } from "@/lib/question-bank";

type Profile = { id: string; display_name: string | null; role: string };

export function AccountClient() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [cbtSummary, setCbtSummary] = useState({ attempts: 0, wrong: 0, bookmarks: 0 });

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
      const local = readLocalStore();
      setLoading(false);
    }

    void load();
    const local = readLocalStore();
    setCbtSummary({ attempts: local.attempts.filter((item) => item.status === "submitted").length, wrong: Object.keys(local.wrongNotes).length, bookmarks: local.bookmarks.length });
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
      </div>
      <form className="auth-form" onSubmit={saveProfile}>
        <div className="auth-field"><label htmlFor="profile-name">표시 이름</label><input id="profile-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} minLength={2} required /></div>
        <button className="button button-primary auth-submit" type="submit" disabled={saving}>{saving ? "저장 중..." : "이름 저장"}</button>
      </form>
      {message && <p className="auth-note">{message}</p>}
      <section className="account-cbt-summary" aria-label="CBT Mate 기록">
        <div><span>모의고사</span><strong>{cbtSummary.attempts}회</strong></div>
        <div><span>오답노트</span><strong>{cbtSummary.wrong}개</strong></div>
        <div><span>북마크</span><strong>{cbtSummary.bookmarks}개</strong></div>
      </section>
      <div className="account-actions">
        <div className="account-actions-main">
        {profile?.role === "admin" && (
          <Link className="button button-primary" href="/admin/">관리자 대시보드</Link>
        )}
        <Link className="button button-ghost" href="/library/">내 자료 보기</Link>
        <Link className="button button-ghost" href="/cbt/">CBT MATE 문제은행</Link>
        </div>
        <div className="account-actions-secondary">
        <Link className="button button-ghost" href="/account/forgot-password/">비밀번호 변경</Link>
        <button className="button button-logout auth-submit" type="button" onClick={signOut}>로그아웃</button>
        </div>
      </div>
    </div>
  );
}
