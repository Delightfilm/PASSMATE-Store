import { cbtError, cbtTestServer } from "@/lib/cbt-test-server";

// Reserving a collision-free daily number is explicit preparation, never GET.
export async function POST(request: Request) {
  try {
    const { db, userId } = await cbtTestServer(request);
    const { data, error } = await db.rpc("cbt_prepare_identity", { p_user: userId });
    if (error) throw new Error("연습용 번호를 준비하지 못했습니다.");
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return cbtError(error); }
}
