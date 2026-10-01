import type { Metadata } from "next";

export const metadata: Metadata = { title: "비밀번호 재설정 | PASSMATE", description: "PASSMATE 계정의 비밀번호를 새로 설정하세요." };

import { AuthForm } from "@/components/auth-form";
export default function ResetPasswordPage(){return <section className="section page-section"><div className="container"><AuthForm mode="reset" /></div></section>;}
