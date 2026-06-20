"use client";

import { useCallback, useEffect, useState } from "react";
import { shortAddress } from "@/lib/wallet";
import type { Organisation } from "@/lib/org-types";
import { CreateOrg } from "@/components/org/CreateOrg";
import { RosterTable, type NewEmployeeInput } from "@/components/org/RosterTable";
import { SpinnerIcon, LockIcon, ArrowRightIcon } from "@/components/icons";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
  return json as T;
}

export default function AppHome() {
  const [org, setOrg] = useState<Organisation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ org: Organisation | null }>("/api/org")
      .then((d) => setOrg(d.org))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const mutate = useCallback(async (p: Promise<{ org: Organisation }>) => {
    setBusy(true);
    setError(null);
    try {
      const { org } = await p;
      setOrg(org);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const createOrg = (name: string) =>
    mutate(
      api("/api/org", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    );
  const seedOrg = () => mutate(api("/api/org/seed", { method: "POST" }));
  const addEmployee = (e: NewEmployeeInput) =>
    mutate(
      api("/api/org/employees", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(e),
      }),
    );
  const removeEmployee = (id: string) =>
    mutate(api(`/api/org/employees?id=${encodeURIComponent(id)}`, { method: "DELETE" }));

  if (loading) {
    return (
      <div className="above flex items-center gap-2 py-20 text-slate-400">
        <SpinnerIcon className="h-5 w-5" /> Loading your organisation…
      </div>
    );
  }

  return (
    <div className="above space-y-5">
      {error ? (
        <div className="card border-halt-500/40 p-4 text-sm text-halt-300">{error}</div>
      ) : null}

      {!org ? (
        <CreateOrg onCreate={createOrg} onSeed={seedOrg} busy={busy} />
      ) : (
        <>
          <OrgHeader org={org} />
          <RosterTable
            org={org}
            onAdd={addEmployee}
            onRemove={removeEmployee}
            onSeed={seedOrg}
            busy={busy}
          />
          <RunPayrollPanel ready={org.employees.length > 0} />
        </>
      )}
    </div>
  );
}

function OrgHeader({ org }: { org: Organisation }) {
  return (
    <section className="card above animate-fade-up p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">{org.name}</h1>
          <p className="mt-1 text-[13px] text-slate-400">
            Owner <span className="mono text-slate-300">{shortAddress(org.ownerWallet)}</span> ·
            created {new Date(org.createdAtMs).toLocaleDateString()}
          </p>
        </div>
        <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
          {org.employees.length} on payroll
        </span>
      </div>
    </section>
  );
}

function RunPayrollPanel({ ready }: { ready: boolean }) {
  return (
    <section className="card glass-sky above animate-fade-up p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="label text-sky-200/80">Run payroll</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-snug text-slate-400">
            Sign one bounded mandate with your wallet, tell the agent what to pay (e.g. &ldquo;run
            this month&rsquo;s salaries, +10% bonus to sales&rdquo;), and it dispatches real
            transfers to each employee&rsquo;s wallet — within the ceiling, on-chain, every move on
            the ledger.
          </p>
        </div>
        <button
          disabled
          title="Wired in the next build phase"
          className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-500"
        >
          <LockIcon className="h-4 w-4" />
          {ready ? "Sign mandate & run" : "Add employees first"}
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-3 text-[11px] text-slate-600">
        On-chain disbursement (EVM rail) + wallet mandate signing land in the next phase.
      </p>
    </section>
  );
}
