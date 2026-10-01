import type { Metadata } from "next";

export const metadata: Metadata = { title: "비밀번호 찾기 | PASSMATE", description: "계정 이메일로 비밀번호 재설정 안내를 받으세요." };

import { AuthForm } from "@/components/auth-form";
export default function ForgotPasswordPage(){return <section className="section page-section"><div className="container"><AuthForm mode="forgot" /></div></section>;}
