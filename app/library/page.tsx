import type { Metadata } from "next";

export const metadata: Metadata = { title: "내 자료 | PASSMATE", description: "구매한 요약노트와 다운로드 자료를 확인하세요." };

import { LibraryClient } from "@/components/library-client";

export default function LibraryPage() {
  return (
    <section className="section page-section">
      <div className="container library-wrap">
        <span className="eyebrow">MY PASSMATE</span>
        <h1 className="page-title">내 자료</h1>
        <p className="page-lead">
          구매한 PASSMATE 요약노트와 현재 자료 준비 상태를 확인할 수 있습니다.
        </p>
        <LibraryClient />
      </div>
    </section>
  );
}
