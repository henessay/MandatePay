import type { AttestationStatus } from "@mandatepay/shared";
import { ShieldCheckIcon, WarnIcon } from "./icons";

type Tone = {
  ring: string;
  dot: string;
  text: string;
  label: string;
};

const TONES: Record<AttestationStatus["state"], Tone> = {
  // The brand "Valid" look — emerald glass + check. Mock keeps the green (it WOULD
  // be verified on a live node) but is explicitly labelled, never faked as real.
  verified: {
    ring: "border-emerald-400/30 bg-emerald-400/10",
    dot: "bg-emerald-400/15 text-emerald-300",
    text: "text-emerald-200",
    label: "TEE attested",
  },
  mock: {
    ring: "border-emerald-400/25 bg-emerald-400/[0.07]",
    dot: "bg-emerald-400/12 text-emerald-300",
    text: "text-emerald-200/90",
    label: "TEE attested",
  },
  unverified: {
    ring: "border-white/12 bg-white/5",
    dot: "bg-white/10 text-slate-300",
    text: "text-slate-300",
    label: "Unverified",
  },
  error: {
    ring: "border-halt-500/40 bg-halt-500/10",
    dot: "bg-halt-500/15 text-halt-300",
    text: "text-halt-300",
    label: "Attestation error",
  },
};

export function AttestationBadge({ status }: { status: AttestationStatus }) {
  const tone = TONES[status.state];
  const Glyph = status.state === "error" ? WarnIcon : ShieldCheckIcon;
  const isMock = status.state === "mock";

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 backdrop-blur-xl ${tone.ring}`}
      title={status.note ?? ""}
    >
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone.dot}`}>
        <Glyph className="h-5 w-5" />
      </span>
      <div className="leading-tight">
        <div className={`flex items-center gap-1.5 text-sm font-semibold ${tone.text}`}>
          {tone.label}
          {isMock ? (
            <span className="rounded-full border border-white/15 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-slate-300/80">
              mock
            </span>
          ) : null}
        </div>
        <div className="mono text-[11px] text-slate-400">
          {status.rtmr3 ? `RTMR3 ${status.rtmr3.slice(0, 12)}…` : "Intel TDX · remote attestation"}
        </div>
      </div>
    </div>
  );
}
