export async function GET() {
  return Response.json({ ok: true, service: "passmate-store", version: "0.1.1" });
}
