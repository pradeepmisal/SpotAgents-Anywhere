// ADR-009 guided session: start_session holds funds, release pays the creator.
import { useEffect, useState } from "react";
import type { Quote } from "../types";
import { CONTRACT_ID } from "./payQuote";
import { getConnector } from "./wallet";

const GAS = "30000000000000";
const STORE = "spotagents.walletHistory";
const EXPLORER = "https://testnet.nearblocks.io/txns/";
const RPC = (import.meta.env.VITE_NEAR_RPC_URL as string | undefined) || "https://test.rpc.fastnear.com";

export interface LocalEntry {
  quote_id: string;
  agent_id: string;
  agent_name?: string;
  kind: "session" | "payment";
  status: "active" | "released" | "paid";
  amount_yocto: string;
  account_id: string | null;
  start_tx?: string;
  release_tx?: string;
  at: number;
}

const subs = new Set<() => void>();

export function readHistory(): LocalEntry[] {
  try { return JSON.parse(localStorage.getItem(STORE) ?? "[]") as LocalEntry[]; } catch { return []; }
}
export function upsertEntry(e: Partial<LocalEntry> & { quote_id: string }) {
  const all = readHistory();
  const i = all.findIndex((x) => x.quote_id === e.quote_id);
  if (i >= 0) all[i] = { ...all[i], ...e }; else all.unshift({ at: Date.now(), ...e } as LocalEntry);
  try { localStorage.setItem(STORE, JSON.stringify(all.slice(0, 50))); } catch { /* ignore */ }
  subs.forEach((f) => f());
}
export function useHistory(): LocalEntry[] {
  const [h, setH] = useState<LocalEntry[]>(() => readHistory());
  useEffect(() => {
    const f = () => setH(readHistory());
    subs.add(f);
    return () => { subs.delete(f); };
  }, []);
  return h;
}

export const explorerTx = (hash: string) => `${EXPLORER}${hash}`;

function txHash(result: unknown): string {
  const h = (result as { transaction?: { hash?: string } })?.transaction?.hash;
  if (!h) throw new Error("Wallet returned no transaction hash.");
  return h;
}

export async function startSession(q: Quote, account: string | null, agentName?: string): Promise<{ tx_hash: string }> {
  const receiverId = q.contract_id || CONTRACT_ID;
  if (!receiverId) throw new Error("Payments are not configured (missing contract id).");
  const deposit = BigInt(q.amount_yocto).toString();
  const wallet = await getConnector().wallet();
  const result = await wallet.signAndSendTransaction({
    receiverId,
    actions: [{
      type: "FunctionCall",
      params: {
        methodName: "start_session",
        args: { quote_id: q.quote_id, agent_id: q.agent_id, creator: q.creator_account },
        gas: GAS,
        deposit,
      },
    }],
  });
  const tx_hash = txHash(result);
  upsertEntry({ quote_id: q.quote_id, agent_id: q.agent_id, agent_name: agentName, kind: "session", status: "active",
    amount_yocto: deposit, account_id: account, start_tx: tx_hash });
  return { tx_hash };
}

export async function releaseSession(quote_id: string): Promise<{ tx_hash: string }> {
  if (!CONTRACT_ID) throw new Error("Payments are not configured (missing contract id).");
  const wallet = await getConnector().wallet();
  const result = await wallet.signAndSendTransaction({
    receiverId: CONTRACT_ID,
    actions: [{ type: "FunctionCall", params: { methodName: "release", args: { quote_id }, gas: GAS, deposit: "0" } }],
  });
  const tx_hash = txHash(result);
  upsertEntry({ quote_id, status: "released", release_tx: tx_hash });
  return { tx_hash };
}

/** Testnet balance via RPC view_account, as a yocto string. */
export async function fetchBalance(account: string): Promise<string> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "b", method: "query",
      params: { request_type: "view_account", finality: "final", account_id: account } }),
  });
  const j = await res.json();
  if (j.error || !j.result?.amount) throw new Error(j.error?.data ?? j.error?.message ?? "balance unavailable");
  return String(j.result.amount);
}
