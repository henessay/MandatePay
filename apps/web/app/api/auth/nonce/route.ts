import { NextResponse } from "next/server";
import { issueNonce } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Issue a short-lived, stateless nonce for the SIWE login signature. */
export async function GET() {
  return NextResponse.json({ nonce: issueNonce() });
}
