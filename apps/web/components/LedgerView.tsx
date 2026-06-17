import { formatCents, type LedgerEvent, type AnomalyFlag } from "@mandatepay/shared";

const OUTCOME_STYLE: Record<LedgerEvent["outcome"], string> = {
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  denied: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  halted: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  escalated: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

export function Escalations({ flags }: { flags: AnomalyFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <div className="card border-amber-500/30 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-300">
        ⚠ Halted &amp; escalated to a human ({flags.length})
      </h2>
      <ul className="mt-3 space-y-3">
        {flags.map((f) => (
          <li key={f.employeeId} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-100">{f.displayName}</span>
              <span className="chip border-amber-500/40 text-amber-300">
                {f.accountChanged ? "account changed" : "anomaly"}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-300">{f.reason}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LedgerView({ events }: { events: LedgerEvent[] }) {
  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Live audit ledger
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        Host-stamped, append-only events (actor / subject / vc_id). Integrity = immutable
        batches + tx ref + TEE attestation — not an invented client-side proof.
      </p>
      <ol className="mt-4 space-y-2">
        {events.map((e) => (
          <li key={e.id} className="rounded-lg border border-edge bg-ink/50 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="mono text-zinc-200">{e.action}</span>
              <span className={`chip ${OUTCOME_STYLE[e.outcome]}`}>{e.outcome}</span>
            </div>
            {e.details ? <p className="mt-1 text-zinc-400">{e.details}</p> : null}
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-zinc-600">
              <span>target: {e.target}</span>
              {e.amountCents !== undefined ? (
                <span>amount: {formatCents(e.amountCents, e.currency ?? "SGD")}</span>
              ) : null}
              {e.vcId ? <span className="mono">vc: {e.vcId.slice(0, 10)}…</span> : null}
              {e.txHash ? <span className="mono">tx: {e.txHash.slice(0, 14)}…</span> : null}
              <span>{e.committed ? "committed" : "uncommitted"}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
