"use client";

import { useCallback, useEffect, useState } from "react";
import { shortAddress } from "@/lib/wallet";
import type { Organisation } from "@/lib/org-types";
import { CreateOrg } from "@/components/org/CreateOrg";
import { RosterTable, type NewEmployeeInput } from "@/components/org/RosterTable";
import { RunPayroll } from "@/components/org/RunPayroll";
import { PayoutResults } from "@/components/org/PayoutResults";
import type { RunResult } from "@/lib/payroll-types";
import { SpinnerIcon } from "@/components/icons";

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
  const [railKind, setRailKind] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);

  useEffect(() => {
    api<{ org: Organisation | null }>("/api/org")
      .then((d) => setOrg(d.org))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
    api<{ railKind: string }>("/api/payroll/run")
      .then((d) => setRailKind(d.railKind))
      .catch(() => {});
  }, []);

  async function runPayroll(instruction: string) {
    setRunning(true);
    setError(null);
    try {
      const res = await api<RunResult>("/api/payroll/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      setRunResult(res);
      setRailKind(res.railKind);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

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
          {org.employees.some((e) => e.active) ? (
            <RunPayroll onRun={runPayroll} running={running} railKind={railKind} />
          ) : null}
          {runResult ? <PayoutResults result={runResult} /> : null}
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

