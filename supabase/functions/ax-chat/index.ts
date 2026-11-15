// One conversational turn with an agent through SERV Reasoning.
// SSE: first `data: {"premium":bool}`, then `data: {"text":"..."}` chunks, then `data: [DONE]`.
import { admin, caller, cors, json } from "../_shared/common.ts";
import { servStream, type Msg } from "../_shared/serv.ts";
import type { ChatMessage, CompiledAgent, PaymentRequired } from "../_shared/anywhere-types.ts";

const MAX_TURNS = 40;
const MAX_CHARS = 2000;

function cleanTurns(raw: unknown): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of (Array.isArray(raw) ? raw : []).slice(-MAX_TURNS)) {
    if (!m || typeof m !== "object") continue;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role === "user" || role === "assistant") && typeof content === "string" && content) {
      out.push({ role, content: content.slice(0, MAX_CHARS) });
    }
  }
  return out;
}

function systemPrompt(name: string, place: string, c: CompiledAgent, premium: boolean): string {
  const facts = c.facts.map((f) => `- ${f.claim}${f.basis === "common_knowledge" ? " (general knowledge)" : ""}`).join("\n");
  const stories = premium
    ? c.stories.map((s) => `- ${s.title} [${s.kind}]: ${s.text}`).join("\n")
    : c.stories.map((s) => `- ${s.title}`).join("\n");
  return `${c.persona}
You are "${name}"${place ? `, a guide at ${place}` : ""}. You speak to a visitor standing at (or virtually visiting) this spot. This is an AI agent built from a local expert's notes.

WHAT YOU KNOW (answer only from this):
Facts:
${facts}
Stories${premium ? "" : " (titles only; the full stories are for paying visitors)"}:
${stories || "- (none)"}
${premium ? `Deep knowledge (unlocked):\n${c.premium}` : `Free overview: ${c.teaser}`}

RULES:
- Stay grounded: use only the knowledge above. If asked something it does not cover, say you do not know that rather than guessing. Never invent dates, names, prices or numbers.
- ${premium ? "The visitor has unlocked the full session: share the stories and deep knowledge when relevant." : "This is the visitor's free first answer: answer from the facts and overview, and you may mention that there is more to unlock."}
- Reply in the visitor's language if you speak it (${c.languages.join(", ")}). Keep replies short and spoken-style, under 90 words. Plain text, no markdown.`;
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
  const uid = await caller(req, db);
  if (!uid) return json({ error: "Sign in first" }, 401);

  const { data: agent, error } = await db.from("ax_agents")
    .select("id, owner_id, name, place_name, status, compiled, price_units::text, price_usd, expires_at")
    .eq("id", body.agent_id).maybeSingle();
  if (error) return json({ error: /uuid/i.test(error.message) ? "Agent not found" : error.message }, /uuid/i.test(error.message) ? 404 : 500);
  const hidden = !agent || (agent.expires_at && agent.expires_at < new Date().toISOString()) ||
    (!["listed", "listed_unreviewed"].includes(agent.status) && agent.owner_id !== uid);
  if (hidden) return json({ error: "Agent not found" }, 404);

  const turns = cleanTurns(body.messages);
  while (turns.length > 0 && turns[0].role !== "user") turns.shift();
  if (turns[turns.length - 1]?.role !== "user") return json({ error: "The last message must be from the user" }, 400);

  const { data: pays, error: pErr } = await db.from("ax_payments").select("id")
    .eq("user_id", uid).eq("agent_id", agent.id).in("status", ["settled", "simulated"])
    .gt("unlocked_until", new Date().toISOString()).limit(1);
  if (pErr) return json({ error: "Couldn't check the unlock status" }, 500);
  const premium = (pays?.length ?? 0) > 0;

  if (!premium && turns.filter((t) => t.role === "user").length > 1) {
    const pr: PaymentRequired = {
      error: "payment_required", agent_id: agent.id, price_units: String(agent.price_units), price_usd: Number(agent.price_usd),
    };
    return json(pr, 402);
  }
  if (!Deno.env.get("SERV_API_KEY")) return json({ error: "The server has no SERV API key configured" }, 500);

  const messages: Msg[] = [
    { role: "system", content: systemPrompt(agent.name, agent.place_name, agent.compiled as CompiledAgent, premium) },
    ...turns,
  ];

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(sse({ premium }));
      let failed: string | null = null;
      try {
        const upstream = await servStream(messages);
        if (!upstream.ok || !upstream.body) {
          console.error("SERV error", upstream.status, (await upstream.text().catch(() => "")).slice(0, 500));
          failed = upstream.status === 429 ? "Too many requests right now. Try again in a moment." : "The agent couldn't think right now.";
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
                // Only delta.content is forwarded; any reasoning field never leaves the server.
                const text = JSON.parse(payload).choices?.[0]?.delta?.content;
                if (typeof text === "string" && text) controller.enqueue(sse({ text }));
              } catch { /* keep-alive or partial line */ }
            }
          }
        }
      } catch (e) {
        console.error("ax-chat: stream failed", String(e));
        failed = "The agent couldn't think right now.";
      }
      if (failed) controller.enqueue(sse({ error: failed }));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, { headers: sseHeaders });
});
