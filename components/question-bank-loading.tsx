"use client";

import { useEffect, useRef, useState } from "react";
import { startLoadingMessages } from "@/lib/question-bank-loading";
import styles from "./question-bank-loading.module.css";

export function QuestionBankLoading({ displayName, onCancel, onRetry }: { displayName: string; onCancel: () => void; onRetry: () => void }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [slow, setSlow] = useState(false);
  const latestName = useRef(displayName);
  useEffect(() => { latestName.current = displayName; }, [displayName]);
  useEffect(() => startLoadingMessages({
    getName: () => latestName.current,
    onShow: (first) => { setMessage(first); setAnnouncement(first); setVisible(true); },
    onMessage: setMessage,
    onSlow: (notice) => { setMessage(notice); setAnnouncement(notice); setSlow(true); },
  }), []);
  if (!visible) return null;
  return <div className={styles.card} data-question-bank-loading>
    <div role="status" aria-live="polite" aria-busy="true" aria-atomic="false">
      <span className={styles.spinner} aria-hidden="true" />
      <div className={styles.messageArea} aria-hidden="true">
        <p key={message} className={styles.message}>{message}</p>
      </div>
      <p className={styles.helper} aria-hidden="true">처음 한 번만 오래 걸릴 수 있어요.</p>
      <span className={styles.live}>{announcement}</span>
    </div>
    {slow ? <div className={styles.actions}>
      <button type="button" onClick={onCancel}>취소</button>
      <button type="button" onClick={onRetry}>다시 시도</button>
    </div> : null}
  </div>;
}
