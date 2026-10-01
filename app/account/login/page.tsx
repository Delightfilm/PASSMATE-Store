import type { Metadata } from "next";

export const metadata: Metadata = { title: "로그인 | PASSMATE", description: "PASSMATE에 로그인하고 요약노트와 CBT 학습을 이어가세요." };

import { AuthForm } from "@/components/auth-form";
export default function LoginPage(){return <section className="section page-section"><div className="container"><AuthForm mode="login" /></div></section>;}
