import {
  formatCents,
  ACCOUNT_PLACEHOLDER,
  type PayrollProposal,
  type PayoutLineDecision,
  type DispatchReceipt,
} from "@mandatepay/shared";
import { BankIcon, EyeIcon, WarnIcon } from "./icons";

export function SplitScreen({
  proposal,
  receipts,
}: {
  proposal: PayrollProposal;
  receipts: { employeeId: string; receipt: DispatchReceipt }[];
}) {
  const receiptByEmp = new Map(receipts.map((r) => [r.employeeId, r.receipt]));
  const ready = proposal.lines.filter((l) => l.status === "ready");
  const halted = proposal.lines.filter((l) => l.status === "halted-escalated");

  return (
    <section className="card glass-sky p-5 above animate-fade-up">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="label text-sky-200/80">The zero-PII boundary, made visible</h2>
          <p className="mt-1 text-[13px] leading-snug text-slate-400">
            Left is the agent&apos;s real working object — it has{" "}
            <span className="text-slate-200">no field for an account number</span>. The real account
            is resolved only inside the rail/TEE.
          </p>
        </div>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        {/* column headers */}
        <div className="grid grid-cols-2">
          <ColHead tone="agent">
            <EyeIcon className="h-4 w-4" />
            What the agent saw
          </ColHead>
          <ColHead tone="bank">
            <BankIcon className="h-4 w-4" />
            What the bank received
          </ColHead>
        </div>

        {ready.map((line) => (
          <ReadyRow
            key={line.context.employeeId}
            line={line}
            receipt={receiptByEmp.get(line.context.employeeId)}
          />
        ))}

        {halted.map((line) => (
          <HaltedRow key={line.context.employeeId} line={line} />
        ))}

        {ready.length === 0 && halted.length === 0 ? (
          <div className="border-t border-white/8 p-5 text-sm text-slate-500">
            No payout lines this cycle.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ColHead({ children, tone }: { children: React.ReactNode; tone: "agent" | "bank" }) {
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider ${
        tone === "bank"
          ? "border-l border-sky-400/20 bg-sky-500/[0.04] text-sky-200/90"
          : "bg-white/[0.015] text-slate-300"
      }`}
    >
      {children}
    </div>
  );
}

function ReadyRow({
  line,
  receipt,
}: {
  line: PayoutLineDecision;
  receipt: DispatchReceipt | undefined;
}) {
  const c = line.context;
  return (
    <div className="grid grid-cols-2 border-t border-white/8">
      {/* agent side */}
      <div className="space-y-2 p-4">
        <Name>{c.displayName}</Name>
        <KV k="amount" v={formatCents(c.amountCents, c.currency)} />
        <KV k="destination" v={ACCOUNT_PLACEHOLDER} variant="ghost" />
        <KV k="recipientRef" v={c.recipientRef} />
      </div>
      {/* bank side */}
      <div className="space-y-2 border-l border-sky-400/15 bg-sky-500/[0.03] p-4">
        {receipt ? (
          <>
            <Name>{c.displayName}</Name>
            <KV k="amount" v={formatCents(receipt.amountCents, receipt.currency)} />
            <KV k="account" v={receipt.resolvedAccountMasked} variant="resolved" />
            <KV k="railRef" v={receipt.railRef} />
            <div className="flex justify-between gap-3 pt-0.5">
              <span className="text-xs text-slate-500">status</span>
              <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
                {receipt.status}
              </span>
            </div>
          </>
        ) : (
          <span className="text-sm text-slate-500">no receipt</span>
        )}
      </div>
    </div>
  );
}

function HaltedRow({ line }: { line: PayoutLineDecision }) {
  const c = line.context;
  const reason = line.anomaly?.reason ?? "Anomaly — held for human review.";
  return (
    <div className="flex items-start gap-3 border-t border-halt-500/25 bg-halt-500/[0.07] p-4 animate-sky-in">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-halt-500/15 text-halt-300">
        <WarnIcon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-100">{c.displayName}</span>
          <span className="chip border-halt-500/40 bg-halt-500/10 text-halt-300">
            halted{line.anomaly?.accountChanged ? " · account changed" : ""}
          </span>
          <span className="text-xs text-slate-400">escalated to a human — not dispatched</span>
        </div>
        <p className="mt-1.5 text-[13px] leading-snug text-slate-300">{reason}</p>
      </div>
    </div>
  );
}

function Name({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-semibold text-slate-100">{children}</div>;
}

function KV({
  k,
  v,
  variant,
}: {
  k: string;
  v: string;
  variant?: "ghost" | "resolved";
}) {
  const valueClass =
    variant === "ghost"
      ? "rounded border border-dashed border-sky-300/35 px-1.5 py-px text-sky-200/70"
      : variant === "resolved"
        ? "font-semibold text-sky-200"
        : "text-slate-300";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-500">{k}</span>
      <span className={`mono ${valueClass}`}>{v}</span>
    </div>
  );
}
