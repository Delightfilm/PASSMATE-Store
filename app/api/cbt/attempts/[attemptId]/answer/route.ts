import { cbtError, cbtTestServer, cbtRpcError, CbtRequestError, isServerAttemptId } from "@/lib/cbt-test-server";

export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  try {
    const { db, userId } = await cbtTestServer(request);
    const { attemptId } = await params;
    const body = await request.json();
    if (!body || !isServerAttemptId(attemptId) || typeof body.questionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.questionId) || !(body.choice === null || Number.isInteger(body.choice) && body.choice >= 0 && body.choice <= 3) || !(body.review === null || typeof body.review === "boolean")) throw new CbtRequestError(422);
    const { data, error } = await db.rpc("cbt_answer", { p_user: userId, p_attempt: attemptId, p_question: body.questionId, p_choice: body.choice, p_review: body.review });
    if (error) throw cbtRpcError(error);
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return cbtError(error); }
}
