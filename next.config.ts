import type { NextConfig } from "next";

const cbtRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fmecqeadghrdisirucqm.supabase.co").hostname.split(".")[0];
const cbtTestReady = process.env.NEXT_PUBLIC_CBT_SERVER_EXAMS === "1" && process.env.CBT_TEST_PROJECT_REF === cbtRef && cbtRef !== "fmecqeadghrdisirucqm";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_CBT_PREVIEW_READ_ONLY: process.env.VERCEL_ENV === "preview" && !cbtTestReady ? "1" : "0" },
};

export default nextConfig;
