import { formatCents, type SignedMandate, type PayrollProposal } from "@mandatepay/shared";
import { DEMO_MANDATE_CONFIG } from "@/lib/types";
import type { Phase } from "@/lib/types";
import { CheckIcon, LockIcon, PenIcon, SpinnerIcon, XIcon } from "./icons";

function short(s: string, head = 10, tail = 6) {
  return s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;
}

export function MandateCard({
  phase,
  mandate,
  verified,
  proposal,
  onSign,
}: {
  phase: Phase;
  mandate: SignedMandate | null;
  verified: boolean;
  proposal: PayrollProposal | null;
  onSign: () => void;
}) {
  const cfg = DEMO_MANDATE_CONFIG;
  const signed = phase === "signed" || phase === "running" || phase === "done";
  const t = mandate?.terms;

  const ceiling = t ? t.ceilingCents : cfg.ceilingCents;
  const threshold = t ? t.individualThresholdCents : cfg.individualThresholdCents;
  const contract = t ? t.contract : cfg.contract;
  const validity = t
    ? `${new Date(t.notBeforeSecs * 1000).toLocaleDateString()} – ${new Date(
        t.notAfterSecs * 1000,
      ).toLocaleDateString()}`
    : `${cfg.windowDays} days from signing`;

  return (
    <section className="card p-5 above animate-fade-up">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="label">CFO-signed mandate</h2>
          <p className="mt-1 text-[13px] leading-snug text-slate-400">
            A leash the agent can read but never widen.
          </p>
        </div>
        <SealState phase={phase} verified={verified} hasMandate={!!mandate} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Field label="Ceiling">{formatCents(ceiling, cfg.currency)}</Field>
        <Field label="Per-line cap">{formatCents(threshold, cfg.currency)}</Field>
        <Field label="Validity window">{validity}</Field>
        <Field label="Contract">
          <span className="mono text-[13px]">{contract}</span>
        </Field>
      </div>

      <div className="mt-5">
        <div className="label mb-2">Allowlisted recipients · {cfg.recipients.length}</div>
        <div className="flex flex-wrap gap-1.5">
          {cfg.recipients.map((r) => (
            <span key={r.displayName} className="chip border-white/12 bg-white/[0.04] text-slate-300">
              {r.displayName}
              <span className="text-slate-500">· {r.team}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Real cryptographic identity — revealed once the cycle signs + verifies. */}
      {mandate && t ? (
        <dl className="mt-5 grid gap-1.5 border-t border-white/8 pt-4 text-xs">
          <Row k="signer (CFO wallet)" v={short(mandate.signerAddress, 12, 8)} />
          <Row k="credential id (vc_id)" v={short(t.vcId, 10, 6)} />
          <Row k="agent pubkey" v={short(t.agentPubkeyHex, 12, 6)} />
        </dl>
      ) : (
        <p className="mt-5 border-t border-white/8 pt-4 text-xs leading-relaxed text-slate-500">
          On sign, the credential is canonicalised (RFC-8785 JCS) and signed
          <span className="text-slate-400"> EIP-191</span>. The signature, vc_id and recovered
          signer appear here after the cycle runs.
        </p>
      )}

      {/* Ceiling meter — only meaningful once a proposal exists. */}
      {proposal ? <CeilingMeter proposal={proposal} /> : null}

      {/* Primary action: gate the run behind an explicit signing step. */}
      {phase === "idle" || phase === "error" ? (
        <button
          onClick={onSign}
          className="group mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-sky-400/40 bg-sky-500/15 px-4 py-2.5 text-sm font-semibold text-sky-100 transition hover:border-sky-300/60 hover:bg-sky-500/25"
        >
          <PenIcon className="h-4 w-4" />
          Sign mandate
        </button>
      ) : phase === "signing" ? (
        <div className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-200">
          <SpinnerIcon className="h-4 w-4" />
          Signing EIP-191…
        </div>
      ) : (
        <div className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2.5 text-sm font-semibold text-emerald-200">
          <LockIcon className="h-4 w-4" />
          Mandate sealed
        </div>
      )}
    </section>
  );
}

function SealState({
  phase,
  verified,
  hasMandate,
}: {
  phase: Phase;
  verified: boolean;
  hasMandate: boolean;
}) {
  if (phase === "idle" || phase === "error") {
    return (
      <span className="chip border-white/12 bg-white/[0.04] text-slate-400">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
        unsigned
      </span>
    );
  }
  if (phase === "signing") {
    return (
      <span className="chip border-sky-400/30 bg-sky-500/10 text-sky-200">
        <SpinnerIcon className="h-3 w-3" />
        signing
      </span>
    );
  }
  // signed / running / done
  if (hasMandate) {
    return (
      <span
        className={`chip ${
          verified
            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
            : "border-halt-500/40 bg-halt-500/10 text-halt-300"
        }`}
      >
        {verified ? <CheckIcon className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
        {verified ? "signature verified" : "invalid signature"}
      </span>
    );
  }
  return (
    <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
      <CheckIcon className="h-3.5 w-3.5" />
      signed
    </span>
  );
}

function CeilingMeter({ proposal }: { proposal: PayrollProposal }) {
  const pct = Math.min(
    100,
    Math.round((proposal.totalCents / Math.max(1, proposal.ceilingCents)) * 100),
  );
  const ok = proposal.withinCeiling;
  return (
    <div className="mt-5 border-t border-white/8 pt-4">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">
          ready{" "}
          <span className="font-semibold text-slate-200">
            {formatCents(proposal.totalCents, "SGD")}
          </span>{" "}
          / {formatCents(proposal.ceilingCents, "SGD")}
        </span>
        <span
          className={`chip ${
            ok
              ? "border-sky-400/30 bg-sky-500/10 text-sky-200"
              : "border-halt-500/40 bg-halt-500/10 text-halt-300"
          }`}
        >
          {ok ? "within ceiling" : "ceiling exceeded"}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
        <div
          className={`h-full rounded-full ${ok ? "bg-sky-400" : "bg-halt-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5">
      <div className="label">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-100">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500">{k}</dt>
      <dd className="mono text-slate-300">{v}</dd>
    </div>
  );
}
