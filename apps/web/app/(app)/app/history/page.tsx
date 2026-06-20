import { ClockIcon } from "@/components/icons";

export default function HistoryPage() {
  return (
    <div className="above animate-fade-up">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-500/12 text-sky-300">
          <ClockIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">Payment history</h1>
          <p className="text-sm text-slate-400">Every payroll cycle this wallet has run, with receipts and ledger.</p>
        </div>
      </div>

      <div className="card mt-6 p-8 text-center">
        <p className="text-sm text-slate-400">
          No cycles yet. Run a payroll cycle on the{" "}
          <span className="text-sky-300">Dashboard</span> — each run is recorded here with its
          mandate, dispatched lines, halted anomalies, and tx references.
        </p>
        <p className="mt-2 text-[12px] text-slate-600">
          Persistent history lands in the next build phase (server-side LedgerStore).
        </p>
      </div>
    </div>
  );
}
