import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  if (!url.pathname.startsWith("/question-bank-content/")) return NextResponse.next();
  const deny = (status: number) => NextResponse.json({ error: status === 405 ? "method_not_allowed" : "not_found" }, {
    status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", ...(status === 405 ? { Allow: "GET, HEAD" } : {}) },
  });
  if (!["GET", "HEAD"].includes(request.method)) return deny(405);
  const file = /^\/question-bank-content\/bundles\/([a-z0-9_-]{1,96}\.json\.gz)$/i.exec(url.pathname)?.[1];
  const digest = url.searchParams.get("v");
  if (!file || !digest || !/^[a-f0-9]{64}$/i.test(digest) || url.searchParams.getAll("v").length !== 1 || [...url.searchParams.keys()].some((key) => key !== "v")) return deny(404);
  // Public representation headers only: cookies, credentials, referers and
  // arbitrary user headers must stay at the existing site boundary.
  // Next ignores an empty override list; the public default makes removal of
  // all non-allowlisted incoming headers effective even on a bare HTTP request.
  const forwarded = new Headers({ Accept: "application/json" });
  for (const name of ["accept-encoding", "if-none-match", "if-modified-since"]) {
    const value = request.headers.get(name);
    if (value !== null) forwarded.set(name, value);
  }
  const destination = new URL(`https://content.mypassmate.com/bundles/${file}`);
  destination.searchParams.set("v", digest.toLowerCase());
  const response = NextResponse.rewrite(destination, { request: { headers: forwarded } });
  // Opt in to upstream policies; do not override error/no-store responses.
  response.headers.set("x-vercel-enable-rewrite-caching", "1");
  response.headers.set("X-Robots-Tag", "noindex");
  return response;
}

export const config = { matcher: ["/question-bank-content/:path*"] };
