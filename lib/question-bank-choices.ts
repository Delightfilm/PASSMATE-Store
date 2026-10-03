import type { Choice } from "./question-bank";

// Shared by browser and trusted server lookup, without importing browser auth.
export function normalizeLiveChoices(value: unknown): Choice[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (typeof item === "string") return { label: ["①", "②", "③", "④", "⑤"][index] ?? String(index + 1), text: item };
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return { label: String(record.label || index + 1), text: String(record.text || "") };
  }).filter((item) => item.text);
}
