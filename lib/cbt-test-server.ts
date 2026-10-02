import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "./public-supabase-config";

export async function cbtTestServer(request: Request) {
  const { url, key } = getPublicSupabaseConfig();
  const ref = new URL(url).hostname.split(".")[0];
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.CBT_TEST_PROJECT_REF !== ref || !ref || ref === "fmecqeadghrdisirucqm" || process.env.VERCEL_ENV === "production" || process.env.NEXT_PUBLIC_CBT_SERVER_EXAMS !== "1" || !secret) {
    throw new Error("별도 테스트 DB 연결 후 사용할 수 있습니다.");
  }
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new Error("로그인이 필요합니다.");
  const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user) throw new Error("로그인을 다시 확인해 주세요.");
  return { userId: data.user.id, db: createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }) };
}
export function cbtError(error: unknown) {
  console.error("[CBT test API]", error instanceof Error ? error.message : "request failed");
  return Response.json({ error: error instanceof Error ? error.message : "요청을 처리하지 못했습니다." }, { status: 400, headers: { "Cache-Control": "no-store" } });
}
