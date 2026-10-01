export function timeLeftSeconds(endAt: string | null, now = Date.now()): number | null {
  if (!endAt) return null;
  const remaining = Date.parse(endAt) - now;
  return Number.isFinite(remaining) ? Math.max(0, Math.ceil(remaining / 1000)) : 0;
}
