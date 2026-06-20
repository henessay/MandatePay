"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { buildLoginMessage } from "./siwe";

type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

function toHexUtf8(s: string): string {
  return (
    "0x" + Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, "0")).join("")
  );
}

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

interface WalletContextValue {
  /** A browser wallet (window.ethereum) is present. */
  hasProvider: boolean;
  /** Connected wallet account (client-side), lowercase 0x. */
  address: string | null;
  /** Signed-in wallet from the server session cookie, lowercase 0x. */
  authedAddress: string | null;
  connecting: boolean;
  signingIn: boolean;
  error: string | null;
  connect: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** EIP-191 personal_sign over a UTF-8 message; returns 0x signature. */
  personalSign: (message: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [hasProvider, setHasProvider] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [authedAddress, setAuthedAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const eth = typeof window !== "undefined" ? window.ethereum : undefined;
    setHasProvider(!!eth);

    (async () => {
      try {
        if (eth) {
          const accts = (await eth.request({ method: "eth_accounts" })) as string[];
          if (accts?.[0]) setAddress(accts[0].toLowerCase());
        }
        const me = (await fetch("/api/auth/me").then((r) => r.json())) as { address: string | null };
        if (me?.address) setAuthedAddress(me.address);
      } catch {
        /* offline / no provider — stay disconnected */
      }
    })();

    if (!eth?.on) return;
    const onAccountsChanged = (...args: unknown[]) => {
      const next = (args[0] as string[] | undefined)?.[0]?.toLowerCase() ?? null;
      setAddress(next);
      // Wallet switched away from (or disconnected) the signed-in account → drop session.
      setAuthedAddress((prev) => (prev && next !== prev ? null : prev));
      if (!next) void fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    };
    eth.on("accountsChanged", onAccountsChanged);
    return () => eth.removeListener?.("accountsChanged", onAccountsChanged);
  }, []);

  const ensureAccount = useCallback(async (): Promise<string> => {
    const eth = window.ethereum;
    if (!eth) throw new Error("No browser wallet found. Install MetaMask to continue.");
    if (address) return address;
    const accts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    const a = accts?.[0]?.toLowerCase();
    if (!a) throw new Error("Wallet returned no account.");
    setAddress(a);
    return a;
  }, [address]);

  const personalSign = useCallback(
    async (message: string): Promise<string> => {
      const eth = window.ethereum;
      if (!eth) throw new Error("No browser wallet found.");
      const from = await ensureAccount();
      return (await eth.request({
        method: "personal_sign",
        params: [toHexUtf8(message), from],
      })) as string;
    },
    [ensureAccount],
  );

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      await ensureAccount();
    } catch (e) {
      setError(errMsg(e));
      throw e;
    } finally {
      setConnecting(false);
    }
  }, [ensureAccount]);

  const signIn = useCallback(async () => {
    setError(null);
    setSigningIn(true);
    try {
      const a = await ensureAccount();
      const { nonce } = (await fetch("/api/auth/nonce").then((r) => r.json())) as { nonce: string };
      const signature = await personalSign(buildLoginMessage(a, nonce));
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: a, signature, nonce }),
      });
      const json = (await res.json()) as { address?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setAuthedAddress(json.address ?? a);
    } catch (e) {
      setError(errMsg(e));
      throw e;
    } finally {
      setSigningIn(false);
    }
  }, [ensureAccount, personalSign]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setAuthedAddress(null);
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      hasProvider,
      address,
      authedAddress,
      connecting,
      signingIn,
      error,
      connect,
      signIn,
      signOut,
      personalSign,
    }),
    [hasProvider, address, authedAddress, connecting, signingIn, error, connect, signIn, signOut, personalSign],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within <WalletProvider>");
  return ctx;
}

/** Short 0x display, e.g. 0x1234…ab12. */
export function shortAddress(a: string | null | undefined): string {
  if (!a) return "";
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
