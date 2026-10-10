export type LoadProgress = { stage: "account" | "catalog" | "bundle" | "download" | "parse" | "corrections"; loaded?: number; total?: number };
export type LoadOptions = { signal?: AbortSignal; onProgress?: (progress: LoadProgress) => void; totalBytes?: number };
export function loadingProgressPresentation(progress?: LoadProgress) {
  const labels: Record<LoadProgress["stage"], string> = { account: "개인 학습 기록 연결", catalog: "자격증 목록 확인", bundle: "문제 자료 요청", download: "문제 자료 받기", parse: "문제 자료 정리", corrections: "최신 문항 확인" };
  const total = progress?.total, loaded = progress?.loaded;
  const known = progress?.stage === "download" && Number.isSafeInteger(total) && total! > 0 && Number.isSafeInteger(loaded) && loaded! >= 0 && loaded! <= total!;
  return { label: progress ? labels[progress.stage] : "", percent: known ? Math.floor(loaded! / total! * 100) : null };
}
export function notifyLoadProgress(callback: LoadOptions["onProgress"], progress: LoadProgress) {
  try { callback?.(progress); } catch { /* Optional presentation must not affect downloads. */ }
}

export async function readContentJson<T>(response: Response, options: LoadOptions = {}): Promise<T> {
  options.signal?.throwIfAborted();
  const length = Number(response.headers.get("content-length"));
  const encoding = response.headers.get("content-encoding");
  // CORS may hide Content-Encoding while exposing compressed Content-Length.
  // Only an authoritative decoded size, or a provably plain body, is a total.
  const plain = !/\.gz(?:[?#]|$)/i.test(response.url) && (encoding === "identity" || (!encoding && response.type !== "cors"));
  const candidate = options.totalBytes ?? (plain ? length : undefined);
  const total = candidate && Number.isSafeInteger(candidate) && candidate > 0 ? candidate : undefined;
  let loaded = 0, reported = Date.now();
  notifyLoadProgress(options.onProgress, { stage: "download", loaded, total });
  if (!response.body) {
    const text = await response.text();
    options.signal?.throwIfAborted();
    notifyLoadProgress(options.onProgress, { stage: "parse" });
    return JSON.parse(text) as T;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  const abort = () => { void reader.cancel(options.signal?.reason).catch(() => {}); };
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      options.signal?.throwIfAborted();
      const { done, value } = await reader.read();
      options.signal?.throwIfAborted();
      if (done) break;
      loaded += value.byteLength;
      if (Date.now() - reported >= 100) { reported = Date.now(); notifyLoadProgress(options.onProgress, { stage: "download", loaded, total: total && loaded <= total ? total : undefined }); }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    notifyLoadProgress(options.onProgress, { stage: "parse", loaded });
    return JSON.parse(chunks.join("")) as T;
  } finally {
    options.signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

// Keep the existing promise cache and coalesce requests. Each caller owns a
// subscription; cancelling one page cannot cancel a download another page uses.
export type ContentRequest<T> = {
  promise: Promise<T>;
  controller: AbortController;
  subscribers: Set<symbol>;
  settled: boolean;
  progress?: LoadProgress;
  progressListeners: Set<(progress: LoadProgress) => void>;
};
export function createContentRequest<T>(load: (options: LoadOptions) => Promise<T>): ContentRequest<T> {
  const controller = new AbortController();
  const request: ContentRequest<T> = { controller, subscribers: new Set(), progressListeners: new Set(), settled: false, promise: undefined! };
  request.promise = load({ signal: controller.signal, onProgress: progress => {
    if (controller.signal.aborted) return;
    request.progress = progress;
    request.progressListeners.forEach(listener => notifyLoadProgress(listener, progress));
  } }).finally(() => { request.settled = true; });
  return request;
}
export function watchContentRequest<T>(request: ContentRequest<T>, options: LoadOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    const token = Symbol();
    const progress = (value: LoadProgress) => notifyLoadProgress(options.onProgress, value);
    request.subscribers.add(token);
    const release = () => {
      request.subscribers.delete(token);
      request.progressListeners.delete(progress);
      options.signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      release();
      if (!request.settled && !request.subscribers.size) request.controller.abort();
      reject(options.signal?.reason || new DOMException("Aborted", "AbortError"));
    };
    request.promise.then((value) => { release(); resolve(value); }, (error) => { release(); reject(error); });
    if (options.signal?.aborted) abort();
    else {
      options.signal?.addEventListener("abort", abort, { once: true });
      if (options.onProgress && !request.settled) { request.progressListeners.add(progress); if (request.progress) progress(request.progress); }
    }
  });
}
