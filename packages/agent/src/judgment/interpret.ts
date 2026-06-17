import type { RosterEmployee, HrUpdateInterpretation } from "@mandatepay/shared";
import type { LlmClient } from "./llm.js";

/**
 * Run the HR-update interpretation step. Thin wrapper over the LLM seam that
 * produces the "here's what I understood" object the HR-intake UI renders. Marks
 * whether the real LLM or the deterministic mock produced it.
 */
export async function interpretHrUpdate(
  llm: LlmClient,
  rawText: string,
  roster: RosterEmployee[],
): Promise<HrUpdateInterpretation> {
  if (!rawText.trim()) {
    return {
      rawText,
      deltas: [],
      summary: "No HR update provided — running the standard roster unchanged.",
      fromLlm: false,
    };
  }

  const out = await llm.interpretHrUpdate({
    rawText,
    roster: roster.map((r) => ({
      employeeId: r.employeeId,
      displayName: r.displayName,
      team: r.team,
    })),
  });

  return {
    rawText,
    deltas: out.deltas,
    summary: out.summary,
    fromLlm: llm.kind === "anthropic",
  };
}
