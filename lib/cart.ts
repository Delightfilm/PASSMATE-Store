export type CartItem = { slug: string; title: string; packageType: "core" | "pass"; price: number; quantity: number };
const KEY = "passmate-cart";
export function readCart(): CartItem[] { if (typeof window === "undefined") return []; try { const value = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } }
export function writeCart(items: CartItem[]) { localStorage.setItem(KEY, JSON.stringify(items)); window.dispatchEvent(new Event("passmate-cart-change")); }
export function addToCart(item: CartItem) { const cart = readCart(); const existing = cart.find((entry) => entry.slug === item.slug && entry.packageType === item.packageType); writeCart(existing ? cart.map((entry) => entry === existing ? { ...entry, quantity: entry.quantity + 1 } : entry) : [...cart, item]); }
