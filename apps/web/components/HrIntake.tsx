import type { HrUpdateInterpretation, PayoutDelta } from "@mandatepay/shared";
import { DEFAULT_HR_UPDATE, DEMO_HR_UPDATE_RU } from "@/lib/types";
import { ArrowRightIcon, LockIcon, SpinnerIcon } from "./icons";

const KIND_STYLE: Record<PayoutDelta["kind"], string> = {
  terminate: "border-halt-500/40 bg-halt-500/10 text-halt-300",
  "rate-change": "border-amber-400/30 bg-amber-400/10 text-amber-200",
  bonus: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  "base-change": "border-sky-400/30 bg-sky-500/10 text-sky-200",
  "no-op": "border-white/12 bg-white/5 text-slate-300",
  unknown: "border-white/12 bg-white/5 text-slate-400",
};

export function HrIntake({
  value,
  onChange,
  onRun,
  loading,
  canRun,
  interpretation,
}: {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  loading: boolean;
  canRun: boolean;
  interpretation?: HrUpdateInterpretation;
}) {
  return (
    <section className="card p-5 above animate-fade-up">
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        {/* input side */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="label">Free-form HR update</h2>
              <p className="mt-1 text-[13px] leading-snug text-slate-400">
                Plain language — any language. The agent (Claude) reasons over it into a reviewable
                diff. It proposes; it never authorises a cent.
              </p>
            </div>
            {interpretation ? (
              <span className="chip border-sky-400/30 bg-sky-500/10 text-sky-200">
                {interpretation.fromLlm ? "interpreted by Claude" : "interpreted · offline mock"}
              </span>
            ) : null}
          </div>

          <textarea
            className="mt-3 h-28 w-full resize-none rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/15"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. Boris left the company; Carol is on 0.5 rate from the 15th; sales team gets a 10% bonus"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-slate-500">examples</span>
            <button
              onClick={() => onChange(DEFAULT_HR_UPDATE)}
              className="chip border-white/12 bg-white/[0.04] text-slate-300 transition hover:border-sky-400/40 hover:text-sky-200"
            >
              EN
            </button>
            <button
              onClick={() => onChange(DEMO_HR_UPDATE_RU)}
              className="chip border-white/12 bg-white/[0.04] text-slate-300 transition hover:border-sky-400/40 hover:text-sky-200"
            >
              RU · премия sales
            </button>

            <button
              onClick={onRun}
              disabled={loading || !canRun}
              title={!canRun ? "Sign the mandate first" : undefined}
              className="ml-auto flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-navy-950 shadow-[0_8px_24px_-8px_rgba(56,189,248,0.6)] transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500 disabled:shadow-none"
            >
              {loading ? (
                <>
                  <SpinnerIcon className="h-4 w-4" />
                  Running cycle…
                </>
              ) : !canRun ? (
                <>
                  <LockIcon className="h-4 w-4" />
                  Sign mandate first
                </>
              ) : (
                <>
                  Run payroll cycle
                  <ArrowRightIcon className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* interpretation side */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="label">Agent&apos;s reviewable diff</div>
          {interpretation ? (
            <>
              <p className="mt-2 text-[13px] leading-snug text-slate-300">
                {interpretation.summary}
              </p>
              <ul className="mt-3 space-y-1.5">
                {interpretation.deltas.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px]">
                    <span className={`chip mt-px shrink-0 ${KIND_STYLE[d.kind]}`}>{d.kind}</span>
                    <span className="text-slate-300">{d.description}</span>
                  </li>
                ))}
                {interpretation.deltas.length === 0 ? (
                  <li className="text-[13px] text-slate-500">
                    No changes — running the standard roster.
                  </li>
                ) : null}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-[13px] leading-snug text-slate-500">
              Run the cycle to see how the agent parses the update — termination, rate change, and a
              team-wide bonus fanned out per employee.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
