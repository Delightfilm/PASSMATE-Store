import { cbtError, cbtTestServer } from "@/lib/cbt-test-server";

export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  try {
    const { db, userId } = await cbtTestServer(request);
    const { attemptId } = await params;
    const body = await request.json();
    if (!/^managed-[0-9a-f-]{36}$/i.test(attemptId) || typeof body.questionId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.questionId) || !(body.choice === null || Number.isInteger(body.choice) && body.choice >= 0 && body.choice <= 3) || !(body.review === null || typeof body.review === "boolean")) throw new Error("답안을 확인해 주세요.");
    const { data, error } = await db.rpc("cbt_answer", { p_user: userId, p_attempt: attemptId, p_question: body.questionId, p_choice: body.choice, p_review: body.review });
    if (error) throw new Error("답안을 저장하지 못했습니다. 시간이 종료되었거나 제출된 시험일 수 있습니다.");
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return cbtError(error); }
}
