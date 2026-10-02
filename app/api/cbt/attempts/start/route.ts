import { cbtError, cbtTestServer, cbtRpcError, CbtRequestError, requireServerStart } from "@/lib/cbt-test-server";

export async function POST(request: Request) {
  try {
    const { db, userId } = await cbtTestServer(request);
    const body = await request.json();
    if (!body || !/^[0-9a-f-]{36}$/i.test(body.certId) || !["mock", "custom", "past", "subject"].includes(body.mode) || !["submit", "instant"].includes(body.gradeMode) || ![null, 30, 60, 90].includes(body.minutes) || !Array.isArray(body.questionIds) || body.questionIds.length > 120 || !body.questionIds.every((id: unknown) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id))) throw new CbtRequestError(422);
    requireServerStart(body.mode);
    const { data, error } = await db.rpc("cbt_start", { p_user: userId, p_cert: body.certId, p_mode: body.mode, p_ids: body.questionIds, p_minutes: body.minutes, p_grade: body.gradeMode });
    if (error) throw cbtRpcError(error);
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return cbtError(error); }
}
