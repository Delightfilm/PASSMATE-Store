"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getPublicSupabaseConfig } from "@/lib/public-supabase-config";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type MenuKey =
  | "overview"
  | "products"
  | "versions"
  | "orders"
  | "issuance"
  | "test"
  | "settings";

type Summary = {
  orders_total: number;
  orders_paid: number;
  orders_payment_pending: number;
  orders_ready: number;
  orders_fulfillment_failed: number;
  jobs_queued: number;
  jobs_leased: number;
  jobs_retry_wait: number;
  jobs_dead_letter: number;
  payment_failures: number;
  downloads_today: number;
  artifacts_active: number;
  artifacts_integrity_attention: number;
};

type OrderRow = {
  order_id: string;
  created_at: string;
  status: string;
  fulfillment_status: string;
  total_amount_krw: number;
  channel: string;
  payment_provider: string | null;
  state_version: number;
  product_summary: string;
  latest_payment_status: string | null;
};

type JobRow = {
  job_id: string;
  order_id: string;
  product_code: string;
  product_version: string;
  status: string;
  generation: number;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string;
  lease_owner: string | null;
  last_error_code: string | null;
  completed_at: string | null;
  created_at: string;
};

type ArtifactRow = {
  artifact_id: string;
  internal_ref: string;
  order_id: string;
  product_code: string;
  product_version: string;
  artifact_code: string;
  generation: number;
  lifecycle_status: string;
  integrity_status: string;
  sha256: string;
  size_bytes: number;
  registered_at: string;
  last_verified_at: string | null;
};

type CatalogRow = {
  product_id: string;
  code: string;
  title: string;
  price_krw: number;
  is_active: boolean;
  latest_version: string | null;
  latest_version_status: string | null;
  version_count: number;
};

type ProductRow = {
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
  created_at: string;
  updated_at: string;
};

type VersionRow = {
  id: string;
  product_id: string;
  version: string;
  edition_year: number | null;
  status: string;
  published_at: string | null;
  created_at: string;
};

type AdminActionEventRow = {
  id: number;
  actor_user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  detail: unknown;
  created_at: string;
};

type ProductForm = {
  code: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  displayYear: string;
  badge: string;
  featuresText: string;
  priceKrw: string;
  isActive: boolean;
  initialVersion: string;
};

const EMPTY_PRODUCT_FORM: ProductForm = {
  code: "",
  slug: "",
  title: "",
  subtitle: "",
  description: "",
  displayYear: "2026",
  badge: "2026 EDITION",
  featuresText: "",
  priceKrw: "5900",
  isActive: false,
  initialVersion: "2026-v0.1-draft",
};

async function callAdmin<T>(
  path: "admin-data" | "admin-action",
  token: string,
  body: Record<string, unknown>
): Promise<T> {
  const { url, key } = getPublicSupabaseConfig();
  const response = await fetch(url + "/functions/v1/" + path, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const code = typeof payload.error === "string" ? payload.error : path + ":" + response.status;
    throw new Error(code);
  }

  return payload as T;
}

function shortId(value: string): string {
  return value.slice(0, 8);
}

function actionLabel(value: string): string {
  const labels: Record<string, string> = {
    create_product: "상품 생성",
    update_product: "상품 수정",
    expedite_retry_wait: "발행 재시도",
    reissue_dead_letter: "발행 재생성",
    verify_issuance_artifact: "무결성 확인",
  };
  return labels[value] ?? value;
}

function featureStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function statusLabel(value: string | null): string {
  const labels: Record<string, string> = {
    pending: "주문 대기",
    payment_pending: "결제 중",
    paid: "결제 완료",
    failed: "실패",
    cancelled: "취소",
    refunded: "환불",
    not_started: "준비 전",
    queued: "발행 대기",
    issuing: "발행 중",
    ready: "자료 완료",
    revoked: "회수",
    leased: "작업 중",
    retry_wait: "재시도 대기",
    succeeded: "발행 완료",
    dead_letter: "수동 확인",
    active: "현재본",
    superseded: "이전본",
    unchecked: "미확인",
    verified: "정상",
    mismatch: "불일치",
    unavailable: "확인 불가",
    draft: "초안",
    published: "게시됨",
    archived: "보관됨",
  };
  return value ? labels[value] ?? value : "-";
}

