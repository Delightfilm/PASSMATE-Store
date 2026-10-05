import type { Metadata } from "next";
import { LearningHome } from "@/components/learning-home";

export const metadata: Metadata = { title: "자격증 기출문제 검색 · CBT 문제은행 | PASSMATE", description: "자격증을 찾아 기출문제를 풀고 틀린 문제를 복습하세요. 핵심노트 스토어도 함께 이용할 수 있어요." };

export default function Home() { return <LearningHome />; }
