export type LoginMethod = "email" | "google" | "kakao";

const recentKey = "passmate.auth.recent-method";
const pendingKey = "passmate.auth.pending-method";
const pendingLifetime = 30 * 60 * 1000;

function isLoginMethod(value: unknown): value is LoginMethod {
  return value === "email" || value === "google" || value === "kakao";
}

// Optional UI hint only. Never store account details or use it for authorization.
export function readRecentLogin(): LoginMethod | null {
  try {
    const method = window.localStorage.getItem(recentKey);
    return isLoginMethod(method) ? method : null;
  } catch { return null; }
}

export function rememberRecentLogin(method: LoginMethod): void {
  try { window.localStorage.setItem(recentKey, method); } catch { /* Login still succeeds without storage. */ }
}

export function rememberPendingOAuth(method: Exclude<LoginMethod, "email">): void {
  try { window.sessionStorage.setItem(pendingKey, JSON.stringify({ method, startedAt: Date.now() })); } catch { /* Optional UI hint. */ }
}

export function clearPendingOAuth(): void {
  try { window.sessionStorage.removeItem(pendingKey); } catch { /* Optional UI hint. */ }
}

export function completeRecentOAuth(): void {
  try {
    const pending = JSON.parse(window.sessionStorage.getItem(pendingKey) || "null");
    const age = Date.now() - pending?.startedAt;
    if ((pending?.method === "google" || pending?.method === "kakao") &&
      typeof pending.startedAt === "number" && age >= 0 && age <= pendingLifetime) {
      rememberRecentLogin(pending.method);
    }
  } catch { /* Missing, malformed or denied storage must not interrupt login. */ }
  finally { clearPendingOAuth(); }
}
