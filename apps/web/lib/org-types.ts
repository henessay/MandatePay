/**
 * Organisation + roster model (client-safe — no server imports). An org is owned
 * by a wallet (the connected CFO) and holds employees, each paid to a real wallet
 * address. Persisted server-side (see org-store.ts).
 */
export interface OrgEmployee {
  employeeId: string;
  displayName: string;
  position: string;
  team: string;
  /** Recipient wallet (0x) — where salary lands on-chain. */
  wallet: string;
  /** Monthly gross base, whole USD (display unit; scaled to token at dispatch). */
  baseSalaryUsd: number;
  /** Whether the agent may award this person a performance bonus. */
  bonusEligible: boolean;
  active: boolean;
}

export interface Organisation {
  id: string;
  name: string;
  /** Lowercase 0x of the owner (signed-in wallet). */
  ownerWallet: string;
  createdAtMs: number;
  employees: OrgEmployee[];
}

export function isAddress(s: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(s.trim());
}

export function normalizeAddress(s: string): string {
  return s.trim().toLowerCase();
}

export function employeeIdFor(displayName: string): string {
  const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `emp_${slug || Math.random().toString(36).slice(2, 8)}`;
}

/** Sum of active base salaries (USD). */
export function orgMonthlyTotalUsd(org: Organisation): number {
  return org.employees.filter((e) => e.active).reduce((n, e) => n + e.baseSalaryUsd, 0);
}
