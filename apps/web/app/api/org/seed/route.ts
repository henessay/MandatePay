import { NextResponse } from "next/server";
import { currentOwner } from "@/lib/session";
import { seedDemoEmployees } from "@/lib/org-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Seed the org with the 15 generated demo employees (idempotent). */
export async function POST() {
  const owner = await currentOwner();
  if (!owner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ org: await seedDemoEmployees(owner) });
}