function menuTitle(menu: MenuKey): string {
  const titles: Record<MenuKey, string> = {
    overview: "대시보드",
    products: "상품 관리",
    versions: "콘텐츠 · 버전",
    orders: "주문 관리",
    issuance: "발행 · 다운로드",
    test: "테스트 센터",
    settings: "관리자 설정",
  };
  return titles[menu];
}

export function AdminClient() {
  const router = useRouter();
  const [access, setAccess] = useState<"loading" | "admin" | "denied">("loading");
  const [activeMenu, setActiveMenu] = useState<MenuKey>("products");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [events, setEvents] = useState<AdminActionEventRow[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyJob, setBusyJob] = useState<string | null>(null);
  const [busyArtifact, setBusyArtifact] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_PRODUCT_FORM);

  const activeProducts = useMemo(
    () => products.filter((product) => product.is_active).length,
    [products]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((product) => {
      const statusOk =
        statusFilter === "all" ||
        (statusFilter === "active" && product.is_active) ||
        (statusFilter === "inactive" && !product.is_active);
      const queryOk =
        !q ||
        product.title.toLowerCase().includes(q) ||
        product.code.toLowerCase().includes(q) ||
        product.slug.toLowerCase().includes(q);
      return statusOk && queryOk;
    });
  }, [products, search, statusFilter]);

  const versionsByProduct = useMemo(() => {
    const map = new Map<string, VersionRow[]>();
    for (const version of versions) {
      const list = map.get(version.product_id) ?? [];
      list.push(version);
      map.set(version.product_id, list);
    }
    return map;
  }, [versions]);

  async function token(): Promise<string | null> {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function loadAll(accessToken: string) {
    const supabase = getSupabaseBrowserClient();

    const [
      summaryResult,
      orderResult,
      jobResult,
      artifactResult,
      catalogResult,
      eventResult,
      productResult,
      versionResult,
    ] = await Promise.all([
      callAdmin<{ data: Summary }>("admin-data", accessToken, { view: "summary" }),
      callAdmin<{ data: OrderRow[] }>("admin-data", accessToken, {
        view: "orders",
        limit: 100,
      }),
      callAdmin<{ data: JobRow[] }>("admin-data", accessToken, {
        view: "jobs",
        limit: 150,
      }),
      callAdmin<{ data: ArtifactRow[] }>("admin-data", accessToken, {
        view: "artifacts",
        limit: 150,
      }),
      callAdmin<{ data: CatalogRow[] }>("admin-data", accessToken, {
        view: "catalog",
      }),
      callAdmin<{ data: AdminActionEventRow[] }>("admin-data", accessToken, {
        view: "events",
        limit: 100,
      }),
      supabase
        .from("products")
        .select(
          "id,code,slug,title,subtitle,description,display_year,badge,features,price_krw,currency,is_active,created_at,updated_at"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("product_versions")
        .select("id,product_id,version,edition_year,status,published_at,created_at")
        .order("created_at", { ascending: false }),
    ]);

    if (productResult.error) throw new Error("product_read_failed");
    if (versionResult.error) throw new Error("version_read_failed");

    setSummary(summaryResult.data);
    setOrders(orderResult.data ?? []);
    setJobs(jobResult.data ?? []);
    setArtifacts(artifactResult.data ?? []);
    setCatalog(catalogResult.data ?? []);
    setEvents(eventResult.data ?? []);
    setProducts((productResult.data ?? []) as ProductRow[]);
    setVersions((versionResult.data ?? []) as VersionRow[]);
  }

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();

    async function boot() {
      const { data: userData } = await supabase.auth.getUser();
      if (!active) return;

      if (!userData.user) {
        router.replace("/account/login/?next=/admin/");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (!active) return;

      if (profile?.role !== "admin") {
        setAccess("denied");
        return;
      }

      setAccess("admin");
      const accessToken = await token();
      if (!accessToken) return;

      try {
        await loadAll(accessToken);
      } catch (loadError) {
        console.error("[PASSMATE] admin load failed", loadError);
        setError("관리 데이터를 불러오지 못했습니다.");
      }
    }

    void boot();
    return () => {
      active = false;
    };
  }, [router]);

  async function refresh() {
    const accessToken = await token();
    if (!accessToken) return;
    setError("");
    setNotice("");
    try {
      await loadAll(accessToken);
    } catch (refreshError) {
      console.error("[PASSMATE] admin refresh failed", refreshError);
      setError("새로고침에 실패했습니다.");
    }
  }

  function openCreate() {
    setEditorMode("create");
    setEditingProductId(null);
    setForm(EMPTY_PRODUCT_FORM);
    setError("");
    setNotice("");
  }

  function openEdit(product: ProductRow) {
    setEditorMode("edit");
    setEditingProductId(product.id);
    setForm({
      code: product.code,
      slug: product.slug,
      title: product.title,
      subtitle: product.subtitle ?? "",
      description: product.description ?? "",
      displayYear: String(product.display_year ?? 2026),
      badge: product.badge ?? "",
      featuresText: featureStrings(product.features).join("\n"),
      priceKrw: String(product.price_krw),
      isActive: product.is_active,
      initialVersion: "",
    });
    setError("");
    setNotice("");
  }

  async function saveProduct() {
    const accessToken = await token();
    if (!accessToken || busy) return;

    const features = form.featuresText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    const displayYear = Number.parseInt(form.displayYear, 10);
    const priceKrw = Number.parseInt(form.priceKrw, 10);

    if (!form.title.trim() || !Number.isFinite(displayYear) || !Number.isFinite(priceKrw)) {
      setError("상품명, 연도, 가격을 확인해주세요.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      if (editorMode === "create") {
        await callAdmin<{ result: string }>("admin-action", accessToken, {
          action: "create_product",
          code: form.code.trim().toUpperCase(),
          slug: form.slug.trim().toLowerCase(),
          title: form.title.trim(),
          subtitle: form.subtitle.trim(),
          description: form.description.trim(),
          displayYear,
          badge: form.badge.trim(),
          features,
          priceKrw,
          initialVersion: form.initialVersion.trim(),
        });
        setNotice("새 상품을 비공개 초안으로 만들었습니다.");
      } else if (editingProductId) {
        await callAdmin<{ result: string }>("admin-action", accessToken, {
          action: "update_product",
          productId: editingProductId,
          title: form.title.trim(),
          subtitle: form.subtitle.trim(),
          description: form.description.trim(),
          displayYear,
          badge: form.badge.trim(),
          features,
          priceKrw,
          isActive: form.isActive,
        });
        setNotice("상품 데이터를 저장했습니다.");
      }

      await loadAll(accessToken);
      setEditorMode(null);
      setEditingProductId(null);
    } catch (saveError) {
      const code = saveError instanceof Error ? saveError.message : "";
      if (code === "published_version_required") {
        setError("판매중으로 바꾸려면 먼저 게시된(published) 버전이 필요합니다.");
      } else if (code === "product_already_exists") {
        setError("같은 상품 코드 또는 주소(slug)가 이미 있습니다.");
      } else {
        setError("상품 저장에 실패했습니다. 입력값을 다시 확인해주세요.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function retryJob(jobId: string) {
    const accessToken = await token();
    if (!accessToken || busyJob) return;

    setBusyJob(jobId);
    setError("");
    try {
      await callAdmin<{ result: string }>("admin-action", accessToken, {
        action: "retry_issuance",
        jobId,
      });
      await loadAll(accessToken);
    } catch (actionError) {
      console.error("[PASSMATE] admin retry failed", actionError);
      setError("재시도 요청을 처리하지 못했습니다.");
    } finally {
      setBusyJob(null);
    }
  }

  async function verifyArtifact(artifactId: string) {
    const accessToken = await token();
    if (!accessToken || busyArtifact) return;

    setBusyArtifact(artifactId);
    setError("");
    try {
      await callAdmin<{ result: string }>("admin-action", accessToken, {
        action: "verify_artifact",
        artifactId,
      });
      await loadAll(accessToken);
    } catch (actionError) {
      console.error("[PASSMATE] artifact verification failed", actionError);
      setError("발행본 확인을 완료하지 못했습니다.");
    } finally {
      setBusyArtifact(null);
    }
  }

  if (access === "loading") {
    return <p className="admin-loading">관리자 계정을 확인하고 있습니다...</p>;
  }

  if (access === "denied") {
    return (
      <div className="admin-denied">
        <strong>관리자 전용 페이지입니다.</strong>
        <p>지정된 카카오 관리자 계정으로 로그인해주세요.</p>
        <Link className="button button-primary" href="/account/login/?next=/admin/">
          관리자 로그인
        </Link>
      </div>
    );
  }

  return (
    <div className="store-admin-shell">
      <aside className="store-admin-sidebar">
        <div className="store-admin-brand">
          <span>PASSMATE</span>
          <strong>관리자</strong>
          <small>jhpodong@naver.com</small>
        </div>

        <AdminNavGroup label="관리">
          <AdminNavButton active={activeMenu === "overview"} onClick={() => setActiveMenu("overview")}>
            홈
          </AdminNavButton>
        </AdminNavGroup>

        <AdminNavGroup label="상품 · 데이터">
          <AdminNavButton active={activeMenu === "products"} onClick={() => setActiveMenu("products")}>
            상품 관리
          </AdminNavButton>
          <AdminNavButton active={activeMenu === "versions"} onClick={() => setActiveMenu("versions")}>
            콘텐츠 · 버전
          </AdminNavButton>
        </AdminNavGroup>

        <AdminNavGroup label="주문 · 발행">
          <AdminNavButton active={activeMenu === "orders"} onClick={() => setActiveMenu("orders")}>
            주문 관리
          </AdminNavButton>
          <AdminNavButton active={activeMenu === "issuance"} onClick={() => setActiveMenu("issuance")}>
            발행 · 다운로드
          </AdminNavButton>
        </AdminNavGroup>

        <AdminNavGroup label="도구">
          <AdminNavButton active={activeMenu === "test"} onClick={() => setActiveMenu("test")}>
            테스트 센터
          </AdminNavButton>
          <AdminNavButton active={activeMenu === "settings"} onClick={() => setActiveMenu("settings")}>
            관리자 설정
          </AdminNavButton>
        </AdminNavGroup>

        <div className="store-admin-sidebar-foot">
          <Link href="/products/">스토어 열기 ↗</Link>
          <Link href="/library/">내 자료 열기 ↗</Link>
        </div>
      </aside>

      <main className="store-admin-main">
        <header className="store-admin-topbar">
          <div>
            <span className="eyebrow">PASSMATE ADMIN</span>
            <h1>{menuTitle(activeMenu)}</h1>
          </div>
          <button className="button button-ghost" type="button" onClick={refresh}>
            새로고침
          </button>
        </header>

        {error && <p className="auth-message auth-message--error">{error}</p>}
        {notice && <p className="auth-message auth-message--success">{notice}</p>}

        {activeMenu === "overview" && (
          <section className="store-admin-view">
            <div className="admin-overview">
              <DashboardMetric label="전체 상품" value={products.length} note="등록 데이터" />
              <DashboardMetric label="판매중" value={activeProducts} note="고객 노출" />
              <DashboardMetric label="전체 주문" value={summary?.orders_total ?? 0} note="누적" />
              <DashboardMetric label="결제 완료" value={summary?.orders_paid ?? 0} note="paid" />
              <DashboardMetric label="자료 완료" value={summary?.orders_ready ?? 0} note="다운로드 가능" />
              <DashboardMetric label="오늘 다운로드" value={summary?.downloads_today ?? 0} note="오늘" />
            </div>

            <div className="admin-home-grid">
              <section className="admin-panel">
                <div className="admin-panel-head">
                  <div>
                    <span className="eyebrow">QUICK</span>
                    <h2>빠른 작업</h2>
                  </div>
                </div>
                <div className="admin-home-actions">
                  <button type="button" onClick={() => setActiveMenu("products")}>
                    <b>상품 데이터 수정</b>
                    <span>가격 · 문구 · 구성 · 공개상태</span>
                  </button>
                  <Link href="/admin/products/preview/?code=PM-SS3-CORE">
                    <b>무대음향 상품 미리보기</b>
                    <span>비공개 테스트 상품 확인</span>
                  </Link>
                  <button type="button" onClick={() => setActiveMenu("versions")}>
                    <b>버전 확인</b>
                    <span>초안 · 게시 · 보관 상태</span>
                  </button>
                  <button type="button" onClick={() => setActiveMenu("test")}>
                    <b>판매 흐름 테스트</b>
                    <span>스토어 · Library · 미리보기</span>
                  </button>
                </div>
              </section>

              <section className="admin-panel">
                <div className="admin-panel-head">
                  <div>
                    <span className="eyebrow">ATTENTION</span>
                    <h2>확인할 것</h2>
                  </div>
                </div>
                <div className="admin-attention-list">
                  <StatusLine label="비공개 상품" value={products.length - activeProducts} />
                  <StatusLine label="결제 대기 주문" value={summary?.orders_payment_pending ?? 0} />
                  <StatusLine label="발행 대기" value={(summary?.jobs_queued ?? 0) + (summary?.jobs_retry_wait ?? 0)} />
                  <StatusLine label="수동 확인 필요" value={summary?.jobs_dead_letter ?? 0} alert />
                  <StatusLine label="무결성 확인 필요" value={summary?.artifacts_integrity_attention ?? 0} alert />
                </div>
              </section>
            </div>
          </section>
        )}

        {activeMenu === "products" && (
          <section className="store-admin-view">
            <div className="admin-toolbar-row">
              <div className="admin-filter-row">
                <input
                  className="admin-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="상품명, 코드, 주소 검색"
                />
                <select
                  className="admin-select"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                >
                  <option value="all">전체 상태</option>
                  <option value="active">판매중</option>
                  <option value="inactive">비공개</option>
                </select>
              </div>
              <button className="button button-primary" type="button" onClick={openCreate}>
                + 상품 추가
              </button>
            </div>

            <div className={`admin-product-manage-grid ${editorMode ? "admin-product-manage-grid--editing" : ""}`}>
              <section className="admin-panel admin-product-table-panel">
                <div className="admin-panel-head">
                  <div>
                    <span className="eyebrow">PRODUCT DATA</span>
                    <h2>상품 목록</h2>
                  </div>
                  <span>{filteredProducts.length}개</span>
                </div>

                <div className="admin-data-table-wrap">
                  <table className="admin-data-table">
                    <thead>
                      <tr>
                        <th>상품</th>
                        <th>가격</th>
                        <th>상태</th>
                        <th>최신 버전</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => {
                        const cat = catalog.find((row) => row.product_id === product.id);
                        return (
                          <tr key={product.id}>
                            <td>
                              <strong>{product.title}</strong>
                              <small>{product.code} · /{product.slug}</small>
                            </td>
                            <td>{product.price_krw.toLocaleString("ko-KR")}원</td>
                            <td>
                              <span className={product.is_active ? "admin-state admin-state--on" : "admin-state"}>
                                {product.is_active ? "판매중" : "비공개"}
                              </span>
                            </td>
                            <td>
                              <strong>{cat?.latest_version ?? "-"}</strong>
                              <small>{statusLabel(cat?.latest_version_status ?? null)}</small>
                            </td>
                            <td>
                              <div className="admin-row-actions">
                                <button type="button" onClick={() => openEdit(product)}>수정</button>
                                <Link href={`/admin/products/preview/?code=${encodeURIComponent(product.code)}`}>
                                  미리보기
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredProducts.length === 0 && (
                        <tr><td colSpan={5}>조건에 맞는 상품이 없습니다.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {editorMode && (
                <ProductEditor
                  mode={editorMode}
                  form={form}
                  setForm={setForm}
                  busy={busy}
                  onSave={saveProduct}
                  onClose={() => {
                    setEditorMode(null);
                    setEditingProductId(null);
                  }}
                />
              )}
            </div>
          </section>
        )}

        {activeMenu === "versions" && (
          <section className="store-admin-view">
            <section className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <span className="eyebrow">CONTENT DATA</span>
                  <h2>상품별 콘텐츠 · 버전</h2>
                  <p>현재는 버전 상태를 확인하는 화면입니다. 게시 전에는 초안으로 유지합니다.</p>
                </div>
              </div>

              <div className="admin-version-groups">
                {products.map((product) => {
                  const rows = versionsByProduct.get(product.id) ?? [];
                  return (
                    <article className="admin-version-group" key={product.id}>
                      <div className="admin-version-product">
                        <div>
                          <strong>{product.title}</strong>
                          <span>{product.code}</span>
                        </div>
                        <Link href={`/admin/products/preview/?code=${encodeURIComponent(product.code)}`}>
                          상품 미리보기
                        </Link>
                      </div>
                      <div className="admin-version-list">
                        {rows.map((version) => (
                          <div key={version.id}>
                            <div>
                              <b>{version.version}</b>
                              <span>{version.edition_year ?? "-"} EDITION</span>
                            </div>
                            <span className={version.status === "published" ? "admin-state admin-state--on" : "admin-state"}>
                              {statusLabel(version.status)}
                            </span>
                            <small>
                              {version.published_at
                                ? new Date(version.published_at).toLocaleString("ko-KR")
                                : "아직 게시 안 됨"}
                            </small>
                          </div>
                        ))}
                        {rows.length === 0 && <p className="admin-empty">버전이 없습니다.</p>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </section>
        )}

        {activeMenu === "orders" && (
          <section className="store-admin-view">
            <section className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <span className="eyebrow">ORDERS</span>
                  <h2>주문 데이터</h2>
                </div>
                <span>{orders.length}건</span>
              </div>
              <div className="admin-data-table-wrap">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>주문</th>
                      <th>상품</th>
                      <th>금액</th>
                      <th>결제</th>
                      <th>자료</th>
                      <th>일시</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.order_id}>
                        <td><code>{shortId(order.order_id)}</code></td>
                        <td>{order.product_summary}</td>
                        <td>{order.total_amount_krw.toLocaleString("ko-KR")}원</td>
                        <td>{statusLabel(order.status)}</td>
                        <td>{statusLabel(order.fulfillment_status)}</td>
                        <td>{new Date(order.created_at).toLocaleString("ko-KR")}</td>
                      </tr>
                    ))}
                    {orders.length === 0 && <tr><td colSpan={6}>아직 주문이 없습니다.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        )}

        {activeMenu === "issuance" && (
          <section className="store-admin-view">
            <div className="admin-overview admin-overview--four">
              <DashboardMetric label="발행 대기" value={summary?.jobs_queued ?? 0} note="queued" />
              <DashboardMetric label="처리 중" value={summary?.jobs_leased ?? 0} note="worker" />
              <DashboardMetric label="재시도 대기" value={summary?.jobs_retry_wait ?? 0} note="retry" />
              <DashboardMetric label="수동 확인" value={summary?.jobs_dead_letter ?? 0} note="dead letter" />
            </div>

            <section className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <span className="eyebrow">ISSUANCE JOBS</span>
                  <h2>PDF 발행 작업</h2>
                </div>
              </div>
              <div className="admin-data-table-wrap">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>상품</th>
                      <th>버전</th>
                      <th>상태</th>
                      <th>세대</th>
                      <th>시도</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => {
                      const canRetry = job.status === "dead_letter" || job.status === "retry_wait";
                      return (
                        <tr key={job.job_id}>
                          <td>{job.product_code}</td>
                          <td>{job.product_version}</td>
                          <td>{statusLabel(job.status)}</td>
                          <td>G{job.generation}</td>
                          <td>{job.attempt_count}/{job.max_attempts}</td>
                          <td>
                            {canRetry && (
                              <button
                                className="admin-mini-button"
                                type="button"
                                onClick={() => retryJob(job.job_id)}
                                disabled={busyJob === job.job_id}
                              >
                                {busyJob === job.job_id ? "처리 중" : "재시도"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {jobs.length === 0 && <tr><td colSpan={6}>발행 작업이 없습니다.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <span className="eyebrow">ARTIFACTS</span>
                  <h2>발행된 자료</h2>
                </div>
              </div>
              <div className="admin-data-table-wrap">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>상품</th>
                      <th>버전</th>
                      <th>상태</th>
                      <th>무결성</th>
                      <th>크기</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {artifacts.map((artifact) => (
                      <tr key={artifact.artifact_id}>
                        <td>{artifact.product_code}</td>
                        <td>{artifact.product_version}</td>
                        <td>{statusLabel(artifact.lifecycle_status)}</td>
                        <td>{statusLabel(artifact.integrity_status)}</td>
                        <td>{artifact.size_bytes.toLocaleString("ko-KR")} B</td>
                        <td>
                          <button
                            className="admin-mini-button"
                            type="button"
                            onClick={() => verifyArtifact(artifact.artifact_id)}
                            disabled={busyArtifact === artifact.artifact_id}
                          >
                            {busyArtifact === artifact.artifact_id ? "확인 중" : "무결성 확인"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {artifacts.length === 0 && <tr><td colSpan={6}>발행된 자료가 없습니다.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        )}

        {activeMenu === "test" && (
          <section className="store-admin-view">
            <section className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <span className="eyebrow">TEST CENTER</span>
                  <h2>화면 · 상품 테스트</h2>
                  <p>운영 전에 실제 고객 화면을 빠르게 확인합니다.</p>
                </div>
              </div>
              <div className="admin-test-grid">
                <Link href="/admin/products/preview/?code=PM-SS3-CORE">
                  <b>무대음향 3급 미리보기</b>
                  <span>비공개 상품도 관리자 권한으로 확인</span>
                </Link>
                <Link href="/products/">
                  <b>고객 상품 목록</b>
                  <span>실제로 공개된 상품만 보이는지 확인</span>
                </Link>
                <Link href="/library/">
                  <b>내 자료</b>
                  <span>구매권한과 다운로드 화면 확인</span>
                </Link>
                <Link href="/account/">
                  <b>내 계정</b>
                  <span>로그인/관리자 진입 확인</span>
                </Link>
              </div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <span className="eyebrow">CURRENT TEST PRODUCT</span>
                  <h2>PM-SS3-CORE</h2>
                </div>
              </div>
              <div className="admin-check-grid">
                <StatusCheck label="DB 상품 등록" ok={products.some((product) => product.code === "PM-SS3-CORE")} />
                <StatusCheck label="비공개 유지" ok={products.some((product) => product.code === "PM-SS3-CORE" && !product.is_active)} />
                <StatusCheck label="Draft 버전 존재" ok={versions.some((version) => {
                  const product = products.find((item) => item.id === version.product_id);
                  return product?.code === "PM-SS3-CORE" && version.status === "draft";
                })} />
                <StatusCheck label="상품 미리보기 경로" ok />
              </div>
            </section>
          </section>
        )}

        {activeMenu === "settings" && (
          <section className="store-admin-view">
            <section className="admin-panel admin-settings-panel">
              <div className="admin-panel-head">
                <div>
                  <span className="eyebrow">ADMIN SECURITY</span>
                  <h2>관리자 계정</h2>
                </div>
              </div>
              <dl className="admin-definition-list">
                <div><dt>관리자 이메일</dt><dd>jhpodong@naver.com</dd></div>
                <div><dt>로그인 방식</dt><dd>Kakao OAuth</dd></div>
                <div><dt>권한</dt><dd>단일 관리자 · DB 강제</dd></div>
                <div><dt>Supabase Project</dt><dd>fmecqeadghrdisirucqm</dd></div>
              </dl>
              <p className="admin-help">
                관리자 권한은 화면의 이메일 비교가 아니라 Supabase Auth 사용자, profile role,
                DB allowlist를 모두 통과해야 합니다.
              </p>
            </section>

            <section className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <span className="eyebrow">AUDIT LOG</span>
                  <h2>운영 변경 이력</h2>
                </div>
                <span>최근 {events.length}건</span>
              </div>
              <div className="admin-data-table-wrap">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>작업</th>
                      <th>대상</th>
                      <th>상세</th>
                      <th>관리자</th>
                      <th>일시</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={event.id}>
                        <td><strong>{actionLabel(event.action)}</strong><small>{event.action}</small></td>
                        <td>{event.target_type}{event.target_id ? ` · ${shortId(event.target_id)}` : ""}</td>
                        <td><code>{JSON.stringify(event.detail) ?? "-"}</code></td>
                        <td>{event.actor_user_id ? shortId(event.actor_user_id) : "-"}</td>
                        <td>{new Date(event.created_at).toLocaleString("ko-KR")}</td>
                      </tr>
                    ))}
                    {events.length === 0 && <tr><td colSpan={5}>아직 운영 변경 이력이 없습니다.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        )}
      </main>
    </div>
  );
}

function AdminNavGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="store-admin-nav-group">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function AdminNavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={active ? "store-admin-nav-button store-admin-nav-button--active" : "store-admin-nav-button"}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ProductEditor({
  mode,
  form,
  setForm,
  busy,
  onSave,
  onClose,
}: {
  mode: "create" | "edit";
  form: ProductForm;
  setForm: React.Dispatch<React.SetStateAction<ProductForm>>;
  busy: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const set = (key: keyof ProductForm, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <aside className="admin-product-editor">
      <div className="admin-editor-head">
        <div>
          <span className="eyebrow">{mode === "create" ? "NEW PRODUCT" : "EDIT PRODUCT"}</span>
          <h2>{mode === "create" ? "상품 추가" : form.title}</h2>
        </div>
        <button type="button" onClick={onClose}>닫기</button>
      </div>

      {mode === "create" && (
        <div className="admin-editor-grid admin-editor-grid--two">
          <label>
            <span>상품 코드</span>
            <input value={form.code} onChange={(event) => set("code", event.target.value)} placeholder="PM-EXAMPLE" />
          </label>
          <label>
            <span>주소(slug)</span>
            <input value={form.slug} onChange={(event) => set("slug", event.target.value)} placeholder="example-product" />
          </label>
        </div>
      )}

      <label>
        <span>상품명</span>
        <input value={form.title} onChange={(event) => set("title", event.target.value)} />
      </label>

      <label>
        <span>한 줄 설명</span>
        <input value={form.subtitle} onChange={(event) => set("subtitle", event.target.value)} />
      </label>

      <label>
        <span>상세 설명</span>
        <textarea rows={4} value={form.description} onChange={(event) => set("description", event.target.value)} />
      </label>

      <div className="admin-editor-grid admin-editor-grid--two">
        <label>
          <span>표시 연도</span>
          <input inputMode="numeric" value={form.displayYear} onChange={(event) => set("displayYear", event.target.value)} />
        </label>
        <label>
          <span>가격(원)</span>
          <input inputMode="numeric" value={form.priceKrw} onChange={(event) => set("priceKrw", event.target.value)} />
          <small>저장한 가격은 이후 생성되는 신규 주문의 서버 기준 결제금액으로 사용됩니다.</small>
        </label>
      </div>

      <label>
        <span>배지</span>
        <input value={form.badge} onChange={(event) => set("badge", event.target.value)} placeholder="2026 EDITION" />
      </label>

      <label>
        <span>구성품 · 특징</span>
        <textarea
          rows={6}
          value={form.featuresText}
          onChange={(event) => set("featuresText", event.target.value)}
          placeholder={"한 줄에 하나씩 입력\n핵심개념 요약노트\n공식·수치 한눈표\n시험 직전 체크리스트"}
        />
      </label>

      {mode === "create" ? (
        <label>
          <span>초기 버전</span>
          <input value={form.initialVersion} onChange={(event) => set("initialVersion", event.target.value)} />
          <small>새 상품은 항상 비공개 + draft로 생성됩니다.</small>
        </label>
      ) : (
        <label className="admin-toggle-row">
          <div>
            <span>판매 공개</span>
            <small>게시된 버전이 있어야 판매중으로 변경할 수 있습니다.</small>
          </div>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => set("isActive", event.target.checked)}
          />
        </label>
      )}

      <div className="admin-editor-actions">
        <button className="button button-ghost" type="button" onClick={onClose}>
          취소
        </button>
        <button className="button button-primary" type="button" onClick={onSave} disabled={busy}>
          {busy ? "저장 중..." : mode === "create" ? "비공개 상품 만들기" : "변경사항 저장"}
        </button>
      </div>
    </aside>
  );
}

function DashboardMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <article className="admin-overview-card">
      <span>{label}</span>
      <strong>{value.toLocaleString("ko-KR")}</strong>
      <small>{note}</small>
    </article>
  );
}

function StatusLine({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div className={alert && value > 0 ? "admin-attention-row admin-attention-row--alert" : "admin-attention-row"}>
      <span>{label}</span>
      <strong>{value.toLocaleString("ko-KR")}</strong>
    </div>
  );
}

function StatusCheck({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={ok ? "admin-check admin-check--ok" : "admin-check"}>
      <span>{ok ? "✓" : "!"}</span>
      <strong>{label}</strong>
    </div>
  );
}
