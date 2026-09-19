"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getPublicSupabaseConfig } from "@/lib/public-supabase-config";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

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

  if (!response.ok) {
    throw new Error(path + ":" + response.status);
  }

  return (await response.json()) as T;
}

function shortId(value: string): string {
  return value.slice(0, 8);
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

export function AdminClient() {
  const router = useRouter();
  const [access, setAccess] = useState<"loading" | "admin" | "denied">("loading");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [error, setError] = useState("");
  const [busyJob, setBusyJob] = useState<string | null>(null);
  const [busyArtifact, setBusyArtifact] = useState<string | null>(null);

  const activeProducts = useMemo(
    () => catalog.filter((product) => product.is_active).length,
    [catalog]
  );

  async function token(): Promise<string | null> {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function loadAll(accessToken: string) {
    const [
      summaryResult,
      orderResult,
      jobResult,
      artifactResult,
      catalogResult,
    ] = await Promise.all([
      callAdmin<{ data: Summary }>("admin-data", accessToken, {
        view: "summary",
      }),
      callAdmin<{ data: OrderRow[] }>("admin-data", accessToken, {
        view: "orders",
        limit: 50,
      }),
      callAdmin<{ data: JobRow[] }>("admin-data", accessToken, {
        view: "jobs",
        limit: 100,
      }),
      callAdmin<{ data: ArtifactRow[] }>("admin-data", accessToken, {
        view: "artifacts",
        limit: 100,
      }),
      callAdmin<{ data: CatalogRow[] }>("admin-data", accessToken, {
        view: "catalog",
      }),
    ]);

    setSummary(summaryResult.data);
    setOrders(orderResult.data ?? []);
    setJobs(jobResult.data ?? []);
    setArtifacts(artifactResult.data ?? []);
    setCatalog(catalogResult.data ?? []);
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
    try {
      await loadAll(accessToken);
    } catch (refreshError) {
      console.error("[PASSMATE] admin refresh failed", refreshError);
      setError("새로고침에 실패했습니다.");
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
    <div className="admin-console admin-dashboard">
      <div className="admin-dashboard-head">
        <div>
          <span className="eyebrow">PASSMATE ADMIN</span>
          <h2>운영 대시보드</h2>
          <p>상품, 주문, 자료 발행 상태를 여기서 한 번에 확인합니다.</p>
        </div>
        <button className="button button-ghost" type="button" onClick={refresh}>
          새로고침
        </button>
      </div>

      {error && (
        <p className="auth-message auth-message--error">{error}</p>
      )}

      <section className="admin-quick-actions">
        <h3>빠른 작업</h3>
        <div className="admin-quick-grid">
          <Link className="admin-quick-card admin-quick-card--primary" href="/admin/products/PM-SS3-CORE/preview/">
            <b>무대음향 테스트 상품</b>
            <span>지금 만든 5,900원 핵심요약 패키지 미리보기</span>
          </Link>
          <a className="admin-quick-card" href="#catalog">
            <b>상품 관리</b>
            <span>가격 · 공개상태 · 버전 확인</span>
          </a>
          <a className="admin-quick-card" href="#orders">
            <b>주문 확인</b>
            <span>결제와 자료 준비 상태 확인</span>
          </a>
          <a className="admin-quick-card" href="#jobs">
            <b>발행 상태</b>
            <span>PDF 작업 대기 · 실패 · 재시도 확인</span>
          </a>
          <Link className="admin-quick-card" href="/library/">
            <b>내 자료 테스트</b>
            <span>고객에게 보이는 Library 화면 확인</span>
          </Link>
          <Link className="admin-quick-card" href="/products/">
            <b>스토어 보기</b>
            <span>현재 고객에게 공개된 상품 확인</span>
          </Link>
        </div>
      </section>

      <section className="admin-overview">
        <DashboardMetric label="전체 상품" value={catalog.length} note="등록된 상품" />
        <DashboardMetric label="판매중" value={activeProducts} note="고객에게 공개" />
        <DashboardMetric label="전체 주문" value={summary?.orders_total ?? 0} note="누적" />
        <DashboardMetric label="결제 완료" value={summary?.orders_paid ?? 0} note="paid" />
        <DashboardMetric label="자료 완료" value={summary?.orders_ready ?? 0} note="다운로드 가능" />
        <DashboardMetric label="오늘 다운로드" value={summary?.downloads_today ?? 0} note="오늘 발급" />
      </section>

      <section className="admin-dashboard-section" id="catalog">
        <div className="admin-section-title">
          <div>
            <span className="eyebrow">PRODUCTS</span>
            <h3>상품</h3>
          </div>
          <span>{catalog.length}개 등록</span>
        </div>

        <div className="admin-product-grid">
          {catalog.map((product) => (
            <article className="admin-product-card" key={product.product_id}>
              <div className="admin-product-card-top">
                <span>{product.code}</span>
                <span className={product.is_active ? "admin-state admin-state--on" : "admin-state"}>
                  {product.is_active ? "판매중" : "비공개"}
                </span>
              </div>
              <h4>{product.title}</h4>
              <strong>{product.price_krw.toLocaleString("ko-KR")}원</strong>
              <p>
                최신 버전 {product.latest_version ?? "-"} ·{" "}
                {statusLabel(product.latest_version_status)}
              </p>
              <div className="admin-card-actions">
                <Link
                  className="button button-primary"
                  href={`/admin/products/${encodeURIComponent(product.code)}/preview/`}
                >
                  미리보기
                </Link>
              </div>
            </article>
          ))}
          {catalog.length === 0 && <p className="admin-empty">등록된 상품이 없습니다.</p>}
        </div>
      </section>

      <section className="admin-dashboard-section" id="orders">
        <div className="admin-section-title">
          <div>
            <span className="eyebrow">ORDERS</span>
            <h3>최근 주문</h3>
          </div>
          <span>최근 {Math.min(orders.length, 10)}건</span>
        </div>

        <div className="admin-simple-list">
          {orders.slice(0, 10).map((order) => (
            <div className="admin-simple-row" key={order.order_id}>
              <div>
                <strong>{order.product_summary}</strong>
                <span>{new Date(order.created_at).toLocaleString("ko-KR")}</span>
              </div>
              <div className="admin-simple-row-right">
                <b>{order.total_amount_krw.toLocaleString("ko-KR")}원</b>
                <span>{statusLabel(order.status)} · {statusLabel(order.fulfillment_status)}</span>
              </div>
            </div>
          ))}
          {orders.length === 0 && <p className="admin-empty">아직 주문이 없습니다.</p>}
        </div>
      </section>

      <section className="admin-dashboard-section" id="jobs">
        <div className="admin-section-title">
          <div>
            <span className="eyebrow">ISSUANCE</span>
            <h3>자료 발행</h3>
          </div>
          <span>
            대기 {(summary?.jobs_queued ?? 0) + (summary?.jobs_retry_wait ?? 0)} ·
            확인필요 {summary?.jobs_dead_letter ?? 0}
          </span>
        </div>

        <div className="admin-simple-list">
          {jobs.slice(0, 12).map((job) => {
            const canRetry = job.status === "dead_letter" || job.status === "retry_wait";
            return (
              <div className="admin-simple-row" key={job.job_id}>
                <div>
                  <strong>{job.product_code} · {job.product_version}</strong>
                  <span>작업 {shortId(job.job_id)} · G{job.generation}</span>
                </div>
                <div className="admin-simple-row-right">
                  <b>{statusLabel(job.status)}</b>
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
                </div>
              </div>
            );
          })}
          {jobs.length === 0 && <p className="admin-empty">진행 중인 발행 작업이 없습니다.</p>}
        </div>
      </section>

      <details className="admin-detail-panel">
        <summary>고급 운영 정보 보기</summary>
        <div className="admin-detail-content">
          <div className="admin-detail-summary">
            <span>발행본 {summary?.artifacts_active ?? 0}</span>
            <span>무결성 확인 필요 {summary?.artifacts_integrity_attention ?? 0}</span>
            <span>결제 실패 {summary?.payment_failures ?? 0}</span>
            <span>자료 실패 {summary?.orders_fulfillment_failed ?? 0}</span>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>발행본</th>
                  <th>상품</th>
                  <th>상태</th>
                  <th>무결성</th>
                  <th>크기</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {artifacts.map((artifact) => (
                  <tr key={artifact.artifact_id}>
                    <td><code>{shortId(artifact.artifact_id)}</code></td>
                    <td>{artifact.product_code} · {artifact.product_version}</td>
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
                {artifacts.length === 0 && (
                  <tr><td colSpan={6}>등록된 발행본이 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </div>
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
