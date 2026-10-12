import type { Metadata } from "next";
import { publicMetadata } from "@/lib/seo";

export const metadata: Metadata = publicMetadata("자격증·공무원 시험 기출문제 종목 찾기 | PASSMATE", "준비하는 자격증이나 공무원 시험을 찾아보세요. 종목별 회차와 기출문제를 확인하고 CBT 문제풀이와 모의고사를 시작할 수 있습니다.", "/cbt/");

import { QuestionBankClient } from "@/components/question-bank-client";

export default function CbtPage() { return <QuestionBankClient mode="home" />; }
