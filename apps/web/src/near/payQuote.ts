import type { Quote, VerifyRequest, VerifyResult, QuoteRequest } from "../types";
import { getConnector } from "./wallet";

export const CONTRACT_ID: string | undefined = import.meta.env.VITE_SPOTPAY_CONTRACT_ID || undefined;
const GAS = "30000000000000"; // 30 Tgas (T08); raise to 50 Tgas if "Exceeded the prepaid gas"
const STORE = "spotagents.pendingQuote";

const FN_BASE = () => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/near-pay`;

/** Optional: the app can set a getter that returns the Supabase anonymous-session JWT. */
let tokenGetter: (() => Promise<string | undefined>) | undefined;
export function setAuthTokenGetter(fn: () => Promise<string | undefined>) { tokenGetter = fn; }

async function post<T>(path: string, body: unknown): Promise<T> {
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const token = (await tokenGetter?.()) ?? anon;
  const res = await fetch(`${FN_BASE()}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(anon ? { apikey: anon } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `near-pay/${path} failed (${res.status})`);
  return json as T;
}

export const fetchQuote = (agent_id: string) => post<Quote>("quote", { agent_id } satisfies QuoteRequest);
export const verifyQuote = (req: VerifyRequest) => post<VerifyResult>("verify", req);

/** The quote id is remembered so a lost wallet promise can be recovered by polling verify. */
export function pendingQuoteId(): string | null {
  try { return localStorage.getItem(STORE); } catch { return null; }
}
export function clearPendingQuote() { try { localStorage.removeItem(STORE); } catch { /* ignore */ } }

/** Calls spot_pay.pay with the quote's exact deposit. Amount stays a string, converted via BigInt only. */
export async function payQuote(q: Quote): Promise<{ tx_hash: string }> {
  const receiverId = q.contract_id || CONTRACT_ID;
  if (!receiverId) throw new Error("Payments are not configured (missing contract id).");
  const deposit = BigInt(q.amount_yocto).toString();
  try { localStorage.setItem(STORE, q.quote_id); } catch { /* ignore */ }
  const wallet = await getConnector().wallet();
  const result = await wallet.signAndSendTransaction({
    receiverId,
    actions: [{
      type: "FunctionCall",
      params: {
        methodName: "pay",
        args: { quote_id: q.quote_id, agent_id: q.agent_id, creator: q.creator_account },
        gas: GAS,
        deposit,
      },
    }],
  });
  const tx_hash = (result as { transaction?: { hash?: string } })?.transaction?.hash;
  if (!tx_hash) throw new Error("Wallet returned no transaction hash.");
  return { tx_hash };
}

/** yoctoNEAR integer string to a NEAR string, using integer maths only. */
export function formatNear(yocto: string, maxDecimals = 4): string {
  const y = BigInt(yocto);
  const base = 10n ** 24n;
  const whole = y / base;
  const rem = y % base;
  const frac = rem.toString().padStart(24, "0").slice(0, maxDecimals).replace(/0+$/, "");
  if (!frac && rem !== 0n) return `<0.${"0".repeat(maxDecimals - 1)}1`;
  return frac ? `${whole}.${frac}` : `${whole}`;
}
