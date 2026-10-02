import { cbtError, cbtTestServer, cbtRpcError, CbtRequestError, requireServerStart } from "@/lib/cbt-test-server";

export async function POST(request: Request) {
  try {
    const { db, userId } = await cbtTestServer(request);
    const body = await request.json();
    if (!body || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.certId) || body.mode !== "mock" || body.gradeMode !== "submit" || !Array.isArray(body.questionIds) || body.questionIds.length !== 0) throw new CbtRequestError(422);
    requireServerStart(body.mode);
    const { data, error } = await db.rpc("cbt_start", { p_user: userId, p_cert: body.certId, p_mode: "mock", p_ids: [], p_minutes: null, p_grade: "submit" });
    if (error) throw cbtRpcError(error);
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return cbtError(error); }
}
