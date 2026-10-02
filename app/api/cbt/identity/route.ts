import { cbtError, cbtTestServer, cbtRpcError, requireServerStart } from "@/lib/cbt-test-server";

// Reserving a collision-free daily number is explicit preparation, never GET.
export async function POST(request: Request) {
  try {
    const { db, userId } = await cbtTestServer(request);
    requireServerStart("mock");
    const { data, error } = await db.rpc("cbt_prepare_identity", { p_user: userId });
    if (error) throw cbtRpcError(error);
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return cbtError(error); }
}
