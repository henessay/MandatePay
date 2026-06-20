import { NextResponse } from "next/server";
import { issueSession, nonceIsValid, SESSION_COOKIE } from "@/lib/auth";
import { recoverEip191Address } from "@/lib/auth-crypto";
import { buildLoginMessage } from "@/lib/siwe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verify a SIWE signature and mint an httpOnly session cookie for the wallet. */
export async function POST(req: Request) {
  let body: { address?: unknown; signature?: unknown; nonce?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const { address, signature, nonce } = body;
  if (typeof address !== "string" || typeof signature !== "string" || typeof nonce !== "string") {
    return NextResponse.json({ error: "address, signature, nonce required" }, { status: 400 });
  }
  if (!nonceIsValid(nonce)) {
    return NextResponse.json({ error: "nonce expired — reconnect and retry" }, { status: 401 });
  }
  const recovered = recoverEip191Address(buildLoginMessage(address, nonce), signature);
  if (!recovered || recovered !== address.toLowerCase()) {
    return NextResponse.json({ error: "signature does not match address" }, { status: 401 });
  }

  const res = NextResponse.json({ address: recovered });
  res.cookies.set(SESSION_COOKIE, issueSession(recovered), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });
  return res;
}
