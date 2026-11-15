// SERV Reasoning (OpenServ) client: JSON compile + streaming chat. Server-side only.
import type { CompiledAgent } from "./anywhere-types.ts";
import schema from "./anywhere-agent.schema.json" with { type: "json" };
import { validateCompiled } from "./validate.ts";

export const SERV_URL = "https://inference-api.openserv.ai/v1/chat/completions";

export const compileModel = () => Deno.env.get("SERV_COMPILE_MODEL") || "gpt-5.4-mini";
export const chatModel = () => Deno.env.get("SERV_CHAT_MODEL") || "gpt-5.4-mini";

function key(): string {
  const k = Deno.env.get("SERV_API_KEY");
  if (!k) throw new Error("SERV_API_KEY is not configured");
  return k;
}

export type Msg = { role: "system" | "user" | "assistant"; content: string };

/** Non-streaming JSON-mode completion; returns the raw message content. */
export async function servJson(messages: Msg[], model = compileModel(), maxTokens = 4000): Promise<string> {
  const res = await fetch(SERV_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key()}` },
    body: JSON.stringify({
      model,
      messages,
      max_completion_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SERV ${res.status}: ${text.slice(0, 300)}`);
  const content = JSON.parse(text).choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content) throw new Error("SERV returned no content");
  return content;
}

/** Streaming chat completion; the caller reads the SSE body. */
export function servStream(messages: Msg[], model = chatModel(), maxTokens = 700): Promise<Response> {
  return fetch(SERV_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key()}` },
    body: JSON.stringify({ model, messages, max_completion_tokens: maxTokens, stream: true }),
  });
}

const COMPILE_SYSTEM = `You compile a local expert's notes about one real place into a JSON "agent" that a visitor can talk to.
Return ONLY one JSON object that validates against this JSON Schema (no markdown, no extra keys):
${JSON.stringify(schema)}
Exact shape (example values):
{"persona":"You are ...","greeting":"...","facts":[{"claim":"...","basis":"from_notes"}],"stories":[{"title":"...","text":"...","kind":"practical_tip"}],"teaser":"...","premium":"...","suggested_questions":["q1","q2","q3"],"languages":["English"]}
facts items are OBJECTS with claim and basis (never plain strings); story kind is one of personal_memory, local_legend, practical_tip; stories have only title, text, kind.
Rules:
- Ground everything in the expert's notes. Facts with basis "from_notes" must be stated or directly implied by the notes; use "common_knowledge" only for widely known facts about the place and keep them few and safe.
- Never invent names, dates, prices, opening hours or numbers that the notes do not contain. If the notes are thin, write less rather than invent.
- persona is second person ("You are ..."), warm and spoken-style. greeting welcomes the visitor and says the first question is free.
- teaser: the part a visitor may hear for free (facts + a hint of more). premium: the deeper content from the notes (stories, tips, nuance) unlocked after payment.
- stories: 0-3, each drawn from the notes. suggested_questions: exactly 3 short questions a visitor would ask. languages: 1-4 language names the agent can speak (include the language of the notes).
- Keep it safe: no medical, legal or dangerous advice; no private personal data.`;

const FORMAT_REMINDER = `

Return a JSON object with EXACTLY these top-level keys and no others: persona, greeting, facts, stories, teaser, premium, suggested_questions, languages. facts = array of {claim, basis} where basis is exactly "from_notes" or "common_knowledge". stories = array of {title, text, kind} where kind is exactly one of "personal_memory", "local_legend", "practical_tip" (with underscores). suggested_questions = array of exactly 3 strings. languages = array of 1-4 strings.`;

/** Mechanical clean-up of harmless deviations (enum spelling, over-long strings). Never invents content. */
function normalize(o: unknown): unknown {
  if (!o || typeof o !== "object" || Array.isArray(o)) return o;
  const a = { ...(o as Record<string, unknown>) };
  const cut = (v: unknown, n: number) => (typeof v === "string" && v.length > n ? v.slice(0, n - 1).trimEnd() + "…" : v);
  a.persona = cut(a.persona, 600); a.greeting = cut(a.greeting, 300); a.teaser = cut(a.teaser, 600); a.premium = cut(a.premium, 3000);
  if (Array.isArray(a.facts)) {
    a.facts = a.facts.slice(0, 6).map((f) => {
      if (!f || typeof f !== "object") return f;
      const x = f as Record<string, unknown>;
      const basis = String(x.basis ?? "").toLowerCase();
      return { claim: cut(x.claim, 300), basis: basis.includes("common") || basis.includes("general") ? "common_knowledge" : "from_notes" };
    });
  }
  if (Array.isArray(a.stories)) {
    a.stories = a.stories.slice(0, 3).map((s) => {
      if (!s || typeof s !== "object") return s;
      const x = s as Record<string, unknown>;
      const kind = String(x.kind ?? x.category ?? "").toLowerCase().replace(/[\s-]+/g, "_");
      return { title: cut(x.title, 80), text: cut(x.text, 900), kind: ["personal_memory", "local_legend", "practical_tip"].includes(kind) ? kind : "practical_tip" };
    });
  }
  if (Array.isArray(a.suggested_questions)) a.suggested_questions = a.suggested_questions.map((q) => cut(q, 80));
  if (Array.isArray(a.languages)) a.languages = a.languages.slice(0, 4).map((q) => cut(q, 20));
  return a;
}

export interface CompileInput {
  name: string; title: string; place_name: string; city: string; notes: string;
}

/** Compile notes to a validated CompiledAgent. One retry with validation errors. `critique` is a review to fix. */
export async function compileAgent(input: CompileInput, critique?: string, previous?: CompiledAgent): Promise<CompiledAgent> {
  const brief = `Agent name: ${input.name}\nTitle: ${input.title || "(none)"}\nPlace: ${input.place_name || "(unnamed)"}${input.city ? ", " + input.city : ""}\n\nExpert's notes:\n<<<\n${input.notes}\n>>>`;
  const user = critique
    ? `${brief}\n\nA quality reviewer rejected the previous version of this agent with this critique. Rebuild it and fix every point, staying grounded in the notes only.\nCritique: ${critique}\nPrevious version:\n${JSON.stringify(previous ?? {})}`
    : brief;
  const messages: Msg[] = [{ role: "system", content: COMPILE_SYSTEM }, { role: "user", content: user + FORMAT_REMINDER }];
  let lastErrors: string[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await servJson(messages);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      lastErrors = ["output was not valid JSON"];
      messages.push({ role: "assistant", content: raw.slice(0, 3000) }, { role: "user", content: "That was not valid JSON. Return only the JSON object." });
      continue;
    }
    parsed = normalize(parsed);
    lastErrors = validateCompiled(parsed);
    if (lastErrors.length === 0) return parsed as CompiledAgent;
    messages.push(
      { role: "assistant", content: raw.slice(0, 3000) },
      { role: "user", content: `That output violated the schema:\n- ${lastErrors.join("\n- ")}\nReturn the corrected JSON object only.` },
    );
  }
  throw new Error("SERV output failed validation: " + lastErrors.join("; "));
}
