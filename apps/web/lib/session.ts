import "server-only";
import { cookies } from "next/headers";
import { readSession, SESSION_COOKIE } from "./auth";

/** The signed-in owner wallet (lowercase 0x) for the current request, or null. */
export async function currentOwner(): Promise<string | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return readSession(value)?.address ?? null;
}
