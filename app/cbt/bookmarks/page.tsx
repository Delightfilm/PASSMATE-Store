import type { Metadata } from "next";

export const metadata: Metadata = { title: "북마크 | CBT MATE", description: "저장한 문제를 모아보고 다시 학습하세요." };

import { QuestionBankClient } from "@/components/question-bank-client";

export default function BookmarksPage() { return <QuestionBankClient mode="bookmarks" />; }
