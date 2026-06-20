import { GearIcon } from "@/components/icons";
import { DEMO_MANDATE_CONFIG } from "@/lib/types";
import { formatCents } from "@mandatepay/shared";

export default function SettingsPage() {
  const c = DEMO_MANDATE_CONFIG;
  return (
    <div className="above animate-fade-up">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-500/12 text-sky-300">
          <GearIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">Settings</h1>
          <p className="text-sm text-slate-400">Mandate defaults, rail, and model.</p>
        </div>
      </div>

      <section className="card mt-6 p-5">
        <h2 className="label">Mandate defaults</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Ceiling">{formatCents(c.ceilingCents, c.currency)}</Field>
          <Field label="Per-line cap">{formatCents(c.individualThresholdCents, c.currency)}</Field>
          <Field label="Validity window">{c.windowDays} days</Field>
          <Field label="Contract">{c.contract}</Field>
        </div>
        <p className="mt-4 text-[12px] leading-snug text-slate-600">
          Editing these (and the recipient allowlist / roster) becomes live in the next phase; today
          they reflect the signed demo mandate.
        </p>
      </section>
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
