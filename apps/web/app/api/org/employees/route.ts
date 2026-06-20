import { NextResponse } from "next/server";
import { currentOwner } from "@/lib/session";
import { addEmployee, removeEmployee } from "@/lib/org-store";
import { isAddress } from "@/lib/org-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const owner = await currentOwner();
  if (!owner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const displayName = typeof b.displayName === "string" ? b.displayName.trim() : "";
  const wallet = typeof b.wallet === "string" ? b.wallet.trim() : "";
  const position = typeof b.position === "string" ? b.position.trim() : "";
  const team = typeof b.team === "string" ? b.team.trim() : "general";
  const baseSalaryUsd = Number(b.baseSalaryUsd);
  const bonusEligible = !!b.bonusEligible;

  if (!displayName) return NextResponse.json({ error: "displayName required" }, { status: 400 });
  if (!isAddress(wallet)) return NextResponse.json({ error: "valid 0x wallet required" }, { status: 400 });
  if (!Number.isFinite(baseSalaryUsd) || baseSalaryUsd < 0) {
    return NextResponse.json({ error: "baseSalaryUsd must be a non-negative number" }, { status: 400 });
  }

  try {
    const org = await addEmployee(owner, {
      displayName,
      wallet,
      position: position || "Staff",
      team: team || "general",
      baseSalaryUsd,
      bonusEligible,
    });
    return NextResponse.json({ org });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const owner = await currentOwner();
  if (!owner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    return NextResponse.json({ org: await removeEmployee(owner, id) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
