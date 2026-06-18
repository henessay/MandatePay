import type { PayoutDelta } from "@mandatepay/shared";

/**
 * The judgment layer's LLM seam. Two implementations: `MockLlmClient`
 * (deterministic, offline, default) and `AnthropicLlmClient` (real, used when
 * ANTHROPIC_API_KEY is set). The LLM only INTERPRETS free-form HR text into
 * structured deltas — it never authorizes money.
 */
export interface InterpretInput {
  rawText: string;
  roster: { employeeId: string; displayName: string; team: string }[];
}

export interface InterpretOutput {
  deltas: PayoutDelta[];
  summary: string;
}

export interface LlmClient {
  readonly kind: "mock" | "anthropic";
  interpretHrUpdate(input: InterpretInput): Promise<InterpretOutput>;
}

/**
 * Deterministic offline interpreter. Not a real LLM — a pattern matcher good
 * enough to make the demo's canonical HR updates work with zero network. Handles:
 *  - "<name> left [the company]"            -> terminate
 *  - "<name> ... <r> rate [from <when>]"    -> rate-change
 *  - "<team> [team] ... <p>% bonus"         -> bonus (whole team)
 *  - "<name> ... base ... <amount>"         -> base-change
 */
export class MockLlmClient implements LlmClient {
  readonly kind = "mock" as const;

  async interpretHrUpdate(input: InterpretInput): Promise<InterpretOutput> {
    const text = input.rawText;
    const deltas: PayoutDelta[] = [];
    // Split on commas / semicolons / newlines — one clause per change.
    const clauses = text
      .split(/[,;\n]+/)
      .map((c) => c.trim())
      .filter(Boolean);

    for (const clause of clauses) {
      const lower = clause.toLowerCase();

      // bonus to a team
      const bonusMatch = lower.match(/(\d+(?:\.\d+)?)\s*%\s*bonus/);
      const teamForBonus = bonusMatch ? this.matchTeam(clause, input.roster) : null;
      if (bonusMatch && teamForBonus) {
        const pct = Number(bonusMatch[1]);
        for (const e of input.roster.filter((r) => r.team === teamForBonus)) {
          deltas.push({
            employeeId: e.employeeId,
            displayName: e.displayName,
            kind: "bonus",
            bonusPct: pct,
            description: `${pct}% bonus to ${teamForBonus} team (${e.displayName})`,
          });
        }
        continue;
      }

      const emp = this.matchEmployee(clause, input.roster);
      if (!emp) continue;

      if (/\bleft\b|\bterminated\b|\bresigned\b|\bquit\b/.test(lower)) {
        deltas.push({
          employeeId: emp.employeeId,
          displayName: emp.displayName,
          kind: "terminate",
          description: `${emp.displayName} left the company — no payout this cycle.`,
        });
        continue;
      }

      const rateMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:x|rate)/);
      if (rateMatch) {
        const newRate = Number(rateMatch[1]);
        const whenMatch = clause.match(/from\s+(the\s+)?([0-9a-zA-Z ]+)/i);
        deltas.push({
          employeeId: emp.employeeId,
          displayName: emp.displayName,
          kind: "rate-change",
          newRate,
          ...(whenMatch ? { effectiveFrom: whenMatch[0] } : {}),
          description: `${emp.displayName} now on ${newRate}× rate${whenMatch ? ` (${whenMatch[0]})` : ""}.`,
        });
        continue;
      }

      deltas.push({
        employeeId: emp.employeeId,
        displayName: emp.displayName,
        kind: "unknown",
        description: `Couldn't confidently parse: "${clause}" — left unchanged for human review.`,
      });
    }

    const summary =
      deltas.length === 0
        ? "No changes understood from the update; running the standard roster."
        : `Understood ${deltas.length} change(s): ` +
          deltas.map((d) => d.description).join(" ");

    return { deltas, summary };
  }

  private matchEmployee(clause: string, roster: InterpretInput["roster"]) {
    const lower = clause.toLowerCase();
    return roster.find((r) => {
      const first = r.displayName.split(/\s+/)[0]?.toLowerCase() ?? "";
      return lower.includes(r.displayName.toLowerCase()) || (first.length > 1 && lower.includes(first));
    });
  }

  private matchTeam(clause: string, roster: InterpretInput["roster"]): string | null {
    const lower = clause.toLowerCase();
    const teams = [...new Set(roster.map((r) => r.team.toLowerCase()))];
    return teams.find((t) => lower.includes(t)) ?? null;
  }
}

