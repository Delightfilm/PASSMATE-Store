import { cbtError, cbtTestServer } from "@/lib/cbt-test-server";

export async function POST(request: Request) {
  try {
    const { db, userId } = await cbtTestServer(request);
    const body = await request.json();
    if (!body || !/^[0-9a-f-]{36}$/i.test(body.certId) || !["mock", "custom", "past", "subject"].includes(body.mode) || !["submit", "instant"].includes(body.gradeMode) || ![null, 30, 60, 90].includes(body.minutes) || !Array.isArray(body.questionIds) || body.questionIds.length > 120 || !body.questionIds.every((id: unknown) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id))) throw new Error("시험 구성을 확인해 주세요.");
    const { data, error } = await db.rpc("cbt_start", { p_user: userId, p_cert: body.certId, p_mode: body.mode, p_ids: body.questionIds, p_minutes: body.minutes, p_grade: body.gradeMode });
    if (error) throw new Error(error.message.includes("20") ? "과목별 가용 문항이 20개 이상인지 확인해 주세요." : "시험 구성을 저장하지 못했습니다. 다시 시도해 주세요.");
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return cbtError(error); }
}
