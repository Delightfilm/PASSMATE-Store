"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

function shortInternalRef(value: string): string {
  return value.replace("IA-", "").slice(0, 10).toUpperCase();
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
    queued: "대기열",
    issuing: "처리 중",
    ready: "완료",
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

  return (
    <div className="admin-console">
      <div className="admin-toolbar">
        <span>운영 데이터</span>
        <button type="button" onClick={refresh}>새로고침</button>
      </div>

      {error && (
        <p className="auth-message auth-message--error">{error}</p>
      )}

      <div className="admin-metrics">
        <Metric label="전체 주문" value={summary?.orders_total ?? 0} />
        <Metric label="결제 완료" value={summary?.orders_paid ?? 0} />
        <Metric label="자료 완료" value={summary?.orders_ready ?? 0} />
        <Metric label="현재 발행본" value={summary?.artifacts_active ?? 0} />
        <Metric
          label="발행 확인 필요"
          value={summary?.artifacts_integrity_attention ?? 0}
          alert
        />
        <Metric
          label="수동 확인"
          value={summary?.jobs_dead_letter ?? 0}
          alert
        />
      </div>

      <AdminSection title="최근 주문">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>주문</th>
                <th>상품</th>
                <th>결제</th>
                <th>자료</th>
                <th>금액</th>
                <th>일시</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.order_id}>
                  <td><code>{shortId(order.order_id)}</code></td>
                  <td>{order.product_summary}</td>
                  <td>{statusLabel(order.status)}</td>
                  <td>{statusLabel(order.fulfillment_status)}</td>
                  <td>{order.total_amount_krw.toLocaleString("ko-KR")}원</td>
                  <td>{new Date(order.created_at).toLocaleString("ko-KR")}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={6}>주문이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminSection>

      <AdminSection title="발행 작업">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>작업</th>
                <th>상품</th>
                <th>상태</th>
                <th>세대</th>
                <th>시도</th>
                <th>오류</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const canRetry =
                  job.status === "dead_letter" ||
                  job.status === "retry_wait";
                return (
                  <tr key={job.job_id}>
                    <td><code>{shortId(job.job_id)}</code></td>
                    <td>{job.product_code} · {job.product_version}</td>
                    <td>{statusLabel(job.status)}</td>
                    <td>G{job.generation}</td>
                    <td>{job.attempt_count}/{job.max_attempts}</td>
                    <td>{job.last_error_code ?? "-"}</td>
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
              {jobs.length === 0 && (
                <tr><td colSpan={7}>발행 작업이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminSection>

      <AdminSection title="발행 기록">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>내부 참조</th>
                <th>상품</th>
                <th>세대</th>
                <th>수명주기</th>
                <th>무결성</th>
                <th>SHA-256</th>
                <th>크기</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {artifacts.map((artifact) => (
                <tr key={artifact.artifact_id}>
                  <td><code>{shortInternalRef(artifact.internal_ref)}</code></td>
                  <td>{artifact.product_code} · {artifact.product_version}</td>
                  <td>G{artifact.generation}</td>
                  <td>{statusLabel(artifact.lifecycle_status)}</td>
                  <td className={
                    artifact.integrity_status === "mismatch" ||
                    artifact.integrity_status === "unavailable"
                      ? "admin-integrity-attention"
                      : ""
                  }>
                    {statusLabel(artifact.integrity_status)}
                  </td>
                  <td><code>{artifact.sha256.slice(0, 12)}</code></td>
                  <td>{artifact.size_bytes.toLocaleString("ko-KR")} B</td>
                  <td>
                    <button
                      className="admin-mini-button"
                      type="button"
                      onClick={() => verifyArtifact(artifact.artifact_id)}
                      disabled={busyArtifact === artifact.artifact_id}
                    >
                      {busyArtifact === artifact.artifact_id
                        ? "확인 중"
                        : "무결성 확인"}
                    </button>
                  </td>
                </tr>
              ))}
              {artifacts.length === 0 && (
                <tr><td colSpan={8}>등록된 발행본이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminSection>

      <AdminSection title="상품 / 버전">
        <div className="admin-catalog-grid">
          {catalog.map((product) => (
            <article className="admin-catalog-card" key={product.product_id}>
              <span>{product.code}</span>
              <strong>{product.title}</strong>
              <p>
                {product.price_krw.toLocaleString("ko-KR")}원 ·{" "}
                {product.is_active ? "판매 표시" : "비활성"}
              </p>
              <small>
                최신 {product.latest_version ?? "-"} ·{" "}
                {product.latest_version_status ?? "-"} · 총{" "}
                {product.version_count}개 버전
              </small>
              <Link
                className="admin-preview-link"
                href={`/admin/products/${encodeURIComponent(product.code)}/preview/`}
              >
                상품 미리보기 →
              </Link>
            </article>
          ))}
        </div>
      </AdminSection>
    </div>
  );
}

function Metric({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div className={"admin-metric" + (alert && value > 0 ? " admin-metric--alert" : "")}>
      <span>{label}</span>
      <strong>{value.toLocaleString("ko-KR")}</strong>
    </div>
  );
}

function AdminSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="admin-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
