import { cookies } from "next/headers";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { UserIcon } from "@/components/icons";

export default async function ProfilePage() {
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  const address = session?.address ?? "—";

  return (
    <div className="above animate-fade-up">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-500/12 text-sky-300">
          <UserIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">Profile &amp; organisation</h1>
          <p className="text-sm text-slate-400">The wallet identity behind every mandate you sign.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="label">CFO identity</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row k="Signed-in wallet" v={address} mono />
            <Row k="Role" v="CFO · mandate signer (delegator)" />
            <Row k="Auth" v="SIWE — EIP-191 wallet signature" />
          </dl>
        </section>
        <section className="card p-5">
          <h2 className="label">Organisation</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row k="Org" v="MandatePay Demo Co." />
            <Row k="Plan" v="Agent Dev Kit · sandbox" />
            <Row k="Rail" v="MockStripeRail (offline default)" />
          </dl>
          <p className="mt-4 text-[12px] leading-snug text-slate-600">
            Editable organisation profile and DID binding land alongside Settings in the next phase.
          </p>
        </section>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500">{k}</dt>
      <dd className={`text-right text-slate-200 ${mono ? "mono" : ""}`}>{v}</dd>
    </div>
  );
}
