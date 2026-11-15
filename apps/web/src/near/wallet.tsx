// NEAR Connect wallet wrapper (T08 Verified facts). No keys are created or stored here:
// the wallet (a sandboxed iframe) holds its own keys.
import { useEffect, useState } from "react";
import { NearConnector } from "@hot-labs/near-connect";

const network: "mainnet" | "testnet" =
  import.meta.env.VITE_NEAR_NETWORK === "mainnet" ? "mainnet" : "testnet";

let connector: NearConnector | null = null;
let current: string | null = null;
const listeners = new Set<(id: string | null) => void>();

function set(id: string | null) {
  current = id;
  listeners.forEach((l) => l(id));
}

export function getConnector(): NearConnector {
  if (!connector) {
    connector = new NearConnector({ network });
    connector.on("wallet:signIn", (p) => set(p.accounts[0]?.accountId ?? null));
    connector.on("wallet:signOut", () => set(null));
    // Restore an earlier session, if any.
    connector.getConnectedWallet().then((c) => set(c.accounts[0]?.accountId ?? null)).catch(() => {});
  }
  return connector;
}

export async function connect(): Promise<string | null> {
  const w = await getConnector().connect();
  const accounts = await w.getAccounts();
  set(accounts[0]?.accountId ?? null);
  return current;
}

export async function disconnect(): Promise<void> {
  const c = getConnector();
  try { await c.disconnect(); } catch { /* already signed out */ }
  set(null);
}

export function accountId(): string | null {
  getConnector();
  return current;
}

export function useAccountId(): string | null {
  const [id, setId] = useState<string | null>(() => accountId());
  useEffect(() => {
    listeners.add(setId);
    setId(current);
    return () => { listeners.delete(setId); };
  }, []);
  return id;
}

export function AccountChip() {
  const id = useAccountId();
  const [err, setErr] = useState<string | null>(null);
  const go = () => { setErr(null); connect().catch((e) => setErr(String(e?.message ?? e))); };
  return (
    <span className="near-chip">
      {id ? (
        <button type="button" title="Disconnect" onClick={() => void disconnect()}>{id}</button>
      ) : (
        <button type="button" onClick={go}>Connect wallet</button>
      )}
      {err && <small role="alert">{err}</small>}
    </span>
  );
}
