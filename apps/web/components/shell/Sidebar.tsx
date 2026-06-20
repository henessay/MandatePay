"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GridIcon, ClockIcon, UserIcon, GearIcon } from "@/components/icons";

const NAV = [
  { href: "/app", label: "Dashboard", Icon: GridIcon },
  { href: "/app/history", label: "Payment history", Icon: ClockIcon },
  { href: "/app/profile", label: "Profile & org", Icon: UserIcon },
  { href: "/app/settings", label: "Settings", Icon: GearIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="above hidden border-r border-white/8 lg:flex lg:flex-col lg:gap-1 lg:px-3 lg:py-5">
      <Link href="/app" className="mb-5 px-2.5">
        <span className="font-display text-xl font-bold tracking-tight text-white">
          Mandate<span className="text-sky-400">Pay</span>
        </span>
      </Link>
      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/app" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition ${
                active
                  ? "border border-sky-400/25 bg-sky-500/10 text-sky-100"
                  : "border border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-2.5 pt-5 text-[11px] leading-snug text-slate-600">
        Offline build · mock rail · mock attestation.
      </div>
    </aside>
  );
}
