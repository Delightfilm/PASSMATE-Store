import type { Metadata } from "next";

export const metadata: Metadata = { title: "종목 선택 | CBT MATE", description: "자격증 종목을 선택하고 회차별 기출이나 모의고사를 시작하세요." };

import { QuestionBankClient } from "@/components/question-bank-client";

export default function CbtPage() { return <QuestionBankClient mode="home" />; }
