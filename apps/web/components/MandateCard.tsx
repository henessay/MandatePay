import { formatCents, type SignedMandate, type AttestationStatus } from "@mandatepay/shared";
import { AttestationBadge } from "./AttestationBadge";

function short(s: string, head = 10, tail = 6) {
  return s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;
}

export function MandateCard({
  mandate,
  verified,
  attestation,
}: {
  mandate: SignedMandate;
  verified: boolean;
  attestation: AttestationStatus;
}) {
  const t = mandate.terms;
  const windowStart = new Date(t.notBeforeSecs * 1000).toLocaleDateString();
  const windowEnd = new Date(t.notAfterSecs * 1000).toLocaleDateString();

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          CFO-signed mandate
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={`chip ${
              verified
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/40 bg-rose-500/10 text-rose-300"
            }`}
          >
            {verified ? "✓ signature verified" : "✗ invalid signature"}
          </span>
          <AttestationBadge status={attestation} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Ceiling">{formatCents(t.ceilingCents, "SGD")}</Field>
        <Field label="Per-line threshold">{formatCents(t.individualThresholdCents, "SGD")}</Field>
        <Field label="Valid">
          {windowStart} – {windowEnd}
        </Field>
        <Field label="Contract">{t.contract}</Field>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {t.functions.map((f) => (
          <span key={f} className="chip border-sky-500/30 bg-sky-500/10 text-sky-300">
            {f}
          </span>
        ))}
      </div>

      <dl className="mt-4 grid gap-1 text-xs text-zinc-500">
        <Row k="signer (CFO wallet)" v={mandate.signerAddress} />
        <Row k="credential id (vc_id)" v={t.vcId} />
        <Row k="agent pubkey" v={short(t.agentPubkeyHex, 14, 8)} />
      </dl>

      <p className="mt-4 text-xs leading-relaxed text-zinc-500">
        The agent can read these bounds but{" "}
        <span className="text-zinc-300">cannot widen them</span> — the ceiling, allowlist, and
        window are sealed into this signed credential and re-checked in the TEE and on-chain.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-zinc-100">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt>{k}</dt>
      <dd className="mono text-zinc-400">{v}</dd>
    </div>
  );
}
