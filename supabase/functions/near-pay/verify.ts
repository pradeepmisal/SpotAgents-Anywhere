import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { json } from "../_shared/common.ts";
import type { VerifyRequest, VerifyResult } from "../_shared/types.ts";
import { callView } from "./rpc.ts";

const UNLOCK_MS = 30 * 60 * 1000;

/** Shape of the contract's get_payment view (amounts are U128 strings). */
export interface PaymentView {
  payer: string;
  creator: string;
  agent_id: string;
  amount: string;
  fee: string;
  block_timestamp_ms: number;
}

/** Shape of the contract's get_session view (ADR-009). */
export interface SessionView extends PaymentView {
  status: "active" | "released";
}

export interface QuoteRow {
  agent_id: string;
  creator_account: string;
  amount_yocto: string | number;
}

/** Pure check of an on-chain payment against its quote. Returns a reason if invalid, else null. */
export function mismatch(quote: QuoteRow, p: Pick<PaymentView, "creator" | "agent_id" | "amount">): string | null {
  if (p.creator !== quote.creator_account) return "creator mismatch";
  if (p.agent_id !== quote.agent_id) return "agent mismatch";
  let paid: bigint;
  try { paid = BigInt(p.amount); } catch { return "invalid amount"; }
  if (paid < BigInt(quote.amount_yocto)) return "amount too small";
  return null;
}

/** Best effort: a v1 contract has no get_session, so any error means "no session". */
async function fetchSession(contractId: string, quoteId: string): Promise<SessionView | null> {
  try {
    const s = await callView<SessionView | null>(contractId, "get_session", { quote_id: quoteId });
    return s && (s.status === "active" || s.status === "released") ? s : null;
  } catch {
    return null;
  }
}

export function explorerUrl(txHash: string | null | undefined): string | null {
  return txHash ? `https://testnet.nearblocks.io/txns/${txHash}` : null;
}

export async function handleVerify(req: Request, db: SupabaseClient, userId: string): Promise<Response> {
  let body: VerifyRequest;
  try { body = await req.json(); } catch { return json({ error: "bad body" }, 400); }
  if (typeof body?.quote_id !== "string" || !body.quote_id) return json({ error: "quote_id required" }, 400);

  const contractId = Deno.env.get("SPOTPAY_CONTRACT_ID");
  if (!contractId) return json({ error: "SPOTPAY_CONTRACT_ID not set" }, 500);

  const { data: q, error } = await db
    .from("payment_quotes")
    .select("*, amount_yocto:amount_yocto::text")
    .eq("id", body.quote_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!q) return json({ error: "quote not found" }, 404);

  const result = (r: Partial<VerifyResult> & { status: VerifyResult["status"] }): Response =>
    json({ unlocked_until: null, payer_account: null, explorer_url: null, session_status: null, ...r } satisfies VerifyResult);

  // Idempotent: already verified.
  if (q.status === "paid") {
    const sess = await fetchSession(contractId, q.id);
    return result({
      status: "paid",
      session_status: sess?.status ?? null,
      unlocked_until: q.unlocked_until,
      payer_account: q.payer_account,
      explorer_url: explorerUrl(q.tx_hash ?? body.tx_hash),
    });
  }

  let payment: PaymentView | null;
  try {
    payment = await callView<PaymentView | null>(contractId, "get_payment", { quote_id: q.id });
  } catch (e) {
    return json({ error: `NEAR RPC unavailable: ${(e as Error).message}` }, 502);
  }
  // v2 (ADR-009): a funded session counts as paid, active or released.
  const session = payment ? null : await fetchSession(contractId, q.id);
  if (!payment && session) payment = session;

  if (!payment) {
    const expired = new Date(q.expires_at).getTime() <= Date.now();
    return result({ status: expired ? "expired" : "pending" });
  }

  const reason = mismatch(q, payment);
  if (reason) return result({ status: "invalid", reason });

  const unlocked_until = new Date(Date.now() + UNLOCK_MS).toISOString();
  const tx_hash = body.tx_hash ?? q.tx_hash ?? null;
  // Only flip a still-pending row, so concurrent polls don't extend the unlock.
  const { data: upd, error: updErr } = await db
    .from("payment_quotes")
    .update({ status: "paid", payer_account: payment.payer, tx_hash, unlocked_until })
    .eq("id", q.id)
    .eq("status", "pending")
    .select("unlocked_until, payer_account, tx_hash")
    .maybeSingle();
  if (updErr) return json({ error: updErr.message }, 500);

  const row = upd ??
    (await db.from("payment_quotes").select("unlocked_until, payer_account, tx_hash").eq("id", q.id).single()).data;
  return result({
    status: "paid",
    session_status: session?.status ?? null,
    unlocked_until: row?.unlocked_until ?? unlocked_until,
    payer_account: row?.payer_account ?? payment.payer,
    explorer_url: explorerUrl(row?.tx_hash ?? tx_hash),
  });
}
