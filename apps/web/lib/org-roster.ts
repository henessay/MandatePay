import type { RosterEmployee, Cents } from "@mandatepay/shared";
import type { OrgEmployee, Organisation } from "./org-types";

/**
 * Map an organisation employee to the agent's RosterEmployee. The recipient
 * wallet becomes `bankAccountRef` — the EVM rail uses it as the on-chain
 * destination address (a public address, not PII).
 */
export function orgEmployeeToRoster(e: OrgEmployee): RosterEmployee {
  return {
    employeeId: e.employeeId,
    displayName: e.displayName,
    team: e.team || "general",
    employmentStatus: "active",
    baseSalaryCents: Math.round(e.baseSalaryUsd * 100),
    rate: 1,
    currency: "USD",
    bankAccountRef: e.wallet,
    bankAccountChangedRecently: false,
  };
}

export function rosterFromOrg(org: Organisation): RosterEmployee[] {
  return org.employees.filter((e) => e.active).map(orgEmployeeToRoster);
}

/** Mandate ceiling = 1.5x the active base total, rounded up to the nearest $1,000. */
export function computeCeilingCents(roster: RosterEmployee[]): Cents {
  const total = roster.reduce((n, e) => n + e.baseSalaryCents, 0);
  const withHeadroom = Math.ceil((total * 1.5) / 100000) * 100000;
  return Math.max(withHeadroom, 100000);
}
