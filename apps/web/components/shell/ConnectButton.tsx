"use client";

import { useState } from "react";
import { useWallet, shortAddress } from "@/lib/wallet";
import { WalletIcon, LogoutIcon } from "@/components/icons";

export function ConnectButton({
  variant = "compact",
  afterSignIn,
}: {
  variant?: "compact" | "cta";
  afterSignIn?: () => void;
}) {
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const big = variant === "cta";
  const size = big ? "px-5 py-3 text-[15px]" : "px-3.5 py-2 text-sm";

  if (!w.hasProvider) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer"
        className={`inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] font-semibold text-slate-200 transition hover:border-sky-400/40 ${size}`}
      >
        <WalletIcon className="h-4 w-4" />
        Install MetaMask
      </a>
    );
  }

  if (w.authedAddress) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className={`inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 font-semibold text-emerald-100 ${size}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {shortAddress(w.authedAddress)}
        </button>
        {open ? (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-navy-900/95 p-1.5 backdrop-blur-xl">
              <button
                onClick={() => {
                  setOpen(false);
                  void w.signOut();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-white/5"
              >
                <LogoutIcon className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  const onClick = w.address
    ? () => void w.signIn().then(() => afterSignIn?.())
    : () => void w.connect();
  const label = w.address
    ? w.signingIn
      ? "Signing in…"
      : "Sign in with wallet"
    : w.connecting
      ? "Connecting…"
      : "Connect Wallet";

  return (
    <button
      onClick={onClick}
      disabled={w.connecting || w.signingIn}
      className={`inline-flex items-center gap-2 rounded-xl bg-sky-500 font-semibold text-navy-950 shadow-[0_8px_24px_-8px_rgba(56,189,248,0.6)] transition hover:bg-sky-400 disabled:opacity-60 ${size}`}
    >
      <WalletIcon className="h-4 w-4" />
      {label}
    </button>
  );
}
