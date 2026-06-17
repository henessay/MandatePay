import type {
  LedgerEvent,
  SignedMandate,
  PayoutLineDecision,
  DispatchReceipt,
  AnomalyFlag,
} from "@mandatepay/shared";

/**
 * Build app-level ledger events that match the T3N SDK's host-stamped
 * `AuditEvent` shape. Offline these are emitted locally; on a live node the same
 * shape comes back from `getAuditEvents`. `actor`/`subject`/`vcId` mirror the
 * host-stamped delegation context (agent acted, on the org's behalf, under vc_id).
 */

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq}`;
}

export function mandateSignedEvent(mandate: SignedMandate): LedgerEvent {
  return {
    id: nextId("evt"),
    tsMs: mandate.signedAtMs,
    subject: mandate.terms.orgDid,
    actor: mandate.terms.userDid, // self-call: the CFO signed
    vcId: mandate.terms.vcId,
    action: "mandate.sign",
    target: "mandate",
    outcome: "success",
    details: `CFO signed a bounded mandate: ceiling ${mandate.terms.ceilingCents}¢, ${mandate.terms.functions.length} functions, window ${mandate.terms.notBeforeSecs}–${mandate.terms.notAfterSecs}.`,
    txHash: null,
    committed: true,
  };
}

export function dispatchEvent(
  mandate: SignedMandate,
  agentActorDid: string,
  line: PayoutLineDecision,
  receipt: DispatchReceipt,
): LedgerEvent {
  const ok = receipt.status === "dispatched";
  return {
    id: nextId("evt"),
    tsMs: receipt.dispatchedAtMs,
    subject: mandate.terms.orgDid,
    actor: agentActorDid, // delegated: the agent acted
    vcId: mandate.terms.vcId,
    action: "payout.dispatch",
    target: line.context.employeeId,
    outcome: ok ? "success" : "denied",
    details:
      `${line.context.displayName}: ${receipt.amountCents}¢ → ${receipt.resolvedAccountMasked} ` +
      `(agent saw ${receipt.placeholderUsed}).` +
      (receipt.reason ? ` ${receipt.reason}` : ""),
    txHash: receipt.txHash ?? null,
    committed: ok,
    amountCents: receipt.amountCents,
    currency: receipt.currency,
  };
}

export function escalationEvent(
  mandate: SignedMandate,
  agentActorDid: string,
  flag: AnomalyFlag,
): LedgerEvent {
  return {
    id: nextId("evt"),
    tsMs: Date.now(),
    subject: mandate.terms.orgDid,
    actor: agentActorDid,
    vcId: mandate.terms.vcId,
    action: "payout.halt",
    target: flag.employeeId,
    outcome: "escalated",
    details: flag.reason,
    txHash: null,
    committed: true,
    ...(flag.proposedCents !== undefined ? { amountCents: flag.proposedCents } : {}),
  };
}

export function ceilingDeniedEvent(
  mandate: SignedMandate,
  agentActorDid: string,
  readyTotalCents: number,
): LedgerEvent {
  return {
    id: nextId("evt"),
    tsMs: Date.now(),
    subject: mandate.terms.orgDid,
    actor: agentActorDid,
    vcId: mandate.terms.vcId,
    action: "cycle.deny",
    target: "mandate.ceiling",
    outcome: "denied",
    details: `Ready total ${readyTotalCents}¢ exceeds the signed ceiling ${mandate.terms.ceilingCents}¢ — the agent refused to dispatch the cycle. The mandate cannot be widened.`,
    txHash: null,
    committed: true,
  };
}
