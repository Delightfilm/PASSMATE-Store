import type { User } from "@supabase/supabase-js";

/** Presentation only: names never decide permissions or roles. */
export function accountDisplayName(user: Pick<User, "user_metadata"> | null, profileName?: unknown): string {
  const metadata = user?.user_metadata || {};
  return [profileName, metadata.full_name, metadata.name, metadata.nickname].find((value): value is string => typeof value === "string" && Boolean(value.trim()))?.trim() || "";
}
