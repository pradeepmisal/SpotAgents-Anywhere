// Tour agent (buyer): POST {agent_id} -> AgentPayResult; GET -> BudgetView.
import { admin, caller, cors, json } from "../_shared/common.ts";
import { EXPLORER, b64, signPayment } from "../_shared/kite.ts";

const UUID = /^[0-9a-f-]{36}$/i;
const E18 = 10n ** 18n;
const BUDGET = E18;          // $1.00
const CAP = E18 / 10n;       // $0.10
const SESSION_MS = 30 * 60_000;

// deno-lint-ignore no-explicit-any
type Db = any;

async function budgetFor(db: Db, uid: string) {
  const { data } = await db.from("ax_budgets").select("*").eq("user_id", uid).maybeSingle();
  if (data) return data;
  const row = { user_id: uid, budget_units: BUDGET.toString(), per_tx_cap_units: CAP.toString(), spent_units: "0", expires_at: new Date(Date.now() + 24 * 3600_000).toISOString() };
  const { error } = await db.from("ax_budgets").upsert(row, { onConflict: "user_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return (await db.from("ax_budgets").select("*").eq("user_id", uid).single()).data;
}

async function view(db: Db, uid: string) {
  const b = await budgetFor(db, uid);
  const { data: pays } = await db.from("ax_payments").select("*, ax_agents(name)").eq("user_id", uid).order("created_at", { ascending: false }).limit(50);
  const budget = BigInt(b.budget_units), spent = BigInt(b.spent_units);
  return {
    budget_units: String(b.budget_units), per_tx_cap_units: String(b.per_tx_cap_units), spent_units: String(b.spent_units),
    remaining_units: (budget > spent ? budget - spent : 0n).toString(), expires_at: b.expires_at,
    agent_wallet: Deno.env.get("KITE_AGENT_ADDRESS") ?? "",
    // deno-lint-ignore no-explicit-any
    payments: (pays ?? []).map((p: any) => ({
      id: p.id, agent_id: p.agent_id, agent_name: p.ax_agents?.name ?? "", amount_units: String(p.amount_units),
      status: p.status, tx_hash: p.tx_hash, explorer_url: p.tx_hash ? EXPLORER + p.tx_hash : null,
      error: p.error, unlocked_until: p.unlocked_until, created_at: p.created_at,
    })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = admin();
  const uid = await caller(req, db);
  if (!uid) return json({ error: "unauthorized" }, 401);
  try {
    if (req.method === "GET") return json(await view(db, uid));
    if (req.method !== "POST") return json({ error: "method" }, 405);
    // deno-lint-ignore no-explicit-any
    let body: any; try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
    const agentId = body?.agent_id;
    if (typeof agentId !== "string" || !UUID.test(agentId)) return json({ error: "agent_id required" }, 400);
    const { data: agent } = await db.from("ax_agents").select("id,name,price_units").eq("id", agentId).maybeSingle();
    if (!agent) return json({ error: "agent not found" }, 404);

    const b = await budgetFor(db, uid);
    const price = BigInt(agent.price_units);
    let refuse: string | null = null;
    if (new Date(b.expires_at).getTime() < Date.now()) refuse = "Budget session expired";
    else if (price > BigInt(b.per_tx_cap_units)) refuse = "Price exceeds the per-purchase cap";
    else if (BigInt(b.spent_units) + price > BigInt(b.budget_units)) refuse = "Not enough budget remaining";
    if (refuse) return json({ status: "refused", reason: refuse, budget: await view(db, uid) });

    const wallet = Deno.env.get("KITE_AGENT_ADDRESS") ?? null;
    const payTo = Deno.env.get("KITE_PAYTO_ADDRESS") ?? null;
    const unlocked = new Date(Date.now() + SESSION_MS).toISOString();
    let txHash: string | null = null, failure: string | null = null;

    try {
      const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ax-pay/premium`;
      const headers = { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") ?? "" };
      const payload = JSON.stringify({ agent_id: agentId });
      const r1 = await fetch(url, { method: "POST", headers, body: payload });
      if (r1.status !== 402) throw new Error(`seller returned ${r1.status} instead of 402`);
      const ch = await r1.json();
      const reqs = ch.accepts?.[0];
      if (!reqs || reqs.amount !== price.toString()) throw new Error("seller requirements mismatch");
      const signed = await signPayment(reqs, ch.resource);
      const r2 = await fetch(url, { method: "POST", headers: { ...headers, "PAYMENT-SIGNATURE": b64(signed) }, body: payload });
      const out = await r2.json().catch(() => ({}));
      if (!r2.ok || !out.tx_hash) throw new Error(`payment failed (${r2.status}): ${JSON.stringify(out).slice(0, 400)}`);
      txHash = out.tx_hash;
    } catch (e) {
      failure = String((e as Error).message ?? e).slice(0, 600);
    }

    const status = txHash ? "settled" : "simulated";
    const { data: pay, error } = await db.from("ax_payments").insert({
      user_id: uid, agent_id: agentId, amount_units: price.toString(), status, tx_hash: txHash,
      payer: wallet, pay_to: payTo, error: failure, unlocked_until: unlocked,
    }).select().single();
    if (error) throw new Error(error.message);
    // Simulated purchases still count against the demo budget so the cap logic is visible.
    await db.from("ax_budgets").update({ spent_units: (BigInt(b.spent_units) + price).toString() }).eq("user_id", uid);
    const v = await view(db, uid);
    return json({
      status,
      ...(failure ? { reason: `Simulated: ${failure}` } : {}),
      payment: v.payments.find((p: { id: string }) => p.id === pay.id),
      budget: v,
    });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
