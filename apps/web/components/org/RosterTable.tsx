"use client";

import { useState } from "react";
import { shortAddress } from "@/lib/wallet";
import type { Organisation, OrgEmployee } from "@/lib/org-types";
import { isAddress, orgMonthlyTotalUsd } from "@/lib/org-types";
import { GridIcon, XIcon, SpinnerIcon } from "@/components/icons";

const usd = (n: number) => "$" + n.toLocaleString("en-US");

export type NewEmployeeInput = {
  displayName: string;
  position: string;
  team: string;
  wallet: string;
  baseSalaryUsd: number;
  bonusEligible: boolean;
};

export function RosterTable({
  org,
  onAdd,
  onRemove,
  onSeed,
  busy,
}: {
  org: Organisation;
  onAdd: (e: NewEmployeeInput) => void;
  onRemove: (id: string) => void;
  onSeed: () => void;
  busy: boolean;
}) {
  return (
    <section className="card above animate-fade-up p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="label">Roster · {org.employees.length}</h2>
          <p className="mt-1 text-[13px] text-slate-400">
            Monthly base total{" "}
            <span className="font-semibold text-slate-200">{usd(orgMonthlyTotalUsd(org))}</span> ·
            salaries land on each wallet on-chain.
          </p>
        </div>
        {org.employees.length === 0 ? (
          <button
            onClick={onSeed}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-400/40 disabled:opacity-50"
          >
            <GridIcon className="h-4 w-4" />
            Seed 15 demo employees
          </button>
        ) : null}
      </div>

      <AddEmployeeForm onAdd={onAdd} busy={busy} />

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Position</th>
              <th className="px-3 py-2 font-medium">Wallet</th>
              <th className="px-3 py-2 text-right font-medium">Base / mo</th>
              <th className="px-3 py-2 text-center font-medium">Bonus</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {org.employees.map((e) => (
              <Row key={e.employeeId} e={e} onRemove={() => onRemove(e.employeeId)} busy={busy} />
            ))}
            {org.employees.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  No employees yet — add one above, or seed the demo org.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Row({ e, onRemove, busy }: { e: OrgEmployee; onRemove: () => void; busy: boolean }) {
  return (
    <tr className="border-t border-white/8">
      <td className="px-3 py-2.5">
        <div className="font-medium text-slate-100">{e.displayName}</div>
        <div className="text-[11px] text-slate-500">{e.team}</div>
      </td>
      <td className="px-3 py-2.5 text-slate-300">{e.position}</td>
      <td className="px-3 py-2.5">
        <span className="mono text-slate-400">{shortAddress(e.wallet)}</span>
      </td>
      <td className="px-3 py-2.5 text-right font-medium text-slate-200">{usd(e.baseSalaryUsd)}</td>
      <td className="px-3 py-2.5 text-center">
        {e.bonusEligible ? (
          <span className="chip border-sky-400/30 bg-sky-500/10 text-sky-200">eligible</span>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        <button
          onClick={onRemove}
          disabled={busy}
          title="Remove"
          className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 transition hover:bg-halt-500/10 hover:text-halt-300 disabled:opacity-50"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

function AddEmployeeForm({ onAdd, busy }: { onAdd: (e: NewEmployeeInput) => void; busy: boolean }) {
  const [f, setF] = useState<NewEmployeeInput>({
    displayName: "",
    position: "",
    team: "",
    wallet: "",
    baseSalaryUsd: 0,
    bonusEligible: true,
  });
  const walletOk = !f.wallet || isAddress(f.wallet);
  const canAdd = f.displayName.trim() && isAddress(f.wallet) && f.baseSalaryUsd > 0;

  function submit() {
    if (!canAdd) return;
    onAdd({ ...f, displayName: f.displayName.trim() });
    setF({ displayName: "", position: "", team: "", wallet: "", baseSalaryUsd: 0, bonusEligible: true });
  }

  return (
    <div className="mt-4 grid gap-2 rounded-xl border border-white/8 bg-white/[0.02] p-3 sm:grid-cols-12">
      <input
        className="input sm:col-span-3"
        placeholder="Full name"
        value={f.displayName}
        onChange={(e) => setF({ ...f, displayName: e.target.value })}
      />
      <input
        className="input sm:col-span-2"
        placeholder="Position"
        value={f.position}
        onChange={(e) => setF({ ...f, position: e.target.value })}
      />
      <input
        className="input sm:col-span-2"
        placeholder="Team"
        value={f.team}
        onChange={(e) => setF({ ...f, team: e.target.value })}
      />
      <input
        className={`input sm:col-span-3 ${walletOk ? "" : "border-halt-500/50"}`}
        placeholder="0x wallet…"
        value={f.wallet}
        onChange={(e) => setF({ ...f, wallet: e.target.value })}
      />
      <input
        className="input sm:col-span-1"
        placeholder="$/mo"
        inputMode="numeric"
        value={f.baseSalaryUsd || ""}
        onChange={(e) => setF({ ...f, baseSalaryUsd: Number(e.target.value.replace(/[^0-9]/g, "")) })}
      />
      <button
        onClick={submit}
        disabled={busy || !canAdd}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-navy-950 transition hover:bg-sky-400 disabled:opacity-40 sm:col-span-1"
      >
        {busy ? <SpinnerIcon className="h-4 w-4" /> : "Add"}
      </button>
    </div>
  );
}
