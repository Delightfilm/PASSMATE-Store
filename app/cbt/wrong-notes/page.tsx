import type { Metadata } from "next";

export const metadata: Metadata = { title: "오답노트 | CBT MATE", description: "틀린 문제를 필터링하고 메모하며 다시 풀어보세요." };

import { QuestionBankClient } from "@/components/question-bank-client";

export default function WrongNotesPage() { return <QuestionBankClient mode="wrong-notes" />; }
