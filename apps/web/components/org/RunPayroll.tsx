"use client";

import { useState } from "react";
import { ArrowRightIcon, SpinnerIcon } from "@/components/icons";

const EN = "Pay this month's salaries; give the sales team a 10% bonus.";
const RU = "Выплати зарплаты за месяц; команде sales — премия 10%.";

export function RunPayroll({
  onRun,
  running,
  railKind,
}: {
  onRun: (instruction: string) => void;
  running: boolean;
  railKind: string | null;
}) {
  const [v, setV] = useState(EN);
  const live = railKind === "evm";
  return (
    <section className="card glass-sky above animate-fade-up p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="label text-sky-200/80">Run payroll</h2>
        <span
          className={`chip ${
            live
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
              : "border-white/12 bg-white/[0.04] text-slate-400"
          }`}
        >
          {live ? "EVM · Sepolia (real transfers)" : "mock rail (offline)"}
        </span>
      </div>
      <p className="mt-1 text-[13px] leading-snug text-slate-400">
        Tell the agent what to pay — any language. It proposes; the signed mandate authorizes within
        the ceiling; it dispatches real mUSD to each employee&rsquo;s wallet.
      </p>

      <textarea
        className="mt-3 h-20 w-full resize-none rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/15"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="e.g. Pay this month's salaries; +10% bonus to sales"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-slate-500">examples</span>
        <button
          onClick={() => setV(EN)}
          className="chip border-white/12 bg-white/[0.04] text-slate-300 transition hover:border-sky-400/40 hover:text-sky-200"
        >
          EN
        </button>
        <button
          onClick={() => setV(RU)}
          className="chip border-white/12 bg-white/[0.04] text-slate-300 transition hover:border-sky-400/40 hover:text-sky-200"
        >
          RU · премия sales
        </button>
        <button
          onClick={() => onRun(v)}
          disabled={running || !v.trim()}
          className="ml-auto flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-navy-950 shadow-[0_8px_24px_-8px_rgba(56,189,248,0.6)] transition hover:bg-sky-400 disabled:opacity-50"
        >
          {running ? (
            <>
              <SpinnerIcon className="h-4 w-4" />
              Dispatching…
            </>
          ) : (
            <>
              Run payroll
              <ArrowRightIcon className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </section>
  );
}
