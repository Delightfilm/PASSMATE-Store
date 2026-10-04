"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { LOADING_MESSAGE_FADE_MS, startLoadingMessages } from "@/lib/question-bank-loading";
import styles from "./question-bank-loading.module.css";

export function QuestionBankLoading({ displayName, onCancel, onRetry }: { displayName: string; onCancel: () => void; onRetry: () => void }) {
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
  return <div className={styles.card} style={{ "--message-fade-duration": `${LOADING_MESSAGE_FADE_MS}ms` } as CSSProperties} data-question-bank-loading>
    <div role="status" aria-live="polite" aria-busy="true" aria-atomic="false">
      <span className={styles.spinner} aria-hidden="true" />
      <div className={styles.messageArea} aria-hidden="true">
        <p className={`${styles.message}${fadingOut ? ` ${styles.messageFading}` : ""}`}>{message}</p>
      </div>
      <span className={styles.live}>{announcement}</span>
    </div>
    {slow ? <div className={styles.actions}>
      <button type="button" onClick={onCancel}>취소</button>
      <button type="button" onClick={onRetry}>다시 시도</button>
    </div> : null}
  </div>;
}
