# SPEC: chat-voice

Status: Approved (2026-11-14) · Owner: builder-backend (function), builder-web (UI) · Contracts: `contracts/api.md` §2, `types.ts` · ADR-001

## Objective
Talk to an agent by voice or text and hear it answer in real time, powered by NEAR AI Cloud private inference.

## Scope: function (`supabase/functions/chat/`)
- Start from upstream `chat/index.ts` and `routing.ts`. Point it at `https://cloud-api.near.ai/v1/chat/completions` with `NEARAI_API_KEY`.
- Remove 0G model routing, phone tools, shop orders and the `[[order]]` marker.
- Keep the SSE re-emit loop and the system-prompt builder.
- Add premium gating exactly as in `api.md` §2. The function reads `payment_quotes` with the service role.
- Default model is the `NEARAI_MODEL` env var. Proposed: `z-ai/glm-5.3-flash`, which is verifiable/TEE and costs $0.08/$0.50 per million tokens, falling back to `Qwen/Qwen3.6-35B-A3B-FP8`. `max_tokens` is 300, and replies are told to be 1–3 spoken sentences.
- Reasoning off for latency `[VERIFY: docs.near.ai/cloud/reasoning-models.md]`.

## Scope: UI (`apps/web/src/chat/`)
- `useChat(agentId)`: a hook that posts to the function and parses SSE. Upstream iOS `Backend.swift` shows the parse logic. Use `fetch` and a stream reader.
- Chat panel overlaid on the AR view: transcript, text input, mic button.
- Voice in: `SpeechRecognition` / `webkitSpeechRecognition` (Chrome Android). Voice out: `speechSynthesis`, speaking each sentence as it completes. Use the `agent.voice` hint if that voice exists.
- On 402, call `onPaymentRequired(PaymentRequired)`, which near-pay supplies.

## Acceptance criteria
1. With a free agent, the first text chunk arrives in under 3 s on 4G.
2. Without `NEARAI_API_KEY`, the function returns 500 `{"error":"…"}`. It never returns a canned reply.
3. With a paid agent: turn 1 replies, turn 2 returns 402, and after a verified payment, turn 2 streams with `{"premium":true}` first.
4. On an Android phone, holding the mic, speaking, and releasing sends the transcript, and the reply is spoken aloud.
5. The `context` and `premium_context` text never reach the client except through what the model says.

## Verified facts
- NEAR AI Cloud is OpenAI-compatible at `https://cloud-api.near.ai/v1` with Bearer key auth. It needs prepaid credits (docs.near.ai/cloud/quickstart.md, checked 2026-11-14).
- `GET https://cloud-api.near.ai/v1/model/list` is public and returned 64 models, including `z-ai/glm-5.3-flash` and `Qwen/Qwen3.6-35B-A3B-FP8`, both `verifiable: true` (checked 2026-11-14).
- Spike T13 (2026-11-14, 2 real calls): `POST https://cloud-api.near.ai/v1/chat/completions` with `z-ai/glm-5.3-flash`, `stream:true` returns OpenAI SSE: first chunk `delta:{role:"assistant",content:""}`, then `choices[0].delta.content` pieces, a `finish_reason:"stop"` chunk, an optional usage chunk (`stream_options:{include_usage:true}`, `choices:[]`), then `data: [DONE]`.
- Reasoning (docs.near.ai/cloud/reasoning-models.md): the model reasons by default; reasoning streams as `delta.reasoning_content`, answer as `delta.content`. There is no full off switch: `reasoning_effort: "low"` (or `"high"`) gives minimal reasoning (<20 tokens). `thinking_token_budget` (int, default 8192) only caps it. `chat_template_kwargs.enable_thinking:false` is warned against: it puts the reasoning into `content` and is not faster. Chosen: `reasoning_effort: "low"`; the function forwards only `delta.content`.
- Timing (curl from the dev machine, `reasoning_effort:"low"`, max_tokens 200): time to first byte 1.17 s, total 2.40 s for a 35-token reply (reasoning tokens ~0). Default (no flag) total was 2.59 s on the one-sentence prompt, but spent most tokens on reasoning in the orchestrator's earlier test (136 of 142). Chosen model: `z-ai/glm-5.3-flash`; Qwen fallback not needed.

## [VERIFY] first (spike task)
The streaming format matches OpenAI `choices[0].delta.content`; reasoning can be turned off; the chosen model replies in under 3 s.
