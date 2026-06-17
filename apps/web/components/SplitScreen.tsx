import {
  formatCents,
  ACCOUNT_PLACEHOLDER,
  type PayrollProposal,
  type DispatchReceipt,
} from "@mandatepay/shared";

export function SplitScreen({
  proposal,
  receipts,
}: {
  proposal: PayrollProposal;
  receipts: { employeeId: string; receipt: DispatchReceipt }[];
}) {
  const receiptByEmp = new Map(receipts.map((r) => [r.employeeId, r.receipt]));
  const dispatched = proposal.lines.filter((l) => l.status === "ready");

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Split-screen — what the agent saw vs. what the bank received
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        Left is the agent&apos;s real working context (no field for a real account exists). The
        substitution to a real account happens only inside the rail/TEE.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-edge bg-edge text-xs">
        <Header>🤖 Agent context (zero-PII)</Header>
        <Header>🏦 Bank dispatch (rail/TEE)</Header>

        {dispatched.map((line) => {
          const r = receiptByEmp.get(line.context.employeeId);
          return (
            <Row
              key={line.context.employeeId}
              left={
                <>
                  <Name>{line.context.displayName}</Name>
                  <KV k="amount" v={formatCents(line.context.amountCents, line.context.currency)} />
                  <KV k="destination" v={ACCOUNT_PLACEHOLDER} accent />
                  <KV k="recipientRef" v={line.context.recipientRef} />
                </>
              }
              right={
                r ? (
                  <>
                    <Name>{line.context.displayName}</Name>
                    <KV k="amount" v={formatCents(r.amountCents, r.currency)} />
                    <KV k="account" v={r.resolvedAccountMasked} accent />
                    <KV k="railRef" v={r.railRef} />
                    <KV k="status" v={r.status} />
                  </>
                ) : (
                  <span className="text-zinc-500">no receipt</span>
                )
              }
            />
          );
        })}
        {dispatched.length === 0 ? (
          <div className="col-span-2 bg-panel p-4 text-zinc-500">
            No lines dispatched this cycle.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Header({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-panel px-4 py-2 font-semibold uppercase tracking-wide text-zinc-400">
      {children}
    </div>
  );
}

function Row({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <>
      <div className="space-y-1 bg-ink/70 p-4">{left}</div>
      <div className="space-y-1 bg-ink/40 p-4">{right}</div>
    </>
  );
}

function Name({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-semibold text-zinc-100">{children}</div>;
}

function KV({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-zinc-500">{k}</span>
      <span className={`mono ${accent ? "text-amber-300" : "text-zinc-300"}`}>{v}</span>
    </div>
  );
}
