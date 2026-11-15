// One conversational turn with an agent, through NEAR AI Cloud.
// SSE: first `data: {"premium":bool}`, then `data: {"text":"..."}` chunks, then `data: [DONE]`.
import { admin, caller, cors, json } from "../_shared/common.ts";
import type { ChatMessage, PaymentRequired } from "../_shared/types.ts";
import { completionBody, modelFor, NEARAI_URL } from "./routing.ts";
import { systemPrompt } from "./prompt.ts";

const MAX_TURNS = 40;
const MAX_CHARS = 2000;

type AgentRow = {
  id: string; name: string; greeting: string; context: string; premium_context: string;
  price_yocto: string | null; model: string | null;
};

// Agents change rarely; keep them 30 s per worker. Unlock state is never cached.
const agentCache = new Map<string, { row: AgentRow | null; at: number }>();
async function loadAgent(db: ReturnType<typeof admin>, id: string): Promise<AgentRow | null> {
  const hit = agentCache.get(id);
  if (hit && Date.now() - hit.at < 30_000) return hit.row;
  const { data, error } = await db.from("agents")
    .select("id, name, greeting, context, premium_context, price_yocto::text, model").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  const row: AgentRow | null = data
    ? {
      id: data.id, name: data.name, greeting: data.greeting ?? "", context: data.context ?? "",
      premium_context: data.premium_context ?? "",
      price_yocto: data.price_yocto == null ? null : String(data.price_yocto), model: data.model ?? null,
    }
    : null;
  agentCache.set(id, { row, at: Date.now() });
  return row;
}

/** A paid quote for this user and agent whose unlock window hasn't ended. */
async function isUnlocked(db: ReturnType<typeof admin>, userId: string, agentId: string): Promise<boolean> {
  const { data, error } = await db.from("payment_quotes").select("id")
    .eq("user_id", userId).eq("agent_id", agentId).eq("status", "paid")
    .gt("unlocked_until", new Date().toISOString()).limit(1);
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

function cleanTurns(raw: unknown): ChatMessage[] {
  const out: ChatMessage[] = [];
  const list = Array.isArray(raw) ? raw : [];
  for (const m of list.slice(-MAX_TURNS)) {
    if (!m || typeof m !== "object") continue;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role === "user" || role === "assistant") && typeof content === "string" && content) {
      out.push({ role, content: content.slice(0, MAX_CHARS) });
    }
  }
  return out;
}

const encoder = new TextEncoder();
const sse = (o: unknown) => encoder.encode(`data: ${JSON.stringify(o)}\n\n`);
const sseHeaders = { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body || typeof body !== "object") return json({ error: "Invalid JSON" }, 400);
  if (typeof body.agent_id !== "string" || !body.agent_id) return json({ error: "agent_id is required" }, 400);

  const db = admin();
  let uid: string | null, agent: AgentRow | null;
  try {
    [uid, agent] = await Promise.all([caller(req, db), loadAgent(db, body.agent_id)]);
  } catch (e) {
    // A malformed agent_id (not a uuid) makes the query fail; treat it as unknown.
    if (/uuid/i.test(String(e))) return json({ error: "Agent not found" }, 404);
    return json({ error: String(e) }, 500);
  }
  if (!uid) return json({ error: "Sign in first" }, 401);
  if (!agent) return json({ error: "Agent not found" }, 404);

  const turns = cleanTurns(body.messages);
  while (turns.length > 0 && turns[0].role !== "user") turns.shift();
  if (turns[turns.length - 1]?.role !== "user") return json({ error: "The last message must be from the user" }, 400);

  // Gating: free agents are open. Paid agents: first user turn free (teaser), later turns need an unlock.
  let premium = false;
  if (agent.price_yocto !== null) {
    try {
      premium = await isUnlocked(db, uid, agent.id);
    } catch (e) {
      console.error("chat: unlock check failed", String(e));
      return json({ error: "Couldn't check the unlock status" }, 500);
    }
    if (!premium && turns.filter((t) => t.role === "user").length > 1) {
      const pr: PaymentRequired = { error: "payment_required", agent_id: agent.id, price_yocto: agent.price_yocto };
      return json(pr, 402);
    }
  }

  const key = Deno.env.get("NEARAI_API_KEY");
  if (!key) return json({ error: "The server has no NEAR AI API key configured" }, 500);

  const model = modelFor(agent, Deno.env.get("NEARAI_MODEL"));
  const messages = [{ role: "system", content: systemPrompt(agent, premium, body.client) }, ...turns];

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(sse({ premium }));
      let failed: string | null = null;
      try {
        const upstream = await fetch(NEARAI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify(completionBody(model, messages)),
        });
        if (!upstream.ok || !upstream.body) {
          console.error("NEAR AI error", upstream.status, (await upstream.text().catch(() => "")).slice(0, 500));
          failed = upstream.status === 429
            ? "Too many requests right now. Try again in a moment."
            : upstream.status === 402
            ? "This agent's compute balance has run out."
            : "The agent couldn't think right now.";
        } else {
          const reader = upstream.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let nl;
            while ((nl = buffer.indexOf("\n")) >= 0) {
              const line = buffer.slice(0, nl).trim();
              buffer = buffer.slice(nl + 1);
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (payload === "[DONE]") continue;
              try {
                // Only delta.content is forwarded; delta.reasoning_content never leaves the server.
                const text = JSON.parse(payload).choices?.[0]?.delta?.content;
                if (typeof text === "string" && text) controller.enqueue(sse({ text }));
              } catch { /* keep-alive or partial line */ }
            }
          }
        }
      } catch (e) {
        console.error("chat: stream failed", String(e));
        failed = "The agent couldn't think right now.";
      }
      if (failed) controller.enqueue(sse({ error: failed }));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, { headers: sseHeaders });
});
