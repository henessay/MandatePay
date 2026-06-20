"use client";

import { useState } from "react";
import { ArrowRightIcon, GridIcon, SpinnerIcon } from "@/components/icons";

export function CreateOrg({
  onCreate,
  onSeed,
  busy,
}: {
  onCreate: (name: string) => void;
  onSeed: () => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  return (
    <section className="card glass-sky above mx-auto mt-6 max-w-xl animate-fade-up p-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-white">
        Create your organisation
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        Name your company, then add employees and their wallets. You — the{" "}
        <span className="text-slate-200">connected wallet</span> — own it and sign every payroll
        mandate the agent runs under.
      </p>

      <label className="label mt-6 block">Organisation name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Northwind Labs"
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/15"
        onKeyDown={(e) => e.key === "Enter" && name.trim() && !busy && onCreate(name.trim())}
      />

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={() => name.trim() && onCreate(name.trim())}
          disabled={busy || !name.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-navy-950 shadow-[0_8px_24px_-8px_rgba(56,189,248,0.6)] transition hover:bg-sky-400 disabled:opacity-50"
        >
          {busy ? <SpinnerIcon className="h-4 w-4" /> : <ArrowRightIcon className="h-4 w-4" />}
          Create organisation
        </button>
        <button
          onClick={onSeed}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-sky-400/40 disabled:opacity-50"
        >
          <GridIcon className="h-4 w-4" />
          Use a demo org (15 employees)
        </button>
      </div>
    </section>
  );
}
