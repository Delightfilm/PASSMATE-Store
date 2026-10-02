import type { NextConfig } from "next";
import { cbtProjectAllowed } from "./lib/cbt-server-config";

const cbtServerReady = cbtProjectAllowed(process.env.NEXT_PUBLIC_SUPABASE_URL || "", process.env.CBT_SERVER_PROJECT_REFS) && !!(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_CBT_PREVIEW_READ_ONLY: process.env.VERCEL_ENV === "preview" && !cbtServerReady ? "1" : "0", NEXT_PUBLIC_CBT_SERVER_READY: cbtServerReady ? "1" : "0" },
};

export default nextConfig;
