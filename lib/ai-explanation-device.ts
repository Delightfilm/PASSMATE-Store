import type { ExplanationReply } from "./ai-explanation-contract";

export const AI_SIGNUP_THRESHOLD = 10;
export const AI_DEVICE_STORAGE_KEY = "passmate.ai.created-explanations.v1";
export const AI_DEVICE_EVENT = "passmate:ai-explanation-created";
type DeviceStorage = Pick<Storage, "getItem" | "setItem">;
let fallbackKeys: string[] = [];

function readKeys(storage: DeviceStorage) {
  try {
    const value: unknown = JSON.parse(storage.getItem(AI_DEVICE_STORAGE_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((key): key is string => typeof key === "string" && /^[a-f0-9]{64}$/.test(key)))].slice(0, AI_SIGNUP_THRESHOLD);
  } catch { return fallbackKeys; }
}
export function deviceGenerationCount(storage: DeviceStorage) {
  return readKeys(storage).length;
}
export function recordDeviceGeneration(storage: DeviceStorage, revision: string, result: ExplanationReply) {
  const keys = readKeys(storage);
  // Count only a fresh, accepted generation, never cache reads, polling or failed paid attempts.
  if (result.status !== "ready" || result.cached !== false || !/^[a-f0-9]{64}$/.test(revision) ||
      keys.includes(revision) || keys.length >= AI_SIGNUP_THRESHOLD) return keys.length;
  keys.push(revision); fallbackKeys = keys;
  try { storage.setItem(AI_DEVICE_STORAGE_KEY, JSON.stringify(keys)); } catch { /* best-effort invitation, not a quota */ }
  return keys.length;
}
