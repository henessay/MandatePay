"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet";
import { ConnectButton } from "@/components/shell/ConnectButton";
import { ShieldCheckIcon, EyeIcon, LockIcon, CheckIcon } from "@/components/icons";

export default function Landing() {
  const router = useRouter();
  const w = useWallet();

  // Already signed in (cookie restored) → go straight to the app.
  useEffect(() => {
    if (w.authedAddress) router.replace("/app");
  }, [w.authedAddress, router]);

  return (
    <main className="above mx-auto flex min-h-screen max-w-6xl flex-col px-5">
      <header className="flex items-center justify-between py-6">
        <span className="font-display text-2xl font-bold tracking-tight text-white">
          Mandate<span className="text-sky-400">Pay</span>
        </span>
        <ConnectButton variant="compact" afterSignIn={() => router.replace("/app")} />
      </header>

      <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        {/* hero copy */}
        <div className="animate-fade-up">
          <span className="chip border-sky-400/30 bg-sky-500/10 text-sky-200">
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            Built on Terminal 3 Agent-Auth
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl">
            Delegate payroll to an agent — on a leash it{" "}
            <span className="text-sky-400">cannot widen</span>.
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-slate-300">
            A CFO signs one bounded mandate with their wallet. An autonomous agent runs payroll under
            it — interpreting messy HR updates, never seeing a real account number, stopped cold by
            anomalies, every move written to an attested ledger.
          </p>

          <ul className="mt-7 grid max-w-xl gap-3 sm:grid-cols-2">
            <Feature icon={<EyeIcon className="h-4 w-4" />} title="Zero-PII by construction">
              The agent holds an opaque {"{{account}}"} — never a real number.
            </Feature>
            <Feature icon={<LockIcon className="h-4 w-4" />} title="Signed, bounded mandate">
              Ceiling, allowlist, per-line cap, validity window — sealed.
            </Feature>
            <Feature icon={<CheckIcon className="h-4 w-4" />} title="Deterministic authorization">
              The LLM proposes; the signed mandate + on-chain mirror authorize.
            </Feature>
            <Feature icon={<ShieldCheckIcon className="h-4 w-4" />} title="Attested audit ledger">
              Every payout — dispatched or halted — on an immutable trail.
            </Feature>
          </ul>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <ConnectButton variant="cta" afterSignIn={() => router.replace("/app")} />
            <span className="text-sm text-slate-500">
              Connect a wallet to sign in — gasless, authorises no payment.
            </span>
          </div>
          {w.error ? <p className="mt-3 text-sm text-halt-300">{w.error}</p> : null}
        </div>

        {/* glass preview card */}
        <div className="card glass-sky animate-fade-up p-6">
          <div className="label text-sky-200/80">What you sign in with</div>
          <div className="mt-4 space-y-3">
            <PreviewRow k="Identity" v="Your Ethereum wallet (EIP-191)" />
            <PreviewRow k="Session" v="SIWE — proves ownership, no gas" />
            <PreviewRow k="Mandate" v="Signed by you, enforced in-TEE + on-chain" />
            <PreviewRow k="Agent" v="Reads the leash, can never widen it" />
          </div>
          <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.025] p-4 text-[13px] leading-snug text-slate-400">
            No passwords, no PII. Your wallet is the login and the mandate signer — the same identity
            Terminal 3 uses for Agent-Auth.
          </div>
        </div>
      </div>

      <footer className="border-t border-white/8 py-5 text-center text-[11px] text-slate-600">
        Offline build · mock rail · mock attestation. © MandatePay — Terminal 3 Agent Dev Kit.
      </footer>
    </main>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-500/12 text-sky-300">
        {icon}
      </span>
      <div>
        <div className="text-sm font-semibold text-slate-100">{title}</div>
        <div className="mt-0.5 text-[12.5px] leading-snug text-slate-400">{children}</div>
      </div>
    </li>
  );
}

function PreviewRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-3 last:border-0 last:pb-0">
      <span className="text-xs uppercase tracking-wide text-slate-500">{k}</span>
      <span className="text-right text-sm text-slate-200">{v}</span>
    </div>
  );
}
