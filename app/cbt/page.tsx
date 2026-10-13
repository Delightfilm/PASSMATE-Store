import type { Metadata } from "next";
import { publicMetadata } from "@/lib/seo";

export const metadata: Metadata = publicMetadata("자격증 기출문제·CBT 문제은행 | PASSMATE", "전기기능사·지게차운전기능사와 무대음향·무대기계·무대조명 급수별 기출문제를 찾아보세요. 종목별 회차 선택, CBT 모의시험과 오답 복습을 시작할 수 있습니다.", "/cbt/");

import { QuestionBankClient } from "@/components/question-bank-client";
import { CbtPublicIntro, PriorityQualificationLinks } from "@/components/cbt-public-content";

export default function CbtPage() { return <><CbtPublicIntro /><PriorityQualificationLinks /><QuestionBankClient mode="home" /></>; }
