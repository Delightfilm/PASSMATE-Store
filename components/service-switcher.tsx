"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const SERVICE_TABS = [
  { key: "passmate", label: "스토어", href: "/store/" },
  { key: "cbt", label: "문제은행", href: "/cbt/" },
] as const;

export function ServiceSwitcher() {
  const pathname = usePathname();
  if (/^\/cbt\/[^/]+\/exam\//.test(pathname)) return null;
  const cbtActive = pathname === "/" || pathname.startsWith("/cbt");
  return (
    <nav className="service-switcher" aria-label="서비스 전환">
      {SERVICE_TABS.map((tab) => {
        const active = tab.key === "cbt" ? cbtActive : !cbtActive;
        return <Link className={`service-switcher__tab${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined} href={tab.href} prefetch={false} key={tab.key}>{tab.label}</Link>;
      })}
    </nav>
  );
}
