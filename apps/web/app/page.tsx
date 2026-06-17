"use client";

import { useState } from "react";
import { formatCents } from "@mandatepay/shared";
import { MandateCard } from "@/components/MandateCard";
import { HrIntake } from "@/components/HrIntake";
import { SplitScreen } from "@/components/SplitScreen";
import { LedgerView, Escalations } from "@/components/LedgerView";
import { DEFAULT_HR_UPDATE, type CycleResponse } from "@/lib/types";

export default function Home() {
  const [hrUpdate, setHrUpdate] = useState(DEFAULT_HR_UPDATE);
  const [data, setData] = useState<CycleResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cycle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hrUpdate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json as CycleResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
          MandatePay
          <span className="ml-2 align-middle text-sm font-normal text-zinc-500">
            bounded payroll delegation you can watch
          </span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          A CFO signs <span className="text-zinc-200">one bounded mandate</span>. An autonomous
          agent runs payroll under it — interpreting messy HR updates, never seeing a real account
          number, getting stopped cold by anomalies, and writing every move to an attested ledger.
          The agent <span className="text-zinc-200">cannot widen the mandate</span>.
        </p>
        {data ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="chip border-zinc-600 text-zinc-400">rail: {data.railKind}</span>
            <span className="chip border-zinc-600 text-zinc-400">llm: {data.llmKind}</span>
          </div>
        ) : null}
      </header>

      <div className="grid gap-6">
        {data ? (
          <MandateCard
            mandate={data.mandate}
            verified={data.mandateVerified}
            attestation={data.attestation}
          />
        ) : null}

        <HrIntake
          value={hrUpdate}
          onChange={setHrUpdate}
          onRun={run}
          loading={loading}
          interpretation={data?.proposal.interpretation}
        />

        {error ? (
          <div className="card border-rose-500/40 p-4 text-sm text-rose-300">Error: {error}</div>
        ) : null}

        {data ? (
          <>
            <CeilingBar proposal={data.proposal} dispatched={data.dispatched} />
            <SplitScreen proposal={data.proposal} receipts={data.receipts} />
            <Escalations flags={data.proposal.escalations} />
            <LedgerView events={data.ledger} />
          </>
        ) : null}
      </div>

      <footer className="mt-10 text-center text-xs text-zinc-600">
        Offline build · mock rail · mocked attestation. Flip{" "}
        <code className="mono">MANDATEPAY_RAIL=t3-payroll</code> + keys to go live.
      </footer>
    </main>
  );
}

function CeilingBar({
  proposal,
  dispatched,
}: {
  proposal: CycleResponse["proposal"];
  dispatched: boolean;
}) {
  const pct = Math.min(100, Math.round((proposal.totalCents / proposal.ceilingCents) * 100));
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-zinc-200">
          Ready total {formatCents(proposal.totalCents, "SGD")}
          <span className="text-zinc-500"> / ceiling {formatCents(proposal.ceilingCents, "SGD")}</span>
        </span>
        <span
          className={`chip ${
            proposal.withinCeiling
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/40 bg-rose-500/10 text-rose-300"
          }`}
        >
          {proposal.withinCeiling ? "within ceiling" : "ceiling exceeded — dispatch refused"}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-edge">
        <div
          className={`h-full ${proposal.withinCeiling ? "bg-emerald-500" : "bg-rose-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!dispatched ? (
        <p className="mt-2 text-xs text-rose-300">
          The agent refused to dispatch this cycle — the deterministic layer blocked it.
        </p>
      ) : null}
    </div>
  );
}
