"use client";

import { formatCents } from "@mandatepay/shared";
import { shortAddress } from "@/lib/wallet";
import type { RunResult, PayoutRow } from "@/lib/payroll-types";
import { LedgerView, Escalations } from "@/components/LedgerView";
import { CheckIcon, XIcon, WarnIcon } from "@/components/icons";

const STATUS: Record<string, string> = {
  dispatched: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  rejected: "border-halt-500/40 bg-halt-500/10 text-halt-300",
  "halted-escalated": "border-amber-400/30 bg-amber-400/10 text-amber-200",
  pending: "border-sky-400/30 bg-sky-500/10 text-sky-200",
};

function addressBase(explorerTxBase: string): string {
  return explorerTxBase.replace(/\/tx\/?$/, "/address/");
}

export function PayoutResults({ result }: { result: RunResult }) {
  const dispatched = result.rows.filter((r) => r.status === "dispatched").length;
  const addrBase = addressBase(result.explorerTxBase);

  return (
    <div className="space-y-5">
      <section className="card glass-sky above animate-fade-up p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="label text-sky-200/80">Payroll dispatched</h2>
            <p className="mt-1 text-[13px] text-slate-400">
              {dispatched} of {result.rows.length} paid ·{" "}
              <span className="font-semibold text-slate-200">
                {formatCents(result.totalCents, "USD")}
              </span>{" "}
              of {formatCents(result.ceilingCents, "USD")} ceiling
            </p>
          </div>
          <span
            className={`chip ${
              result.withinCeiling
                ? "border-sky-400/30 bg-sky-500/10 text-sky-200"
                : "border-halt-500/40 bg-halt-500/10 text-halt-300"
            }`}
          >
            {result.withinCeiling ? "within ceiling" : "ceiling exceeded — refused"}
          </span>
        </div>

        {result.treasury ? (
          <p className="mt-3 text-[12px] text-slate-500">
            treasury{" "}
            <a
              href={`${addrBase}${result.treasury}`}
              target="_blank"
              rel="noreferrer"
              className="mono text-sky-300/80 underline decoration-dotted underline-offset-2"
            >
              {shortAddress(result.treasury)}
            </a>{" "}
            · the agent dispatched these from here on Sepolia.
          </p>
        ) : null}

        <p className="mt-3 text-[13px] leading-snug text-slate-300">
          <span className="font-semibold text-slate-100">Agent read: </span>
          {result.interpretation.summary}
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">Employee</th>
                <th className="px-3 py-2 font-medium">Wallet</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Transaction</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <Row key={r.employeeId} r={r} addrBase={addrBase} txBase={result.explorerTxBase} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Escalations flags={result.escalations} />
      <LedgerView events={result.ledger} />
    </div>
  );
}

function Row({ r, addrBase, txBase }: { r: PayoutRow; addrBase: string; txBase: string }) {
  const Icon = r.status === "dispatched" ? CheckIcon : r.status === "rejected" ? XIcon : WarnIcon;
  return (
    <tr className="border-t border-white/8">
      <td className="px-3 py-2.5">
        <div className="font-medium text-slate-100">{r.displayName}</div>
        <div className="text-[11px] text-slate-500">{r.team}</div>
      </td>
      <td className="px-3 py-2.5">
        <a
          href={`${addrBase}${r.wallet}`}
          target="_blank"
          rel="noreferrer"
          className="mono text-slate-400 underline decoration-dotted underline-offset-2 hover:text-sky-200"
        >
          {shortAddress(r.wallet)}
        </a>
      </td>
      <td className="px-3 py-2.5 text-right font-medium text-slate-200">
        {formatCents(r.amountCents, "USD")}
      </td>
      <td className="px-3 py-2.5">
        <span className={`chip ${STATUS[r.status] ?? STATUS.pending}`}>
          <Icon className="h-3.5 w-3.5" />
          {r.status}
        </span>
      </td>
      <td className="px-3 py-2.5">
        {r.txHash && !r.txHash.startsWith("0xmock") ? (
          <a
            href={`${txBase}${r.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="mono text-sky-300/80 underline decoration-dotted underline-offset-2"
          >
            {r.txHash.slice(0, 12)}…
          </a>
        ) : r.txHash ? (
          <span className="mono text-slate-600">{r.txHash.slice(0, 10)}… (mock)</span>
        ) : r.reason ? (
          <span className="text-[12px] text-slate-500">{r.reason}</span>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
    </tr>
  );
}
