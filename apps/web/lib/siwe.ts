/**
 * SIWE-style login message. Shared by client (to sign) and server (to verify) —
 * it MUST be deterministic from {address, nonce} so the server can reconstruct
 * exactly what the wallet signed. No volatile fields (timestamps) in the body.
 */
export const SIWE_DOMAIN = "MandatePay";

export function buildLoginMessage(address: string, nonce: string): string {
  return [
    `${SIWE_DOMAIN} wants you to sign in with your Ethereum account:`,
    address,
    "",
    "Sign in to MandatePay — bounded payroll delegation. This signature proves wallet ownership; it costs no gas and authorises no payment.",
    "",
    `Nonce: ${nonce}`,
  ].join("\n");
}
