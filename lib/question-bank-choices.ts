import type { Choice } from "./question-bank";

// Shared by browser and trusted server lookup, without importing browser auth.
export function normalizeLiveChoices(value: unknown): Choice[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (typeof item === "string") return { label: ["①", "②", "③", "④", "⑤"][index] ?? String(index + 1), text: item };
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return { label: String(record.label || index + 1), text: String(record.text || ""),
      ...(Array.isArray(record.images) ? { images: record.images.filter((image): image is string => typeof image === "string") } : {}) };
  }); // Never compact choices: the registered answer refers to the source position.
}

// Legacy sparse corrections retain source images. Version 2 explicitly owns media.
export function correctedChoices(original: Choice[], edited: Choice[], explicitImages = false): Choice[] {
  return edited.map((choice, index) => ({ label: choice.label, text: choice.text,
    ...(explicitImages ? { images: choice.images || [] } : original[index]?.images?.length ? { images: original[index].images } : {}) }));
}
