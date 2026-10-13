import sitemap from "../sitemap";

// Google supports UTF-8 text sitemaps. Keep both formats on the same URL source.
export const dynamic = "force-static";

export function GET() {
  const body = `${sitemap().map(item => item.url).join("\n")}\n`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
