import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "./public-supabase-config";

export class CbtRequestError extends Error {
  constructor(public status: number) { super("CBT request failed"); }
}
export function cbtRpcError(error: { code?: string }) {
  const code = error.code || "";
  return new CbtRequestError(code === "PT403" || code === "42501" || code === "P0002" ? 403 : code === "PT409" || code === "40001" || code === "23505" ? 409 : code === "PT422" || code === "P0001" || code.startsWith("22") || code.startsWith("23") ? 422 : 500);
}
export function requireServerStart(mode: string) {
  if (process.env.NEXT_PUBLIC_CBT_SERVER_EXAMS !== "1" || !(process.env.NEXT_PUBLIC_CBT_SERVER_MODES || "mock").split(",").map(value => value.trim()).includes(mode)) throw new CbtRequestError(409);
}
export async function cbtTestServer(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new CbtRequestError(401);
  const { url, key } = getPublicSupabaseConfig();
  const ref = new URL(url).hostname.split(".")[0];
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.CBT_TEST_PROJECT_REF !== ref || !ref || ref === "fmecqeadghrdisirucqm" || process.env.VERCEL_ENV === "production" || !secret) {
    throw new CbtRequestError(500);
  }
  const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user) throw new CbtRequestError(401);
  return { userId: data.user.id, db: createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }) };
}
export function cbtError(error: unknown) {
  const status = error instanceof CbtRequestError ? error.status : error instanceof SyntaxError ? 422 : 500;
  const messages: Record<number, string> = { 401: "로그인을 다시 확인해 주세요.", 403: "이 응시를 변경할 권한이 없습니다.", 409: "시험 상태가 변경되었거나 저장이 종료되었습니다. 기록을 다시 확인해 주세요.", 422: "시험 구성과 답안을 확인해 주세요. 출제 가능한 문항이 부족할 수 있습니다.", 500: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  console.error("[CBT API]", { status });
  return Response.json({ error: messages[status] || messages[500] }, { status, headers: { "Cache-Control": "no-store" } });
}
