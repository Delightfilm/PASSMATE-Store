"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const SERVICE_TABS = [
  { key: "passmate", label: "PASS MATE", href: "/" },
  { key: "cbt", label: "CBT MATE", href: "/question-bank/" },
] as const;

export function ServiceSwitcher() {
  const pathname = usePathname();
  const cbtActive = pathname.startsWith("/question-bank");
  return (
    <nav className="service-switcher" aria-label="서비스 전환">
      <div className="service-switcher__inner">
        {SERVICE_TABS.map((tab) => {
          const active = tab.key === "cbt" ? cbtActive : !cbtActive;
          return (
            <Link className={`service-switcher__tab${active ? " is-active" : ""}`} href={tab.href} key={tab.key}>
              <span className={`service-switcher__logo service-switcher__logo--${tab.key}`}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
