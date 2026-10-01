import type { Metadata } from "next";

export const metadata: Metadata = { title: "회원가입 | PASSMATE", description: "PASSMATE 계정을 만들고 학습 자료와 기록을 보관하세요." };

import { AuthForm } from "@/components/auth-form";
export default function SignupPage(){return <section className="section page-section"><div className="container"><AuthForm mode="signup" /></div></section>;}
