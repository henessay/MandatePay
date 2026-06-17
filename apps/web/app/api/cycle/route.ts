import { NextResponse } from "next/server";
import { runDemoCycle, DEMO_HR_UPDATE_TEXT } from "@/lib/demo";

// The agent + SDK run server-side under the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let hrUpdate = DEMO_HR_UPDATE_TEXT;
  try {
    const body = (await req.json()) as { hrUpdate?: string };
    if (typeof body.hrUpdate === "string") hrUpdate = body.hrUpdate;
  } catch {
    // empty / non-JSON body — fall back to the canonical demo update
  }

  try {
    const result = await runDemoCycle(hrUpdate);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
