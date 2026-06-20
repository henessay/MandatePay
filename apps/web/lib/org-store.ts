import "server-only";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import {
  employeeIdFor,
  normalizeAddress,
  type Organisation,
  type OrgEmployee,
} from "./org-types";
import { DEMO_EMPLOYEES, DEMO_ORG_NAME } from "./demo-org";

/**
 * Offline-first persistence: a JSON file keyed by owner wallet. Survives between
 * sessions on a local disk (the demo runs locally). The single seam here means a
 * hosted DB (Vercel Postgres / libSQL) can replace the file driver for a deployed
 * build without touching callers. NOT localStorage — this is server-side.
 */
const DATA_DIR = process.env.MANDATEPAY_DATA_DIR || join(process.cwd(), ".data");
const FILE = join(DATA_DIR, "orgs.json");

type Db = Record<string, Organisation>;

async function readDb(): Promise<Db> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Db;
  } catch {
    return {};
  }
}

async function writeDb(db: Db): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2));
}

export async function getOrg(owner: string): Promise<Organisation | null> {
  const db = await readDb();
  return db[normalizeAddress(owner)] ?? null;
}

export async function createOrg(owner: string, name: string): Promise<Organisation> {
  const key = normalizeAddress(owner);
  const db = await readDb();
  const existing = db[key];
  const org: Organisation = existing ?? {
    id: `org_${key.slice(2, 10)}`,
    name: name.trim() || "My organisation",
    ownerWallet: key,
    createdAtMs: Date.now(),
    employees: [],
  };
  if (name.trim()) org.name = name.trim();
  db[key] = org;
  await writeDb(db);
  return org;
}

export type NewEmployee = Omit<OrgEmployee, "employeeId" | "active"> & {
  employeeId?: string;
  active?: boolean;
};

export async function addEmployee(owner: string, emp: NewEmployee): Promise<Organisation> {
  const key = normalizeAddress(owner);
  const db = await readDb();
  const org = db[key];
  if (!org) throw new Error("no organisation — create one first");
  const employee: OrgEmployee = {
    employeeId: emp.employeeId || employeeIdFor(emp.displayName),
    displayName: emp.displayName.trim(),
    position: emp.position.trim(),
    team: emp.team.trim().toLowerCase(),
    wallet: normalizeAddress(emp.wallet),
    baseSalaryUsd: Math.max(0, Math.round(emp.baseSalaryUsd)),
    bonusEligible: !!emp.bonusEligible,
    active: emp.active ?? true,
  };
  // Replace by id if present, else append.
  const i = org.employees.findIndex((e) => e.employeeId === employee.employeeId);
  if (i >= 0) org.employees[i] = employee;
  else org.employees.push(employee);
  await writeDb(db);
  return org;
}

export async function removeEmployee(owner: string, employeeId: string): Promise<Organisation> {
  const key = normalizeAddress(owner);
  const db = await readDb();
  const org = db[key];
  if (!org) throw new Error("no organisation");
  org.employees = org.employees.filter((e) => e.employeeId !== employeeId);
  await writeDb(db);
  return org;
}

export async function seedDemoEmployees(owner: string): Promise<Organisation> {
  const key = normalizeAddress(owner);
  const db = await readDb();
  const org =
    db[key] ??
    ({
      id: `org_${key.slice(2, 10)}`,
      name: DEMO_ORG_NAME,
      ownerWallet: key,
      createdAtMs: Date.now(),
      employees: [],
    } satisfies Organisation);
  if (!org.name || org.name === "My organisation") org.name = DEMO_ORG_NAME;
  // Merge demo employees by id (idempotent).
  for (const d of DEMO_EMPLOYEES) {
    const i = org.employees.findIndex((e) => e.employeeId === d.employeeId);
    if (i >= 0) org.employees[i] = { ...d };
    else org.employees.push({ ...d });
  }
  db[key] = org;
  await writeDb(db);
  return org;
}
