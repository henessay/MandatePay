import { describe, it, expect } from "vitest";
import { createLlmClient } from "./llm.js";
import { runPayrollCycle } from "../runCycle.js";
import { createRail } from "../rails/index.js";
import {
  DEMO_EMPLOYEES,
  DEMO_BASELINES,
  DEMO_AGENT_DID,
  DEMO_HR_UPDATE,
  buildDemoMandate,
} from "../fixtures.js";

/**
 * LIVE demo of the real Anthropic interpreter (claude-sonnet-4-6) — strictly
 * advisory: the LLM proposes deltas, the deterministic layer (mandate ceiling +
 * compute + anomaly halt) authorizes. SKIPPED offline (no key) so the suite stays
 * green with zero network; runs only when ANTHROPIC_API_KEY is set.
 *
 *   set -a; . ./.env; set +a
 *   pnpm --filter @mandatepay/agent exec vitest run src/judgment/interpret.live.test.ts
 */
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL; // defaults to claude-sonnet-4-6 in code

// Two free-form HR updates — same semantics, different languages — to show the
// LLM genuinely interprets (the regex mock cannot parse the Russian one).
const RUNS: { label: string; update: string }[] = [
  { label: "EN (canonical)", update: DEMO_HR_UPDATE },
  {
    label: "RU (free-form)",
    update:
      "Борис Иванов уволился; Кэрол Петрова с 15-го числа переходит на 0.5 ставки; отделу sales — премия 10%",
  },
];

describe.skipIf(!KEY)("AnthropicLlmClient — live judgment (advisory)", () => {
  for (const { label, update } of RUNS) {
    it(
      `interprets and the deterministic layer authorizes — ${label}`,
      async () => {
        const llm = createLlmClient(KEY, MODEL);
        expect(llm.kind).toBe("anthropic");

        const { mandate } = buildDemoMandate();
        const rail = createRail("mock");

        const result = await runPayrollCycle({
          cycleId: `live-${Date.now().toString(36)}`,
          rawHrUpdate: update,
          roster: DEMO_EMPLOYEES,
          mandate,
          rail,
          llm,
          agentActorDid: DEMO_AGENT_DID,
          baselines: DEMO_BASELINES,
        });

        const p = result.proposal;
        console.log(`\n===== RUN: ${label} =====`);
        console.log("input        :", update);
        console.log("fromLlm      :", p.interpretation.fromLlm, "(model:", MODEL ?? "claude-sonnet-4-6) ");
        console.log("summary      :", p.interpretation.summary);
        console.log("deltas       :");
        for (const d of p.interpretation.deltas) {
          console.log(
            `  - ${d.displayName} [${d.kind}]` +
              (d.newRate !== undefined ? ` rate=${d.newRate}` : "") +
              (d.bonusPct !== undefined ? ` bonus=${d.bonusPct}%` : "") +
              `: ${d.description}`,
          );
        }
        console.log("--- deterministic layer (authorizes) ---");
        console.log("withinCeiling:", p.withinCeiling, `(ceiling ${p.ceilingCents}c, ready total ${p.totalCents}c)`);
        console.log(
          "lines        :",
          p.lines.map((l) => `${l.context.displayName}:${l.status}`).join(", "),
        );
        console.log("escalations  :", p.escalations.map((e) => `${e.displayName} (${e.reason})`).join(" | ") || "none");
        console.log("dispatched   :", result.dispatched, `(${result.receipts.length} receipts)`);

        // Lenient assertions — the value is the observable 2-run behavior, not an
        // exact LLM transcript. These hold regardless of phrasing/language.
        expect(p.interpretation.fromLlm).toBe(true);
        expect(Array.isArray(p.interpretation.deltas)).toBe(true);
        expect(p.interpretation.deltas.length).toBeGreaterThan(0);
        expect(p.lines.length).toBeGreaterThan(0);
        // Emma's account changed recently → deterministic halt, independent of the LLM.
        expect(p.escalations.some((e) => e.displayName === "Emma Lim")).toBe(true);
      },
      60_000,
    );
  }
});
