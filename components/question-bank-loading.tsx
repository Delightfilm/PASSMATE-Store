"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { LOADING_MESSAGE_FADE_MS, startLoadingMessages } from "@/lib/question-bank-loading";
import styles from "./question-bank-loading.module.css";
import { loadingProgressPresentation, type LoadProgress } from "@/lib/question-bank-download";

export function QuestionBankLoading({ displayName, onCancel, onRetry, progress }: { displayName: string; onCancel: () => void; onRetry: () => void; progress?: LoadProgress }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [slow, setSlow] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const latestName = useRef(displayName);
  useEffect(() => { latestName.current = displayName; }, [displayName]);
  useEffect(() => startLoadingMessages({
    getName: () => latestName.current,
    onShow: (first) => { setMessage(first); setAnnouncement(first); setVisible(true); },
    onFadeOut: () => { if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setFadingOut(true); },
    onMessage: (next) => { setMessage(next); setFadingOut(false); },
    onSlow: (notice) => { setMessage(notice); setFadingOut(false); setAnnouncement(notice); setSlow(true); },
  }), []);
  if (!visible) return null;
  const { label, percent } = loadingProgressPresentation(progress);
  return <div className={styles.card} style={{ "--message-fade-duration": `${LOADING_MESSAGE_FADE_MS}ms` } as CSSProperties} data-question-bank-loading>
    <div role="status" aria-live="polite" aria-busy="true" aria-atomic="false">
      <span className={styles.spinner} aria-hidden="true" />
      <div className={styles.messageArea} aria-hidden="true">
        <p className={`${styles.message}${fadingOut ? ` ${styles.messageFading}` : ""}`}>{message}</p>
      </div>
      <span className={styles.live}>{announcement}</span>
    </div>
    <div className={styles.progressArea} data-loading-stage={progress?.stage}>
      <p>{label}{percent !== null ? ` · ${percent}%` : ""}</p>
      <div className={styles.progressTrack} role={percent !== null ? "progressbar" : undefined} aria-label={percent !== null ? "문제 자료 다운로드" : undefined} aria-valuemin={percent !== null ? 0 : undefined} aria-valuemax={percent !== null ? 100 : undefined} aria-valuenow={percent ?? undefined}>{percent !== null && <span style={{ width: `${percent}%` }} />}</div>
    </div>
    {slow ? <div className={styles.actions}>
      <button type="button" onClick={onCancel}>취소</button>
      <button type="button" onClick={onRetry}>다시 시도</button>
    </div> : null}
  </div>;
}
