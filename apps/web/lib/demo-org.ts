import type { OrgEmployee } from "./org-types";

/**
 * 15 generated demo recipients (names, positions, teams, monthly base, bonus
 * eligibility, and a real Ethereum address each). Used to seed a demo
 * organisation so the whole flow is one click. Addresses are freshly generated
 * keypairs (receiving needs no key); swap them for your own in the roster editor.
 */
export const DEMO_ORG_NAME = "Northwind Labs";

export const DEMO_EMPLOYEES: OrgEmployee[] = [
  { employeeId: "emp_alice_tan", displayName: "Alice Tan", position: "Account Executive", team: "sales", wallet: "0xd7e60148e2c558626364d65f46b6edceb9e7a834", baseSalaryUsd: 6200, bonusEligible: true, active: true },
  { employeeId: "emp_dinesh_kumar", displayName: "Dinesh Kumar", position: "SDR", team: "sales", wallet: "0x48c0d04e99b1f1bb7898073df3cf93724e51f13e", baseSalaryUsd: 4200, bonusEligible: true, active: true },
  { employeeId: "emp_emma_lim", displayName: "Emma Lim", position: "Sales Manager", team: "sales", wallet: "0x5d66f11c1b7ce395e85241fd2b7bb3ca3b908e73", baseSalaryUsd: 8800, bonusEligible: true, active: true },
  { employeeId: "emp_marco_rossi", displayName: "Marco Rossi", position: "Senior Engineer", team: "engineering", wallet: "0xeed9d1d061e71b2659930462316c746b62bfaf89", baseSalaryUsd: 9500, bonusEligible: true, active: true },
  { employeeId: "emp_yuki_tanaka", displayName: "Yuki Tanaka", position: "Engineer", team: "engineering", wallet: "0xe2a758f2523b255a3624d455c902b670ce6fe25d", baseSalaryUsd: 7200, bonusEligible: true, active: true },
  { employeeId: "emp_priya_nair", displayName: "Priya Nair", position: "Staff Engineer", team: "engineering", wallet: "0x05186f6864d1765723594318308564bd3ee4a8ae", baseSalaryUsd: 10500, bonusEligible: true, active: true },
  { employeeId: "emp_tomas_novak", displayName: "Tomas Novak", position: "DevOps Engineer", team: "engineering", wallet: "0xb819548370d52a7642bb0b644efdf233fac74515", baseSalaryUsd: 7800, bonusEligible: false, active: true },
  { employeeId: "emp_sofia_costa", displayName: "Sofia Costa", position: "Product Designer", team: "design", wallet: "0x408ad43bd93203eb15efa0790595f64c6b5d579e", baseSalaryUsd: 6800, bonusEligible: true, active: true },
  { employeeId: "emp_liam_obrien", displayName: "Liam OBrien", position: "Design Lead", team: "design", wallet: "0x6f17c413fbfe9294424c6ba0bebe4c1d99973233", baseSalaryUsd: 8200, bonusEligible: false, active: true },
  { employeeId: "emp_hannah_weber", displayName: "Hannah Weber", position: "Product Manager", team: "product", wallet: "0x9742d0d3d0e685c7c29b785e69355c7e66012437", baseSalaryUsd: 9000, bonusEligible: true, active: true },
  { employeeId: "emp_diego_alvarez", displayName: "Diego Alvarez", position: "Data Analyst", team: "data", wallet: "0x9d0323d430427251cb52c06569f407ca5456d473", baseSalaryUsd: 6000, bonusEligible: true, active: true },
  { employeeId: "emp_mei_chen", displayName: "Mei Chen", position: "Data Scientist", team: "data", wallet: "0x85c1211dde892140e34c09809c0508500353f1b6", baseSalaryUsd: 8600, bonusEligible: true, active: true },
  { employeeId: "emp_omar_haddad", displayName: "Omar Haddad", position: "Finance Associate", team: "finance", wallet: "0x22eb84eb6d692693034f3468aadb4e5af50c0fd9", baseSalaryUsd: 5600, bonusEligible: false, active: true },
  { employeeId: "emp_grace_mwangi", displayName: "Grace Mwangi", position: "People Ops", team: "operations", wallet: "0x437ea811abd652b8b3c9d34118de3b7c420e589b", baseSalaryUsd: 5200, bonusEligible: false, active: true },
  { employeeId: "emp_noah_schmidt", displayName: "Noah Schmidt", position: "Customer Success", team: "operations", wallet: "0x9742235954d432e2123ac413393eba2e03b21c26", baseSalaryUsd: 5400, bonusEligible: true, active: true },
];
