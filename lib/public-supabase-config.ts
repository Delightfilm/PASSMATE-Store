// Browser-safe Supabase project configuration.
//
// These values are intentionally publishable and may be embedded in client/build output.
// Never add a service-role key or any server-only secret here.
export const DEFAULT_SUPABASE_URL =
  "https://fmecqeadghrdisirucqm.supabase.co";

export const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_6zY4qNe7V564E-EfgDVcVQ_KP-klw3s";

export function getPublicSupabaseConfig() {
  return {
    url:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      DEFAULT_SUPABASE_URL,
    key:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  };
}
