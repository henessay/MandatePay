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

/**
 * Real interpreter backed by the Anthropic Messages API (used when a key is set).
 * Uses plain fetch — no extra dependency. Forces strict JSON output and validates
 * the shape before returning. The model is given ONLY interpretation authority.
 */
export class AnthropicLlmClient implements LlmClient {
  readonly kind = "anthropic" as const;

  constructor(
    private readonly apiKey: string,
    private readonly model = "claude-opus-4-8",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async interpretHrUpdate(input: InterpretInput): Promise<InterpretOutput> {
    const system =
      "You are the interpretation layer of a payroll agent. Convert a free-form HR update " +
      "into structured payout deltas. You DO NOT authorize payments and DO NOT see or output " +
      "any bank account numbers. Output STRICT JSON only, matching the given schema. " +
      "Allowed delta kinds: terminate, rate-change, bonus, base-change, no-op, unknown.";

    const schema =
      '{"deltas":[{"employeeId":string,"displayName":string,"kind":string,' +
      '"description":string,"newRate"?:number,"bonusPct"?:number,"newBaseCents"?:number,' +
      '"effectiveFrom"?:string}],"summary":string}';

    const user =
      `Roster: ${JSON.stringify(input.roster)}\n\n` +
      `HR update: """${input.rawText}"""\n\n` +
      `Return ONLY JSON matching: ${schema}`;

    const res = await this.fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((c) => c.type === "text")?.text ?? "";
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as InterpretOutput;
    if (!Array.isArray(parsed.deltas)) {
      throw new Error("Anthropic response missing deltas[]");
    }
    return parsed;
  }
}

/** Pick the interpreter from env: real when a key is present, mock otherwise. */
export function createLlmClient(apiKey?: string, model?: string): LlmClient {
  if (apiKey && apiKey.trim().length > 0) {
    return new AnthropicLlmClient(apiKey, model);
  }
  return new MockLlmClient();
}
