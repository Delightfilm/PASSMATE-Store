"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DownloadButton } from "@/components/download-button";
import {
  isGrantDownloadReady,
  selectPreferredLibraryGrants,
  type LibraryGrant,
  type LibraryOrderState,
} from "@/lib/library-entitlements";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type LibraryRow = LibraryGrant & {
  products: {
    title: string;
    slug: string;
    display_year: number | null;
  } | null;
  product_versions: {
    version: string;
    edition_year: number | null;
  } | null;
};

export function LibraryClient() {
  const router = useRouter();
  const [rows, setRows] = useState<LibraryRow[]>([]);
  const [orders, setOrders] = useState<Record<string, LibraryOrderState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();

    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!active) return;

      if (!userData.user) {
        router.replace("/account/login/?next=/library/");
        return;
      }

      const { data, error: queryError } = await supabase
        .from("entitlements")
        .select(
          "id,status,granted_at,product_id,product_version_id,source_order_id,products(title,slug,display_year),product_versions(version,edition_year)"
        )
        .eq("status", "active")
        .order("granted_at", { ascending: false });

      if (!active) return;

      if (queryError) {
        setError(
          "구매 자료를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
        );
        setLoading(false);
        return;
      }

      const entitlementRows = (data ?? []) as unknown as LibraryRow[];
      const orderIds = [
        ...new Set(
          entitlementRows
            .map((row) => row.source_order_id)
            .filter((value): value is string => Boolean(value))
        ),
      ];

      let orderMap: Record<string, LibraryOrderState> = {};

      if (orderIds.length > 0) {
        const { data: orderData, error: orderQueryError } = await supabase
          .from("orders")
          .select("id,status,fulfillment_status")
          .in("id", orderIds);

        if (!active) return;

        if (orderQueryError) {
          setError(
            "구매 자료 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요."
          );
          setLoading(false);
          return;
        }

        orderMap = Object.fromEntries(
          ((orderData ?? []) as LibraryOrderState[]).map((order) => [
            order.id,
            order,
          ])
        );
      }

      if (!active) return;

      setRows(selectPreferredLibraryGrants(entitlementRows, orderMap));
      setOrders(orderMap);
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    return <p className="library-loading">내 자료를 확인하는 중입니다...</p>;
  }

  if (error) {
    return <p className="auth-message auth-message--error">{error}</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">PM</div>
        <h2>아직 구매한 자료가 없습니다.</h2>
        <p>
          PASSMATE 요약노트를 구매하면 이곳에서 바로 확인할 수 있습니다.
        </p>
        <Link className="button button-primary" href="/products/">
          요약노트 둘러보기
        </Link>
      </div>
    );
  }

  return (
    <div className="library-grid">
      {rows.map((row) => {
        const ready = isGrantDownloadReady(row, orders);

        return (
          <article className="library-item" key={row.id}>
            <div>
              <span className="eyebrow">
                {row.products?.display_year ??
                  row.product_versions?.edition_year ??
                  ""}{" "}
                PASSMATE
              </span>
              <h3>
                {row.products?.title ?? "PASSMATE 요약노트"}
              </h3>
              <p>
                구매일{" "}
                {new Date(row.granted_at).toLocaleDateString("ko-KR")}
              </p>
              <div className="library-meta">
                {row.product_versions?.version && (
                  <span className="library-chip">
                    {row.product_versions.version}
                  </span>
                )}
                <span className="library-chip">구매 완료</span>
              </div>
            </div>

            <div className="library-item-action">
              <div
                className={
                  "library-status" +
                  (ready ? " library-status--active" : "")
                }
              >
                {ready ? "다운로드 가능" : "자료 준비 중"}
              </div>
              <DownloadButton
                entitlementId={row.id}
                ready={ready}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
