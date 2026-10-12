import type { Metadata } from "next";
import { privateMetadata } from "@/lib/seo";

export const metadata: Metadata = privateMetadata;

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
