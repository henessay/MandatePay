import type { HrUpdateInterpretation, PayoutDelta } from "@mandatepay/shared";

const KIND_STYLE: Record<PayoutDelta["kind"], string> = {
  terminate: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  "rate-change": "border-amber-500/40 bg-amber-500/10 text-amber-300",
  bonus: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  "base-change": "border-sky-500/40 bg-sky-500/10 text-sky-300",
  "no-op": "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
  unknown: "border-zinc-500/40 bg-zinc-500/10 text-zinc-400",
};

export function HrIntake({
  value,
  onChange,
  onRun,
  loading,
  interpretation,
}: {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  loading: boolean;
  interpretation?: HrUpdateInterpretation;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Free-form HR update
        </h2>
        {interpretation ? (
          <span className="chip border-zinc-600 text-zinc-400">
            {interpretation.fromLlm ? "interpreted by Claude" : "interpreted (offline mock)"}
          </span>
        ) : null}
      </div>

      <textarea
        className="mt-3 h-24 w-full resize-none rounded-lg border border-edge bg-ink/60 p-3 text-sm text-zinc-100 outline-none focus:border-sky-600"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Ivanov left the company, Petrov is on 0.5 rate from the 15th, sales team gets a 10% bonus"
      />

      <button
        onClick={onRun}
        disabled={loading}
        className="mt-3 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
      >
        {loading ? "Running cycle…" : "Run payroll cycle ▶"}
      </button>

      {interpretation ? (
        <div className="mt-4">
          <p className="text-sm text-zinc-300">
            <span className="font-semibold text-zinc-100">Here&apos;s what I understood: </span>
            {interpretation.summary}
          </p>
          <ul className="mt-3 space-y-1.5">
            {interpretation.deltas.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={`chip mt-0.5 ${KIND_STYLE[d.kind]}`}>{d.kind}</span>
                <span className="text-zinc-300">{d.description}</span>
              </li>
            ))}
            {interpretation.deltas.length === 0 ? (
              <li className="text-sm text-zinc-500">No changes — running the standard roster.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
