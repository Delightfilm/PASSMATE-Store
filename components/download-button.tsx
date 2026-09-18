"use client";

import { useState } from "react";
import { getPublicSupabaseConfig } from "@/lib/public-supabase-config";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export function DownloadButton({
  entitlementId,
  ready,
}: {
  entitlementId: string;
  ready: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function download() {
    if (!ready || busy) return;

    setBusy(true);
    setMessage("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setMessage("로그인이 필요합니다.");
        return;
      }

      const { url, key } = getPublicSupabaseConfig();
      const response = await fetch(url + "/functions/v1/download-url", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          apikey: key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ entitlementId }),
      });

      if (response.status === 409) {
        setMessage("자료를 준비하고 있습니다.");
        return;
      }

      if (!response.ok) {
        throw new Error("download-url:" + response.status);
      }

      const payload = (await response.json()) as { url?: string };
      if (!payload.url) throw new Error("download-url-missing");

      window.location.assign(payload.url);
    } catch (error) {
      console.error("[PASSMATE] download request failed", error);
      setMessage("다운로드를 준비하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="library-download">
      <button
        type="button"
        className="library-download-button"
        onClick={download}
        disabled={!ready || busy}
      >
        {busy ? "준비 중..." : ready ? "PDF 다운로드" : "자료 준비 중"}
      </button>
      {message && <span className="library-download-note">{message}</span>}
    </div>
  );
}
