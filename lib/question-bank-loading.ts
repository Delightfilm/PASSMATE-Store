// Loading presentation only: it neither reads nor modifies the dataset.
export const LOADING_MESSAGE_INTERVAL_MS = 5_000;
export const LOADING_MESSAGE_FADE_MS = 350;
export const LOADING_SHOW_DELAY_MS = 300;
export const LOADING_SLOW_DELAY_MS = 15_000;
export const SLOW_LOADING_MESSAGE = "평소보다 오래 걸리고 있어요. 계속 준비 중이니 조금만 더 기다려 주세요.";

export function loadingDisplayName(profileName?: unknown, metadata?: Record<string, unknown> | null): string {
  const candidates = [profileName, metadata?.display_name, metadata?.nickname, metadata?.name, metadata?.full_name];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const name = candidate.replace(/[\u0000-\u001f\u007f]/g, "").trim();
    // Never derive a nickname from an email/phone field or display those values.
    if (!name || name.includes("@") || /^\+?[\d\s().-]{7,}$/.test(name)) continue;
    const characters = Array.from(new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(name), (part) => part.segment);
    return characters.length > 10 ? characters.slice(0, 10).join("") + "…" : name;
  }
  return "수험자";
}

export function loadingMessages(name: string) {
  return [
    name + "님의 시험지를 준비하고 있어요",
    "수험자들을 위한 시험지를 만드는 중이에요",
    "기출문제를 차곡차곡 정리하고 있어요",
    "문제와 보기를 꼼꼼히 맞춰보고 있어요",
    "정답과 해설을 확인하고 있어요",
    "최신 정정 내용을 반영하고 있어요",
    "곧 시작할 수 있어요. 조금만 기다려 주세요",
  ];
}

type LoadingTimers = {
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (handle: number) => void;
};

export function startLoadingMessages(callbacks: {
  getName: () => string;
  onShow: (message: string) => void;
  onMessage: (message: string) => void;
  onFadeOut?: () => void;
  onSlow: (message: string) => void;
}, timers: LoadingTimers = window) {
  let rotation: number | undefined;
  let fade: number | undefined;
  const clearRotation = () => {
    if (rotation !== undefined) timers.clearTimeout(rotation);
    if (fade !== undefined) timers.clearTimeout(fade);
  };
  const show = timers.setTimeout(() => {
    // Freeze the name at first appearance; late profile/auth responses stay out.
    const messages = loadingMessages(callbacks.getName());
    let index = 0;
    callbacks.onShow(messages[0]);
    let elapsed = LOADING_SHOW_DELAY_MS;
    const scheduleNext = () => {
      const nextElapsed = elapsed + LOADING_MESSAGE_INTERVAL_MS;
      // The fixed notice takes over before the next message; do not fade it out.
      if (nextElapsed >= LOADING_SLOW_DELAY_MS) return;
      fade = timers.setTimeout(() => callbacks.onFadeOut?.(), LOADING_MESSAGE_INTERVAL_MS - LOADING_MESSAGE_FADE_MS);
      rotation = timers.setTimeout(() => {
        index = (index + 1) % messages.length;
        elapsed = nextElapsed;
        callbacks.onMessage(messages[index]);
        scheduleNext();
      }, LOADING_MESSAGE_INTERVAL_MS);
    };
    scheduleNext();
  }, LOADING_SHOW_DELAY_MS);
  const slow = timers.setTimeout(() => {
    clearRotation();
    callbacks.onSlow(SLOW_LOADING_MESSAGE);
  }, LOADING_SLOW_DELAY_MS);
  return () => {
    timers.clearTimeout(show);
    timers.clearTimeout(slow);
    clearRotation();
  };
}
