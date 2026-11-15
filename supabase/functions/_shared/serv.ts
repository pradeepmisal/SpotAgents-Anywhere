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
Rules:
- Ground everything in the expert's notes. Facts with basis "from_notes" must be stated or directly implied by the notes; use "common_knowledge" only for widely known facts about the place and keep them few and safe.
- Never invent names, dates, prices, opening hours or numbers that the notes do not contain. If the notes are thin, write less rather than invent.
- persona is second person ("You are ..."), warm and spoken-style. greeting welcomes the visitor and says the first question is free.
- teaser: the part a visitor may hear for free (facts + a hint of more). premium: the deeper content from the notes (stories, tips, nuance) unlocked after payment.
- stories: 0-3, each drawn from the notes. suggested_questions: exactly 3 short questions a visitor would ask. languages: 1-4 language names the agent can speak (include the language of the notes).
- Keep it safe: no medical, legal or dangerous advice; no private personal data.`;

export interface CompileInput {
  name: string; title: string; place_name: string; city: string; notes: string;
}

/** Compile notes to a validated CompiledAgent. One retry with validation errors. `critique` is a review to fix. */
export async function compileAgent(input: CompileInput, critique?: string, previous?: CompiledAgent): Promise<CompiledAgent> {
  const brief = `Agent name: ${input.name}\nTitle: ${input.title || "(none)"}\nPlace: ${input.place_name || "(unnamed)"}${input.city ? ", " + input.city : ""}\n\nExpert's notes:\n<<<\n${input.notes}\n>>>`;
  const user = critique
    ? `${brief}\n\nA quality reviewer rejected the previous version of this agent with this critique. Rebuild it and fix every point, staying grounded in the notes only.\nCritique: ${critique}\nPrevious version:\n${JSON.stringify(previous ?? {})}`
    : brief;
  const messages: Msg[] = [{ role: "system", content: COMPILE_SYSTEM }, { role: "user", content: user }];
  let lastErrors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await servJson(messages);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      lastErrors = ["output was not valid JSON"];
      messages.push({ role: "assistant", content: raw.slice(0, 3000) }, { role: "user", content: "That was not valid JSON. Return only the JSON object." });
      continue;
    }
    lastErrors = validateCompiled(parsed);
    if (lastErrors.length === 0) return parsed as CompiledAgent;
    messages.push(
      { role: "assistant", content: raw.slice(0, 3000) },
      { role: "user", content: `That output violated the schema:\n- ${lastErrors.join("\n- ")}\nReturn the corrected JSON object only.` },
    );
  }
  throw new Error("SERV output failed validation: " + lastErrors.join("; "));
}
