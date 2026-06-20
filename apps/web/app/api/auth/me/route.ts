import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Report the currently signed-in wallet (or null) from the session cookie. */
export async function GET() {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = readSession(value);
  return NextResponse.json({ address: session?.address ?? null });
}
