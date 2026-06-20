import { formatCents, type LedgerEvent, type AnomalyFlag } from "@mandatepay/shared";
import { WarnIcon } from "./icons";

const OUTCOME_STYLE: Record<LedgerEvent["outcome"], string> = {
  success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  denied: "border-halt-500/40 bg-halt-500/10 text-halt-300",
  halted: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  escalated: "border-amber-400/30 bg-amber-400/10 text-amber-200",
};

export function Escalations({ flags }: { flags: AnomalyFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <section className="card border-halt-500/25 p-5 above animate-fade-up">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-halt-500/15 text-halt-300">
          <WarnIcon className="h-4 w-4" />
        </span>
        <h2 className="label text-halt-300">Halted &amp; escalated · {flags.length}</h2>
      </div>
      <ul className="mt-3 space-y-2.5">
        {flags.map((f) => (
          <li key={f.employeeId} className="rounded-xl border border-halt-500/20 bg-halt-500/[0.06] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-100">{f.displayName}</span>
              <span className="chip border-halt-500/40 bg-halt-500/10 text-halt-300">
                {f.accountChanged ? "account changed" : "anomaly"}
              </span>
            </div>
            <p className="mt-1 text-[13px] leading-snug text-slate-300">{f.reason}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-snug text-slate-500">
        The deterministic layer halts the line; the agent only writes the human-readable reason.
      </p>
    </section>
  );
}

export function LedgerView({ events }: { events: LedgerEvent[] }) {
  return (
    <section className="card p-5 above animate-fade-up">
      <div className="flex items-center justify-between gap-3">
        <h2 className="label">Live audit ledger</h2>
        <span className="chip border-white/12 bg-white/[0.04] text-slate-400">
          <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-sky-400" />
          {events.length} events
        </span>
      </div>
      <p className="mt-1 text-[12px] leading-snug text-slate-500">
        Host-stamped, append-only (actor / subject / vc_id). Integrity = immutable batches + tx ref +
        TEE attestation — not an invented client-side proof.
      </p>

      <ol className="mt-4 space-y-2">
        {events.map((e, i) => (
          <li
            key={e.id}
            className="animate-sky-in rounded-xl border border-white/8 bg-white/[0.025] p-3"
            style={{ animationDelay: `${Math.min(i * 90, 900)}ms` }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="mono text-slate-200">{e.action}</span>
              <span className={`chip ${OUTCOME_STYLE[e.outcome]}`}>{e.outcome}</span>
            </div>
            {e.details ? <p className="mt-1 text-[13px] text-slate-400">{e.details}</p> : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
              <span>
                target <span className="text-slate-400">{e.target}</span>
              </span>
              {e.amountCents !== undefined ? (
                <span>
                  amount{" "}
                  <span className="text-slate-400">
                    {formatCents(e.amountCents, e.currency ?? "SGD")}
                  </span>
                </span>
              ) : null}
              {e.vcId ? <span className="mono">vc {e.vcId.slice(0, 10)}…</span> : null}
              {e.txHash ? (
                <span className="mono text-sky-300/80 underline decoration-dotted underline-offset-2">
                  tx {e.txHash.slice(0, 14)}…
                </span>
              ) : null}
              <span
                className={`ml-auto rounded-full px-2 py-px ${
                  e.committed
                    ? "bg-emerald-400/10 text-emerald-300/80"
                    : "bg-white/5 text-slate-500"
                }`}
              >
                {e.committed ? "committed" : "uncommitted"}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
