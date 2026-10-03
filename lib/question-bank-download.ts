export type LoadStage = "catalog" | "bundle" | "corrections";
export type LoadProgress = {
  stage: LoadStage;
  resource: string;
  loadedBytes: number;
  totalBytes?: number;
  percent?: number;
  etaSeconds?: number;
  status: "connecting" | "receiving" | "processing";
  updatedAt: number;
};
export type LoadOptions = { signal?: AbortSignal; onProgress?: (progress: LoadProgress) => void };

export function transferSize(response: Response, originalBytes?: number): number | undefined {
  if (Number.isSafeInteger(originalBytes) && originalBytes! > 0) return originalBytes;
  const encoding = response.headers.get("content-encoding")?.trim().toLowerCase();
  // Fetch streams contain decoded bytes. A CORS-hidden encoding is not proof of
  // an uncompressed response, even when Content-Length is readable.
  if ((encoding && encoding !== "identity") || (response.type === "cors" && encoding !== "identity")) return;
  const length = response.headers.get("content-length");
  if (!length || !/^\d+$/.test(length)) return;
  const bytes = Number(length);
  return Number.isSafeInteger(bytes) && bytes > 0 ? bytes : undefined;
}

export function createTransferMeter(totalBytes?: number, clock = () => performance.now()) {
  const samples: { at: number; bytes: number }[] = [];
  let firstByteAt: number | undefined;
  let loaded = 0;
  let percent = 0;
  let smoothedRate: number | undefined;
  return (bytes: number, complete = false) => {
    const now = clock();
    loaded = Math.max(loaded, bytes);
    if (loaded > 0 && firstByteAt === undefined) {
      firstByteAt = now;
      samples.push({ at: now, bytes: loaded });
    }
    if (firstByteAt !== undefined) samples.push({ at: now, bytes: loaded });
    const cutoff = now - 5000;
    while (samples.length > 2 && samples[1].at <= cutoff) samples.shift();
    if (totalBytes) percent = Math.max(percent, Math.min(100, loaded / totalBytes * 100));
    let etaSeconds: number | undefined;
    if (!complete && totalBytes && percent >= 5 && firstByteAt !== undefined && now - firstByteAt >= 1000) {
      const first = samples[0];
      const next = samples[1];
      const start = Math.max(first.at, cutoff);
      const startBytes = next && first.at < start && next.at > first.at
        ? first.bytes + (next.bytes - first.bytes) * (start - first.at) / (next.at - first.at)
        : first.bytes;
      const rate = (loaded - startBytes) / ((now - start) / 1000);
      if (Number.isFinite(rate) && rate > 0) {
        smoothedRate = smoothedRate === undefined ? rate : smoothedRate * .75 + rate * .25;
        if (loaded < totalBytes) etaSeconds = Math.ceil((totalBytes - loaded) / smoothedRate);
      }
    }
    return { loadedBytes: loaded, totalBytes, percent: totalBytes ? percent : undefined, etaSeconds };
  };
}

export async function readContentJson<T>(response: Response, stage: LoadStage, resource: string, options: LoadOptions, originalBytes?: number): Promise<T> {
  const meter = createTransferMeter(transferSize(response, originalBytes));
  let loaded = 0;
  let lastUpdate = -Infinity;
  const publish = (complete = false) => {
    const now = performance.now();
    if (!complete && loaded > 0 && now - lastUpdate < 250) return;
    lastUpdate = now;
    options.onProgress?.({ stage, resource, ...meter(loaded, complete), status: complete ? "processing" : "receiving", updatedAt: Date.now() });
  };
  options.signal?.throwIfAborted();
  publish();
  if (!response.body) {
    const text = await response.text();
    options.signal?.throwIfAborted();
    loaded = new TextEncoder().encode(text).byteLength;
    publish(true);
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
      chunks.push(decoder.decode(value, { stream: true }));
      publish();
    }
    chunks.push(decoder.decode());
    publish(true);
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
  listeners: Set<NonNullable<LoadOptions["onProgress"]>>;
  progress?: LoadProgress;
  settled: boolean;
};
export function createContentRequest<T>(load: (options: LoadOptions) => Promise<T>): ContentRequest<T> {
  const controller = new AbortController();
  const request: ContentRequest<T> = { controller, subscribers: new Set(), listeners: new Set(), settled: false, promise: undefined! };
  request.promise = load({ signal: controller.signal, onProgress: (progress) => {
    request.progress = progress;
    request.listeners.forEach((listener) => listener(progress));
  } }).finally(() => { request.settled = true; });
  return request;
}
export function watchContentRequest<T>(request: ContentRequest<T>, options: LoadOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    const token = Symbol();
    request.subscribers.add(token);
    if (!request.settled && options.onProgress) {
      request.listeners.add(options.onProgress);
      if (request.progress) options.onProgress(request.progress);
    }
    const release = () => {
      request.subscribers.delete(token);
      if (options.onProgress) request.listeners.delete(options.onProgress);
      options.signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      release();
      if (!request.settled && !request.subscribers.size) request.controller.abort();
      reject(options.signal?.reason || new DOMException("Aborted", "AbortError"));
    };
    request.promise.then((value) => { release(); resolve(value); }, (error) => { release(); reject(error); });
    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener("abort", abort, { once: true });
  });
}
