import type { AttestationStatus } from "@mandatepay/shared";

const STYLES: Record<AttestationStatus["state"], string> = {
  verified: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
  mock: "border-amber-500/40 text-amber-300 bg-amber-500/10",
  unverified: "border-zinc-500/40 text-zinc-300 bg-zinc-500/10",
  error: "border-rose-500/40 text-rose-300 bg-rose-500/10",
};

const LABEL: Record<AttestationStatus["state"], string> = {
  verified: "TEE attested",
  mock: "TEE attestation (mock)",
  unverified: "Unverified",
  error: "Attestation error",
};

export function AttestationBadge({ status }: { status: AttestationStatus }) {
  return (
    <span className={`chip ${STYLES[status.state]}`} title={status.note ?? ""}>
      <span aria-hidden>{status.state === "verified" ? "🛡️" : "🧪"}</span>
      {LABEL[status.state]}
      {status.rtmr3 ? <span className="mono opacity-70">· {status.rtmr3.slice(0, 10)}…</span> : null}
    </span>
  );
}
