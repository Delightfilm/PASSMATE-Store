import type { Metadata } from "next";

export const metadata: Metadata = { title: "관리자 | PASSMATE", description: "상품과 CBT 문제 데이터를 관리하는 관리자 화면입니다." };

import { AdminClient } from "@/components/admin-client";

export default function AdminPage() {
  return (
    <section className="store-admin-page">
      <AdminClient />
    </section>
  );
}
