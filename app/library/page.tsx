import type { Metadata } from "next";

export const metadata: Metadata = { title: "내 자료 | PASSMATE", description: "구매한 요약노트와 다운로드 자료를 확인하세요." };

import { LibraryClient } from "@/components/library-client";

export default function LibraryPage() {
  return (
    <section className="section page-section">
      <div className="container library-wrap">
        <h1 className="page-title">내 자료</h1>
        <LibraryClient />
      </div>
    </section>
  );
}
