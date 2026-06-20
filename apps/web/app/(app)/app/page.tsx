"use client";

import { useRef, useState } from "react";
import { MandateCard } from "@/components/MandateCard";
import { HrIntake } from "@/components/HrIntake";
import { SplitScreen } from "@/components/SplitScreen";
import { LedgerView, Escalations } from "@/components/LedgerView";
import { AttestationBadge } from "@/components/AttestationBadge";
import { EyeIcon, BankIcon, SpinnerIcon } from "@/components/icons";
import {
  DEFAULT_HR_UPDATE,
  DEFAULT_ATTESTATION,
  type CycleResponse,
  type Phase,
} from "@/lib/types";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState<"parsing" | "dispatching" | null>(null);
  const [hrUpdate, setHrUpdate] = useState(DEFAULT_HR_UPDATE);
  const [data, setData] = useState<CycleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function signMandate() {
    setError(null);
    setPhase("signing");
    if (signTimer.current) clearTimeout(signTimer.current);
    // A short, deliberate signing beat — the real EIP-191 signature is computed
    // server-side when the cycle runs and is revealed on the mandate card then.
    signTimer.current = setTimeout(() => setPhase("signed"), 750);
  }

  async function run() {
    setError(null);
    setPhase("running");
    setStage("parsing");
    const toDispatch = setTimeout(() => setStage("dispatching"), 900);
    try {
      const res = await fetch("/api/cycle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hrUpdate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json as CycleResponse);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("signed");
    } finally {
      clearTimeout(toDispatch);
      setStage(null);
    }
  }

  const loading = phase === "running";
  const canRun = phase === "signed" || phase === "done";
  const attestation = data?.attestation ?? DEFAULT_ATTESTATION;

  return (
    <main className="above mx-auto max-w-7xl px-5 py-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Mandate<span className="text-sky-400">Pay</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
            A CFO signs <span className="text-slate-200">one bounded mandate</span>. An autonomous
            agent runs payroll under it — never seeing a real account number, stopped cold by
            anomalies, every move on an attested ledger. It cannot widen the mandate.
          </p>
        </div>
        <AttestationBadge status={attestation} />
      </header>

      <div className="mt-7 grid gap-5 lg:grid-cols-12">
        {/* left column — the mandate (the bounds) */}
        <div className="space-y-5 lg:col-span-4 lg:sticky lg:top-6 lg:self-start">
          <MandateCard
            phase={phase}
            mandate={data?.mandate ?? null}
            verified={data?.mandateVerified ?? false}
            proposal={data?.proposal ?? null}
            onSign={signMandate}
          />
          {data ? <Escalations flags={data.proposal.escalations} /> : null}
        </div>

        {/* right column — the centerpiece + ledger */}
        <div className="space-y-5 lg:col-span-8">
          {error ? (
            <div className="card border-halt-500/40 p-4 text-sm text-halt-300 above">
              Error: {error}
            </div>
          ) : null}

          {loading ? <CycleStatus stage={stage} /> : null}

          {data ? (
            <SplitScreen proposal={data.proposal} receipts={data.receipts} />
          ) : (
            <SplitScreenPlaceholder />
          )}

          {data ? <LedgerView events={data.ledger} /> : <LedgerPlaceholder />}
        </div>
      </div>

      {/* bottom — free-form HR intake */}
      <div className="mt-5">
        <HrIntake
          value={hrUpdate}
          onChange={setHrUpdate}
          onRun={run}
          loading={loading}
          canRun={canRun}
          interpretation={data?.proposal.interpretation}
        />
      </div>

      <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center text-[11px] text-slate-600">
        <span>Offline build · mock rail · mock attestation.</span>
        {data ? (
          <>
            <span className="chip border-white/10 bg-white/[0.03] text-slate-500">
              rail: {data.railKind}
            </span>
            <span className="chip border-white/10 bg-white/[0.03] text-slate-500">
              llm: {data.llmKind}
            </span>
          </>
        ) : null}
        <span>
          Flip <code className="mono text-slate-500">MANDATEPAY_RAIL=t3-payroll</code> + keys to go
          live.
        </span>
      </footer>
    </main>
  );
}

function CycleStatus({ stage }: { stage: "parsing" | "dispatching" | null }) {
  const label =
    stage === "dispatching"
      ? "Enforcing bounds & dispatching ready lines…"
      : "Interpreting the HR update…";
  return (
    <div className="card glass-sky flex items-center gap-3 p-4 above">
      <SpinnerIcon className="h-5 w-5 text-sky-300" />
      <div>
        <div className="text-sm font-semibold text-sky-100">Running payroll cycle</div>
        <div className="text-[13px] text-slate-400">{label}</div>
      </div>
    </div>
  );
}

function SplitScreenPlaceholder() {
  return (
    <section className="card glass-sky p-5 above">
      <h2 className="label text-sky-200/80">The zero-PII boundary, made visible</h2>
      <div className="mt-4 overflow-hidden rounded-xl border border-dashed border-white/12 bg-white/[0.015]">
        <div className="grid grid-cols-2">
          <div className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <EyeIcon className="h-4 w-4" />
            What the agent saw
          </div>
          <div className="flex items-center gap-2 border-l border-sky-400/20 bg-sky-500/[0.04] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-sky-200/90">
            <BankIcon className="h-4 w-4" />
            What the bank received
          </div>
        </div>
        <div className="border-t border-white/8 px-4 py-10 text-center text-sm text-slate-500">
          Sign the mandate, drop in an HR update, and run the cycle — the agent&apos;s{" "}
          <span className="mono text-sky-300/70">{"{{account}}"}</span> placeholder vs. the bank&apos;s
          masked account appears here.
        </div>
      </div>
    </section>
  );
}

function LedgerPlaceholder() {
  return (
    <section className="card p-5 above">
      <h2 className="label">Live audit ledger</h2>
      <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
        Mandate signed → HR parsed → bounds authorized → dispatched / halted. Every step lands here
        with an actor, a subject, and a tx ref.
      </div>
    </section>
  );
}
