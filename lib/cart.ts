export type PackageType = "core" | "pass";

export type CartItem = {
  familySlug: string;
  slug: string;
  title: string;
  packageType: PackageType;
};

export type CartSelection = {
  familySlug: string;
  title: string;
  packageType: PackageType;
};

export const PACKAGE_LABELS: Record<PackageType, string> = {
  core: "핵심요약 패키지",
  pass: "합격팩",
};

const PASS_PACK_SUFFIX = "-pass-pack";
const KEY = "passmate-cart";

export function getPackageSlug(familySlug: string, packageType: PackageType) {
  return packageType === "pass" ? familySlug + PASS_PACK_SUFFIX : familySlug;
}

export function getFamilySlug(slug: string) {
  return slug.endsWith(PASS_PACK_SUFFIX)
    ? slug.slice(0, -PASS_PACK_SUFFIX.length)
    : slug;
}

function normalizeCartItem(value: unknown): CartItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const item = value as Record<string, unknown>;
  const packageType: PackageType | null =
    item.packageType === "core" || item.packageType === "pass"
      ? item.packageType
      : null;
  const rawSlug =
    typeof item.slug === "string" && item.slug.length > 0 ? item.slug : null;
  const title =
    typeof item.title === "string" && item.title.trim().length > 0
      ? item.title.trim()
      : null;

  if (!packageType || !rawSlug || !title) return null;

  const familySlug =
    typeof item.familySlug === "string" && item.familySlug.length > 0
      ? getFamilySlug(item.familySlug)
      : getFamilySlug(rawSlug);

  return {
    familySlug,
    slug: getPackageSlug(familySlug, packageType),
    title,
    packageType,
  };
}

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];

  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(value)) return [];

    const normalized: CartItem[] = [];
    for (const rawItem of value) {
      const item = normalizeCartItem(rawItem);
      if (!item) continue;

      const existingIndex = normalized.findIndex(
        (entry) => entry.familySlug === item.familySlug
      );
      if (existingIndex >= 0) normalized[existingIndex] = item;
      else normalized.push(item);
    }
    return normalized;
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("passmate-cart-change"));
}

export function addToCart(
  selection: CartSelection
): "added" | "replaced" | "unchanged" {
  const familySlug = getFamilySlug(selection.familySlug);
  const item: CartItem = {
    familySlug,
    slug: getPackageSlug(familySlug, selection.packageType),
    title: selection.title,
    packageType: selection.packageType,
  };

  const cart = readCart();
  const existing = cart.find((entry) => entry.familySlug === familySlug);
  if (existing?.packageType === item.packageType) return "unchanged";

  const next = existing
    ? cart.map((entry) => (entry.familySlug === familySlug ? item : entry))
    : [...cart, item];

  writeCart(next);
  return existing ? "replaced" : "added";
}
