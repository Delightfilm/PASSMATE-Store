"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthErrorMessage, getSafeNextPath } from "@/lib/auth-ui";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Mode = "login" | "signup" | "forgot" | "reset";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [nextPath, setNextPath] = useState("/library/");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(getSafeNextPath(params.get("next")));

    if (mode === "login" && params.get("confirmed") === "1") {
      const supabase = getSupabaseBrowserClient();
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session) router.replace(getSafeNextPath(params.get("next")));
      });
    }
  }, [mode, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setBusy(true);
    const supabase = getSupabaseBrowserClient();

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(nextPath);
        router.refresh();
        return;
      }

      if (mode === "signup") {
        if (displayName.trim().length < 2) {
          setMessage({ kind: "error", text: "이름을 2자 이상 입력해주세요." });
          return;
        }
        if (password.length < 8) {
          setMessage({ kind: "error", text: "비밀번호는 8자 이상 입력해주세요." });
          return;
        }
        if (password !== passwordConfirm) {
          setMessage({ kind: "error", text: "비밀번호가 서로 다릅니다." });
          return;
        }

        const emailRedirectTo = `${window.location.origin}/account/login/?confirmed=1`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: displayName.trim() }, emailRedirectTo },
        });
        if (error) throw error;
        if (data.session) {
          router.replace("/library/");
          return;
        }
        setMessage({ kind: "success", text: "가입 요청이 완료되었습니다. 이메일 인증 메일이 도착했다면 인증 후 로그인해주세요." });
        return;
      }

      if (mode === "forgot") {
        const redirectTo = `${window.location.origin}/account/reset-password/`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
        setMessage({ kind: "success", text: "비밀번호 재설정 메일을 보냈습니다. 받은 편지함을 확인해주세요." });
        return;
      }

      if (password.length < 8) {
        setMessage({ kind: "error", text: "새 비밀번호는 8자 이상 입력해주세요." });
        return;
      }
      if (password !== passwordConfirm) {
        setMessage({ kind: "error", text: "비밀번호가 서로 다릅니다." });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage({ kind: "success", text: "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요." });
      await supabase.auth.signOut();
      window.setTimeout(() => router.replace("/account/login/"), 900);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setMessage({ kind: "error", text: getAuthErrorMessage(text) });
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Mode, { eyebrow: string; title: string; lead: string; submit: string }> = {
    login: { eyebrow: "WELCOME BACK", title: "로그인", lead: "구매한 PASSMATE 자료를 확인하려면 로그인해주세요.", submit: "로그인" },
    signup: { eyebrow: "JOIN PASSMATE", title: "회원가입", lead: "구매한 요약노트를 한 곳에서 관리할 PASSMATE 계정을 만듭니다.", submit: "계정 만들기" },
    forgot: { eyebrow: "PASSWORD RESET", title: "비밀번호 찾기", lead: "가입한 이메일로 비밀번호 재설정 링크를 보내드립니다.", submit: "재설정 메일 보내기" },
    reset: { eyebrow: "NEW PASSWORD", title: "새 비밀번호 설정", lead: "새로 사용할 비밀번호를 입력해주세요.", submit: "비밀번호 변경" },
  };
  const copy = titles[mode];

  return (
    <div className="account-shell">
      <span className="eyebrow">{copy.eyebrow}</span>
      <h1 className="page-title">{copy.title}</h1>
      <p className="page-lead">{copy.lead}</p>
      <div className="auth-card">
        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && <div className="auth-field"><label htmlFor="display-name">이름</label><input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" required /></div>}
          {mode !== "reset" && <div className="auth-field"><label htmlFor="email">이메일</label><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></div>}
          {(mode === "login" || mode === "signup" || mode === "reset") && <div className="auth-field"><label htmlFor="password">{mode === "reset" ? "새 비밀번호" : "비밀번호"}</label><input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required /></div>}
          {(mode === "signup" || mode === "reset") && <div className="auth-field"><label htmlFor="password-confirm">비밀번호 확인</label><input id="password-confirm" type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} autoComplete="new-password" minLength={8} required /></div>}
          <button className="button button-primary button-wide auth-submit" type="submit" disabled={busy}>{busy ? "처리 중..." : copy.submit}</button>
        </form>
        {message && <p className={`auth-message auth-message--${message.kind}`} role="status">{message.text}</p>}
        {mode === "login" ? (
          <div className="auth-links"><Link href="/account/signup/">회원가입</Link><Link href="/account/forgot-password/">비밀번호 찾기</Link></div>
        ) : (
          <div className="auth-links"><Link href="/account/login/">로그인으로 돌아가기</Link></div>
        )}
      </div>
    </div>
  );
}
