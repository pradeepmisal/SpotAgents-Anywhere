import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { json } from "../_shared/common.ts";
import type { Quote, QuoteRequest } from "../_shared/types.ts";
import { accountExists, callView } from "./rpc.ts";

const QUOTE_TTL_MS = 10 * 60 * 1000;
const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"; // 64 chars: no modulo bias

function quoteId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return "q_" + Array.from(bytes, (b) => ALPHABET[b & 63]).join("");
}

export async function handleQuote(req: Request, db: SupabaseClient, userId: string): Promise<Response> {
  let body: QuoteRequest;
  try { body = await req.json(); } catch { return json({ error: "bad body" }, 400); }
  if (typeof body?.agent_id !== "string" || !body.agent_id) return json({ error: "agent_id required" }, 400);

  const contractId = Deno.env.get("SPOTPAY_CONTRACT_ID");
  if (!contractId) return json({ error: "SPOTPAY_CONTRACT_ID not set" }, 500);

  const { data: agent, error } = await db
    .from("agents")
    .select("id, price_yocto::text, creator_account")
    .eq("id", body.agent_id)
    .maybeSingle();
  if (error) return json({ error: error.message }, 400); // e.g. malformed uuid
  if (!agent) return json({ error: "agent not found" }, 404);
  if (agent.price_yocto == null) return json({ error: "agent is free" }, 400);

  try {
    if (!(await accountExists(agent.creator_account))) return json({ error: "creator account not found" }, 409);
    const cfg = await callView<{ treasury: string; fee_bps: number }>(contractId, "get_config", {});

    const id = quoteId();
    const expires_at = new Date(Date.now() + QUOTE_TTL_MS).toISOString();
    const amount_yocto = String(BigInt(agent.price_yocto)); // numeric(40,0) arrives as integer text
    const { error: insErr } = await db.from("payment_quotes").insert({
      id,
      user_id: userId,
      agent_id: agent.id,
      creator_account: agent.creator_account,
      amount_yocto,
      status: "pending",
      expires_at,
    });
    if (insErr) return json({ error: insErr.message }, 500);

    const quote: Quote = {
      quote_id: id,
      contract_id: contractId,
      agent_id: agent.id,
      creator_account: agent.creator_account,
      amount_yocto,
      fee_bps: Number(cfg.fee_bps),
      expires_at,
    };
    return json(quote);
  } catch (e) {
    return json({ error: `NEAR RPC unavailable: ${(e as Error).message}` }, 502);
  }
}
