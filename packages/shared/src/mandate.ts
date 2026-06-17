import type { Cents } from "./money.js";

/**
 * App-level view of the CFO-signed, bounded mandate. Backed 1:1 by the T3N SDK's
 * `DelegationCredential` (built/signed in `packages/agent`). These are the
 * DETERMINISTIC bounds — the agent can read them but cannot widen them.
 */
export interface MandateTerms {
  /** `did:t3n:<40-hex>` org DID. */
  orgDid: string;
  /** `did:t3n:<40-hex>` CFO (delegating user) DID. */
  userDid: string;
  /** 33-byte compressed secp256k1 agent pubkey, hex. */
  agentPubkeyHex: string;
  /** Contract the credential authorises, e.g. "tee:payroll". */
  contract: string;
  /** Allowlisted function names (the agent may call only these). */
  functions: string[];
  /** Org-data scopes the contract may read on the CFO's behalf. */
  scopes: string[];
  /** Total period ceiling (batch_cap_cents). Hard cap across the whole run. */
  ceilingCents: Cents;
  /** Per-line flag threshold (individual_disbursement_threshold_cents). */
  individualThresholdCents: Cents;
  /** Inclusive validity window (unix seconds). */
  notBeforeSecs: number;
  notAfterSecs: number;
  /** 16-byte credential id, hex. */
  vcId: string;
}

/** A mandate after the CFO has signed it (EIP-191 over the canonical credential). */
export interface SignedMandate {
  terms: MandateTerms;
  /** RFC 8785 JCS bytes of the credential, base64url-no-pad. */
  credentialJcsB64u: string;
  /** 65-byte EIP-191 signature over the JCS, base64url-no-pad. */
  userSigB64u: string;
  /** Address recovered from the signature — must equal the CFO's wallet. */
  signerAddress: string;
  signedAtMs: number;
}
