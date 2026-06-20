import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";

/**
 * Gated business shell. The session cookie is the source of truth: no valid
 * wallet session → bounced to the landing. Everything under /app renders here.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/");

  return (
    <div className="above min-h-screen lg:grid lg:grid-cols-[244px_1fr]">
      <Sidebar />
      <div className="flex min-h-screen flex-col">
        <TopBar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-6">{children}</main>
      </div>
    </div>
  );
}
