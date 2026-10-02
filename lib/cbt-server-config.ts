// Server-only environment inputs. Empty/invalid configuration fails closed.
export function cbtProjectAllowed(url: string, refs: string | undefined) {
  try {
    const parsed = new URL(url);
    const match = /^([a-z0-9]+)\.supabase\.co$/.exec(parsed.hostname);
    return parsed.protocol === "https:" && !parsed.port && !parsed.username && !parsed.password && !!match &&
      (refs || "").split(",").map(value => value.trim()).filter(Boolean).includes(match[1]);
  } catch { return false; }
}
