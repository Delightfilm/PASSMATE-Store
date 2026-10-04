export type LoadOptions = { signal?: AbortSignal };

export async function readContentJson<T>(response: Response, options: LoadOptions = {}): Promise<T> {
  options.signal?.throwIfAborted();
  if (!response.body) {
    const text = await response.text();
    options.signal?.throwIfAborted();
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
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
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
};
export function createContentRequest<T>(load: (options: LoadOptions) => Promise<T>): ContentRequest<T> {
  const controller = new AbortController();
  const request: ContentRequest<T> = { controller, subscribers: new Set(), settled: false, promise: undefined! };
  request.promise = load({ signal: controller.signal }).finally(() => { request.settled = true; });
  return request;
}
export function watchContentRequest<T>(request: ContentRequest<T>, options: LoadOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    const token = Symbol();
    request.subscribers.add(token);
    const release = () => {
      request.subscribers.delete(token);
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
