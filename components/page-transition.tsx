"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className="page-transition" key={pathname}>{children}</div>;
}
