"use client";

import Link from "next/link";
import { ConnectButton } from "./ConnectButton";
import { AttestationBadge } from "@/components/AttestationBadge";
import { DEFAULT_ATTESTATION } from "@/lib/types";

export function TopBar() {
  return (
    <header className="above sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/8 bg-navy-950/50 px-5 py-3 backdrop-blur-xl">
      <Link href="/app" className="font-display text-lg font-bold tracking-tight text-white lg:hidden">
        Mandate<span className="text-sky-400">Pay</span>
      </Link>
      <div className="hidden text-sm text-slate-500 lg:block">Bounded payroll delegation you can watch</div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:block">
          <AttestationBadge status={DEFAULT_ATTESTATION} />
        </div>
        <ConnectButton variant="compact" />
      </div>
    </header>
  );
}
