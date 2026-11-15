// Seller: POST /ax-pay/premium {agent_id}. x402 v2: 402 + PAYMENT-REQUIRED, retry with PAYMENT-SIGNATURE.
import { admin, cors, json } from "../_shared/common.ts";
import { b64, unb64, requirements, verifyPayment, settlePayment } from "../_shared/kite.ts";

const UUID = /^[0-9a-f-]{36}$/i;
const exposed = "PAYMENT-REQUIRED, PAYMENT-RESPONSE";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...cors, "Access-Control-Allow-Headers": cors["Access-Control-Allow-Headers"] + ", payment-signature, x-payment", "Access-Control-Expose-Headers": exposed } });
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);
  // deno-lint-ignore no-explicit-any
  let body: any; try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const agentId = body?.agent_id;
  if (typeof agentId !== "string" || !UUID.test(agentId)) return json({ error: "agent_id required" }, 400);

  const db = admin();
  const { data: agent } = await db.from("ax_agents").select("id,name,price_units").eq("id", agentId).maybeSingle();
  if (!agent) return json({ error: "agent not found" }, 404);

  let reqs;
  try { reqs = requirements(String(agent.price_units)); } catch (e) { return json({ error: String((e as Error).message) }, 500); }
  const resource = { url: req.url, description: `30-minute premium session with ${agent.name}`, mimeType: "application/json" };

  const header = req.headers.get("PAYMENT-SIGNATURE") ?? req.headers.get("X-PAYMENT");
  if (!header) {
    const challenge = { x402Version: 2, error: "payment required", resource, accepts: [reqs] };
    return new Response(JSON.stringify(challenge), {
      status: 402,
      headers: { ...cors, "Content-Type": "application/json", "PAYMENT-REQUIRED": b64(challenge), "Access-Control-Expose-Headers": exposed },
    });
  }

  // deno-lint-ignore no-explicit-any
  let payload: any;
  try { payload = unb64(header); } catch { return json({ error: "bad payment header" }, 400); }
  // Never trust the client's requirements: pin them to ours.
  payload.accepted = reqs;
  const a = payload?.payload?.authorization;
  if (!a || a.to?.toLowerCase() !== reqs.payTo.toLowerCase() || String(a.value) !== reqs.amount) {
    return json({ error: "payment does not match requirements" }, 402);
  }

  const v = await verifyPayment(payload, reqs);
  if (!v.ok || v.body?.isValid === false) return json({ error: "verify failed", detail: v.body }, 402);
  const s = await settlePayment(payload, reqs);
  const tx = s.body?.transaction ?? s.body?.txHash ?? s.body?.tx_hash;
  if (!s.ok || s.body?.success === false || !tx) return json({ error: "settle failed", detail: s.body }, 502);
  return new Response(JSON.stringify({ tx_hash: tx, payer: s.body?.payer ?? a.from }), {
    headers: { ...cors, "Content-Type": "application/json", "PAYMENT-RESPONSE": b64(s.body), "Access-Control-Expose-Headers": exposed },
  });
});
