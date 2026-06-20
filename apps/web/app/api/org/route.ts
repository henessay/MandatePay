import { NextResponse } from "next/server";
import { currentOwner } from "@/lib/session";
import { getOrg, createOrg } from "@/lib/org-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const owner = await currentOwner();
  if (!owner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ org: await getOrg(owner) });
}

export async function POST(req: Request) {
  const owner = await currentOwner();
  if (!owner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  return NextResponse.json({ org: await createOrg(owner, body.name) });
}
