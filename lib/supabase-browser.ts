"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "@/lib/public-supabase-config";

let browserClient: SupabaseClient | undefined;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const { url, key } = getPublicSupabaseConfig();
  browserClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "implicit",
    },
  });

  return browserClient;
}
