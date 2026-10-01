import type { Metadata } from "next";

export const metadata: Metadata = { title: "내 기록 | CBT MATE", description: "응시 이력과 단원별 정답률을 확인하세요." };

import { QuestionBankClient } from "@/components/question-bank-client";

export default function HistoryPage() { return <QuestionBankClient mode="history" />; }