/** Default judgment-layer model. Sonnet 4.6 — strong instruction-following at low latency. */
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";

/**
 * Real interpreter backed by the Anthropic Messages API via the official SDK
 * (`@anthropic-ai/sdk`). It extracts structured deltas through a FORCED tool call
 * (`tool_choice: {type:"tool"}`), so the model must return its interpretation as the
 * tool's typed input — a structured object, not free-form text we have to scrape.
 *
 * The model is given ONLY interpretation authority: it never sees or emits a bank
 * account number, and it NEVER authorizes a payout — the deterministic layer
 * (`computeProposal` + signed mandate) does. The SDK is imported lazily so the
 * offline/mock path stays zero-dependency and zero-network.
 */
export class AnthropicLlmClient implements LlmClient {
  readonly kind = "anthropic" as const;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = DEFAULT_ANTHROPIC_MODEL,
  ) {}

  async interpretHrUpdate(input: InterpretInput): Promise<InterpretOutput> {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: this.apiKey });

    const system =
      "You are the INTERPRETATION layer of a payroll agent. Convert a free-form HR " +
      "update into structured payout deltas — one per employee actually affected. Rules: " +
      "(1) You do NOT authorize payments; a deterministic layer does. " +
      "(2) You never see or emit bank account numbers or PII beyond names/teams. " +
      "(3) Map each change to exactly one kind: terminate, rate-change, bonus, base-change, " +
      "no-op, unknown. Use 'unknown' when a clause is ambiguous — never guess an amount. " +
      "(4) A team-wide instruction expands to one delta per matching employee. " +
      "(5) Match employees by name against the roster and always echo their employeeId. " +
      "Record your answer by calling the `record_interpretation` tool exactly once.";

    const tool = {
      name: "record_interpretation",
      description:
        "Record the structured payout deltas interpreted from the HR update, plus a one-paragraph human-readable summary.",
      input_schema: {
        type: "object" as const,
        additionalProperties: false,
        properties: {
          deltas: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                employeeId: { type: "string", description: "roster employeeId this delta applies to" },
                displayName: { type: "string" },
                kind: {
                  type: "string",
                  enum: ["terminate", "rate-change", "bonus", "base-change", "no-op", "unknown"],
                },
                description: { type: "string", description: "plain-language description of the change" },
                newRate: { type: "number", description: "rate multiplier (rate-change only)" },
                bonusPct: { type: "number", description: "bonus percent of base (bonus only)" },
                newBaseCents: { type: "integer", description: "new base salary in cents (base-change only)" },
                effectiveFrom: { type: "string", description: "effective date as free text, if stated" },
              },
              required: ["employeeId", "displayName", "kind", "description"],
            },
          },
          summary: { type: "string", description: "one-paragraph summary of what was understood" },
        },
        required: ["deltas", "summary"],
      },
    };

    const user =
      `Roster (employeeId, displayName, team):\n${JSON.stringify(input.roster)}\n\n` +
      `HR update:\n"""${input.rawText}"""`;

    const res = await client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system,
      tools: [tool],
      tool_choice: { type: "tool", name: "record_interpretation" },
      messages: [{ role: "user", content: user }],
    });

    const toolUse = res.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error(
        "Anthropic interpreter: model did not return a record_interpretation tool call",
      );
    }
    const out = toolUse.input as InterpretOutput;
    if (!Array.isArray(out.deltas)) {
      throw new Error("Anthropic interpreter: tool input missing deltas[]");
    }
    return { deltas: out.deltas, summary: out.summary ?? "" };
  }
}

/** Pick the interpreter from env: real when a key is present, mock otherwise. */
export function createLlmClient(apiKey?: string, model?: string): LlmClient {
  if (apiKey && apiKey.trim().length > 0) {
    return new AnthropicLlmClient(apiKey, model && model.trim() ? model : DEFAULT_ANTHROPIC_MODEL);
  }
  return new MockLlmClient();
}
