"use client";

import { useEffect, useRef, useState } from "react";
import type { LoadProgress } from "@/lib/question-bank-download";
import styles from "./question-bank-loading.module.css";

const labels = { catalog: "종목 목록 확인 중", bundle: "문제 데이터 받는 중", corrections: "최신 정정 확인 중" };
function capacity(bytes: number) { return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)}MB` : `${(bytes / 1000).toFixed(1)}KB`; }
function description(progress: LoadProgress | null, now: number) {
  const label = labels[progress?.stage || "catalog"];
  if (!progress || progress.status === "connecting") return `${label} · 서버에 연결 중…`;
  if (progress.stage === "corrections") return label;
  const received = capacity(progress.loadedBytes);
  const bytes = progress.totalBytes ? `${received} / ${capacity(progress.totalBytes)}` : received;
  const eta = progress.etaSeconds !== undefined && now - progress.updatedAt < 5000 ? ` · 약 ${progress.etaSeconds}초 남음` : "";
  const finishing = progress.status === "processing" ? " · 받은 데이터 정리 중…" : "";
  return `${label} · ${bytes}${eta}${finishing}`;
}

export function QuestionBankLoading({ progress, onCancel, onRetry }: { progress: LoadProgress | null; onCancel: () => void; onRetry: () => void }) {
  const [visible, setVisible] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const started = useRef(Date.now());
  const latest = useRef(progress);
  const lastAnnounced = useRef(0);
  useEffect(() => { latest.current = progress; }, [progress]);
  useEffect(() => {
    const show = window.setTimeout(() => {
      setVisible(true);
      const time = Date.now();
      setAnnouncement(description(latest.current, time));
      lastAnnounced.current = time;
    }, 300);
    const tick = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (lastAnnounced.current && time - lastAnnounced.current >= 5000) {
        const slow = time - started.current >= 15_000 ? " 서버가 느려요. 계속 진행 중입니다." : "";
        setAnnouncement(description(latest.current, time) + slow);
        lastAnnounced.current = time;
      }
    }, 500);
    return () => { window.clearTimeout(show); window.clearInterval(tick); };
  }, []);
  if (!visible) return null;
  const slow = now - started.current >= 15_000;
  const percent = progress?.percent;
  const label = labels[progress?.stage || "catalog"];
  return <div className={styles.card}>
    <strong className={styles.title}>{label}</strong>
    {progress?.stage === "bundle" ? <p className={styles.resource}>{progress.resource}</p> : null}
    <div className={styles.track} role="progressbar" aria-label={`${label} · 현재 파일`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent === undefined ? undefined : Math.floor(percent)} aria-valuetext={description(progress, now)}>
      {percent === undefined ? null : <span className={styles.fill} style={{ width: `${percent}%` }} />}
    </div>
    <p className={styles.detail}>{description(progress, now)}{percent === undefined ? "" : ` · ${Math.floor(percent)}%`}</p>
    <span className={styles.live} aria-live="polite" aria-atomic="true">{announcement}</span>
    {slow ? <div className={styles.slow}>
      <p>서버가 느려요. 계속 진행 중입니다.</p>
      <div className={styles.actions}>
        <button type="button" onClick={onCancel}>취소</button>
        <button type="button" onClick={onRetry}>다시 시도</button>
      </div>
    </div> : null}
  </div>;
}
