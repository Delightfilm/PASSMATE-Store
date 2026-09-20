"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductCover } from "@/components/product-cover";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type PreviewProduct = {
  id: string;
  code: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  display_year: number | null;
  badge: string | null;
  features: unknown;
  price_krw: number;
  currency: string;
  is_active: boolean;
};

type PreviewVersion = {
  version: string;
  edition_year: number | null;
  status: string;
  published_at: string | null;
  created_at: string;
};

function normalizeFeatures(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function AdminProductPreview({ code }: { code: string }) {
  const [access, setAccess] = useState<"loading" | "admin" | "denied">("loading");
  const [product, setProduct] = useState<PreviewProduct | null>(null);
  const [versions, setVersions] = useState<PreviewVersion[]>([]);
  const [error, setError] = useState("");
  const [coverTheme, setCoverTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();

    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!active) return;

      if (!userData.user) {
        window.location.assign(
          `/account/login/?next=${encodeURIComponent(window.location.pathname)}`
        );
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError || profile?.role !== "admin") {
        setAccess("denied");
        return;
      }

      setAccess("admin");

      const { data: productData, error: productError } = await supabase
        .from("products")
        .select(
          "id,code,slug,title,subtitle,description,display_year,badge,features,price_krw,currency,is_active"
        )
        .eq("code", code)
        .maybeSingle();

      if (!active) return;

      if (productError) {
        setError("상품 정보를 불러오지 못했습니다.");
        return;
      }

      if (!productData) {
        setError("해당 상품을 찾을 수 없습니다.");
        return;
      }

      setProduct(productData as PreviewProduct);

      const { data: versionData, error: versionError } = await supabase
        .from("product_versions")
        .select("version,edition_year,status,published_at,created_at")
        .eq("product_id", productData.id)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (versionError) {
        setError("상품 버전 정보를 불러오지 못했습니다.");
        return;
      }

      setVersions((versionData ?? []) as PreviewVersion[]);
    }

    void load();

    return () => {
      active = false;
    };
  }, [code]);

  const features = useMemo(
    () => normalizeFeatures(product?.features),
    [product?.features]
  );

  if (access === "loading") {
    return <p className="admin-loading">관리자 권한을 확인하고 있습니다...</p>;
  }

  if (access === "denied") {
    return (
      <div className="admin-denied">
        <strong>접근 권한이 없습니다.</strong>
        <p>관리자 계정으로 로그인해주세요.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-preview-shell">
        <Link className="text-link" href="/admin/">← 관리자</Link>
        <p className="auth-message auth-message--error">{error}</p>
      </div>
    );
  }

  if (!product) {
    return <p className="admin-loading">상품 정보를 불러오는 중입니다...</p>;
  }

  const isStageSoundCore = product.code === "PM-SS3-CORE";

  return (
    <div className="admin-preview-shell">
      <div className="admin-preview-toolbar">
        <div>
          <span className="eyebrow">PRIVATE PRODUCT PREVIEW</span>
          <h1>상품 미리보기</h1>
        </div>
        <Link className="button button-ghost" href="/admin/">관리자로 돌아가기</Link>
      </div>

      <div className="admin-preview-notice">
        <strong>비공개 테스트 상품</strong>
        <span>
          현재 {product.is_active ? "공개 상태" : "비활성 상태"} · 고객 스토어에는
          {product.is_active ? " 노출될 수 있습니다." : " 노출되지 않습니다."}
        </span>
      </div>

      <section className="admin-product-preview-grid">
        <div className="admin-cover-review">
          {isStageSoundCore ? (
            <div className="cover-theme-switch" role="group" aria-label="표지 디자인 선택">
              {(["light", "dark"] as const).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  className={
                    coverTheme === theme
                      ? "cover-theme-option cover-theme-option--active"
                      : "cover-theme-option"
                  }
                  aria-pressed={coverTheme === theme}
                  onClick={() => setCoverTheme(theme)}
                >
                  {theme === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
          ) : null}
          <div className="product-cover-wrap">
            <ProductCover
              theme={isStageSoundCore ? coverTheme : "dark"}
              year={product.display_year ?? 2026}
              titleLines={
                isStageSoundCore
                  ? ["무대음향", "3급"]
                  : [product.title]
              }
              label={isStageSoundCore ? "핵심노트" : product.badge ?? "PASSMATE"}
              subtitle={
                isStageSoundCore
                  ? "핵심개념 · 공식·수치 · 시험 직전 체크"
                  : product.subtitle ?? ""
              }
              series={isStageSoundCore ? "STAGE SOUND" : product.code}
            />
          </div>
        </div>

        <div className="product-info">
          <span className="pill">{product.badge ?? "PASSMATE"}</span>
          <h1>{product.title}</h1>
          <p className="product-subtitle">{product.subtitle}</p>
          <p>{product.description}</p>

          <ul className="check-list">
            {features.map((feature) => (
              <li key={feature}>✓ {feature}</li>
            ))}
          </ul>

          <div className="price-row">
            <strong>{product.price_krw.toLocaleString("ko-KR")}원</strong>
            <span>디지털 PDF 패키지</span>
          </div>

          <button className="button button-primary button-wide" type="button" disabled>
            테스트 상품 · 구매 비활성
          </button>
          <p className="fine-print">
            ※ 관리자 미리보기입니다. 공개/결제 연결 전 디자인과 상품 정보를 확인합니다.
          </p>
        </div>
      </section>

      <section className="admin-preview-meta">
        <div>
          <span>상품 코드</span>
          <strong>{product.code}</strong>
        </div>
        <div>
          <span>Slug</span>
          <strong>{product.slug}</strong>
        </div>
        <div>
          <span>상태</span>
          <strong>{product.is_active ? "Active" : "Inactive"}</strong>
        </div>
        <div>
          <span>가격</span>
          <strong>{product.price_krw.toLocaleString("ko-KR")} {product.currency}</strong>
        </div>
      </section>

      <section className="admin-section">
        <h2>버전</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>버전</th>
                <th>Edition</th>
                <th>상태</th>
                <th>Published</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.version}>
                  <td><code>{version.version}</code></td>
                  <td>{version.edition_year ?? "-"}</td>
                  <td>{version.status}</td>
                  <td>
                    {version.published_at
                      ? new Date(version.published_at).toLocaleString("ko-KR")
                      : "-"}
                  </td>
                </tr>
              ))}
              {versions.length === 0 && (
                <tr><td colSpan={4}>등록된 버전이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
