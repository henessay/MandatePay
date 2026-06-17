import {
  buildDelegationCredential,
  canonicaliseCredential,
  signCredential,
  ethRecoverEip191,
  b64uEncodeBytes,
  b64uDecodeStrict,
} from "@terminal3/t3n-sdk";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { MandateTerms, SignedMandate } from "@mandatepay/shared";

const DEFAULT_CONTRACT = "tee:payroll";
const DEFAULT_SCOPES = ["payroll/employees"];

export interface SignMandateArgs {
  /** `did:t3n:<40-hex>` org DID. */
  orgDid: string;
  /** `did:t3n:<40-hex>` CFO DID. */
  userDid: string;
  /** CFO's 32-byte EOA secret. Signs the credential (EIP-191). Offline-only; TEE-custodial in prod. */
  cfoSecret: Uint8Array;
  /** 33-byte compressed secp256k1 agent pubkey. */
  agentPubkeyCompressed: Uint8Array;
  /** Allowlisted function names. */
  functions: string[];
  ceilingCents: number;
  individualThresholdCents: number;
  notBeforeSecs: number;
  notAfterSecs: number;
  contract?: string;
  scopes?: string[];
  /** 16-byte credential id; generated if absent. */
  vcId?: Uint8Array;
}

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/** Sorted + deduped, as `buildDelegationCredential` requires. */
function normalizeFunctions(fns: string[]): string[] {
  return [...new Set(fns.map((f) => f.toLowerCase()))].sort();
}

/**
 * The "CFO signs a bounded mandate" flow, fully client-side/offline:
 * build credential → RFC 8785 JCS canonicalize → EIP-191 sign → package as a
 * `SignedMandate`. The recovered signer is asserted to equal the CFO wallet.
 */
export function signMandate(args: SignMandateArgs): SignedMandate {
  const vcId = args.vcId ?? randomBytes(16);
  const functions = normalizeFunctions(args.functions);
  const contract = args.contract ?? DEFAULT_CONTRACT;
  const scopes = args.scopes ?? DEFAULT_SCOPES;

  const credential = buildDelegationCredential({
    user_did: args.userDid,
    agent_pubkey: args.agentPubkeyCompressed,
    org_did: args.orgDid,
    contract,
    functions,
    scopes,
    metadata: {
      // App-level bounds carried as credential metadata (checked against the org grant).
      ceiling_cents: String(args.ceilingCents),
      individual_threshold_cents: String(args.individualThresholdCents),
    },
    not_before_secs: BigInt(args.notBeforeSecs),
    not_after_secs: BigInt(args.notAfterSecs),
    vc_id: vcId,
  });

  const jcs = canonicaliseCredential(credential);
  const { sig, addr } = signCredential(jcs, args.cfoSecret);
  const signerAddress = "0x" + bytesToHex(addr);

  const terms: MandateTerms = {
    orgDid: args.orgDid,
    userDid: args.userDid,
    agentPubkeyHex: bytesToHex(args.agentPubkeyCompressed),
    contract,
    functions,
    scopes,
    ceilingCents: args.ceilingCents,
    individualThresholdCents: args.individualThresholdCents,
    notBeforeSecs: args.notBeforeSecs,
    notAfterSecs: args.notAfterSecs,
    vcId: bytesToHex(vcId),
  };

  return {
    terms,
    credentialJcsB64u: b64uEncodeBytes(jcs),
    userSigB64u: b64uEncodeBytes(sig),
    signerAddress,
    signedAtMs: Date.now(),
  };
}

/**
 * Independently verify a signed mandate: recover the EIP-191 signer from the
 * canonical credential bytes and confirm it matches the recorded signer. This is
 * the same check the TEE performs server-side — we expose it so the UI and tests
 * can prove the signature without a node.
 */
export function verifyMandate(mandate: SignedMandate): boolean {
  try {
    const jcs = b64uDecodeStrict(mandate.credentialJcsB64u);
    const sig = b64uDecodeStrict(mandate.userSigB64u);
    const recovered = "0x" + bytesToHex(ethRecoverEip191(jcs, sig));
    return recovered.toLowerCase() === mandate.signerAddress.toLowerCase();
  } catch {
    // A malformed / tampered signature (e.g. r not on the curve) is simply invalid.
    return false;
  }
}

/** Is `nowSecs` inside the mandate's signed validity window? */
export function isMandateActive(mandate: SignedMandate, nowSecs: number): boolean {
  const { notBeforeSecs, notAfterSecs } = mandate.terms;
  return nowSecs >= notBeforeSecs && nowSecs <= notAfterSecs;
}
