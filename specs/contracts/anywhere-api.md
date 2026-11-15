# API contract: SpotAgents Anywhere

Status: Approved (2026-11-15). FROZEN. Types are in `anywhere-types.ts`. DB in `anywhere-db.sql`.

All calls go to the hosted Supabase project with `Authorization: Bearer <anon session JWT>` (the web app calls `supabase.auth.signInAnonymously()` on first load, as before). Functions verify the caller with `caller()` from `supabase/functions/_shared/common.ts` (`verify_jwt = false` in config.toml). Errors: JSON `{ "error": string }` with 4xx/5xx. New functions are named `ax-*`; the NEAR-era `chat` and `near-pay` functions are not modified.

Money: pieUSD has 18 decimals. `*_units` are decimal strings of base units (bigint in TS, numeric(40,0) in SQL). USD values are for display only: 1 USD = 10^18 units. Never use floats in the payment path.

## SERV Reasoning (server-side only)
- `POST https://inference-api.openserv.ai/v1/chat/completions`, header `Authorization: Bearer ${SERV_API_KEY}`, OpenAI chat format. A system message is mandatory.
- Use `max_completion_tokens` (not `max_tokens`). Verified 2026-11-15 with model `gpt-5.4-nano`.
- Models: compile `SERV_COMPILE_MODEL` (default `gpt-5.4-mini`), chat `SERV_CHAT_MODEL` (default `gpt-5.4-mini`). Chat streams (`stream: true`, SSE, OpenAI delta format).

## 1. `POST /functions/v1/ax-compile` (owner: backend)
Request `CompileRequest` → `AgentDetail` (201).
- Validates input (notes 20–4000 chars, lat/lng range, price_usd 0.01–0.10, name 1–60).
- Limit: 3 agents per caller per 24 h → 429 `{error:"limit"}`.
- Calls SERV with a system prompt containing `anywhere-agent.schema.json` and `response_format: {type:"json_object"}`. Parses and validates against the schema (hand-written validator, no new dependency). One retry with the validation errors; still invalid → 502.
- Inserts `ax_agents` with `status='in_review'`, `expires_at = now()+7 days`, `price_units = round(price_usd * 10^18)` computed with bigint from cents.
- Then submits to Reppo (see 4). If Reppo is not configured or fails → `status='listed_unreviewed'`.

## 2. `GET /functions/v1/ax-agents` (owner: backend)
Query: `lat`, `lng` (optional, for distance), `id` (optional, single agent).
- Returns `AgentSummary[]`: all non-expired agents with status `listed`/`listed_unreviewed`, plus the caller's own `in_review`/`rejected` agents. Sorted by distance when lat/lng given, else newest. Max 300.
- With `id`: returns one `AgentDetail` (404 if hidden from caller). Never returns `source_notes` or `compiled.premium`.

## 3. `POST /functions/v1/ax-chat` (owner: backend)
Request `ChatRequest` (same shape as before: `agent_id`, `messages`). Same SSE protocol as the NEAR version:
- first event `data: {"premium": bool}`, then `data: {"text":"…"}` chunks, then `data: [DONE]`; upstream error → `data: {"error":"…"}` then `[DONE]`.
- Premium when the caller has an `ax_payments` row for the agent with status `settled` or `simulated` and `unlocked_until > now()`.
- Not premium: the first user turn is answered from persona + facts + stories titles + teaser; any later turn → HTTP 402 `PaymentRequired`.
- The agent must stay grounded: answer only from the compiled content; say so when it does not know.

## 4. Reppo review (owner: backend), `POST /functions/v1/ax-review`
Request `{ agent_id }` → `ReviewStatus`. Called by the web app every 30 s while an agent is `in_review` (and by the seeding script).
- Submit (done in ax-compile and on rebuild): `POST https://eval.reppo.xyz/api/v1/agents/eval-requests/submit` with `Authorization: Bearer ${REPPO_API_KEY}`, body `{"type":"answer","payload":<agent JSON + source notes summary>,"criteria":[accuracy vs notes, no invented facts, helpful to a visitor, safe]}` → 201 `{id, evalId, status:"PENDING"}`; store `reppo_eval_id`. [VERIFY exact body on first call; adjust and record in this file under "Verified facts"]
- Poll: `GET https://eval.reppo.xyz/api/v1/agents/eval-requests/{evalId}`.
- On result: store score/decision/critique, append to `review_history`. `accept` or score ≥ 70 → `listed`. Otherwise if `version < 3` → SERV rebuild with the critique (version+1), resubmit, stay `in_review`. Otherwise → `rejected`.

## 5. Kite x402 (owner: payments)
### 5a. Seller: `POST /functions/v1/ax-pay/premium` with body `{ agent_id }`
- x402 seller for "a 30-minute premium session". Without a payment header → **402** with the payment requirements (network Kite testnet, chain 2368, asset pieUSD, `payTo = KITE_PAYTO_ADDRESS`, amount = agent `price_units`).
- With the payment header → verify + settle through the facilitator `https://facilitator.pieverse.io/v2` (`/verify`, `/settle`), then return `{ tx_hash }`. Header names and payload layout: follow the x402 version the facilitator's `/supported` reports. [VERIFY on first call; record under "Verified facts"]
### 5b. Tour agent: `POST /functions/v1/ax-agent-pay` with body `{ agent_id }` → `AgentPayResult`
- Loads/creates the caller's `ax_budgets` row (budget $1.00, cap $0.10, 24 h).
- Refuses with `status:"refused"` and `reason` if price > cap, or spent + price > budget, or the budget expired.
- Calls 5a, receives the 402, signs EIP-3009 `transferWithAuthorization` with `KITE_AGENT_PRIVATE_KEY` (EIP-712 domain `{name:"pieUSD", version:"1", chainId:2368, verifyingContract: KITE_ASSET_ADDRESS}`), retries with the payment header, records `ax_payments` (`settled`, tx_hash, payer, pay_to, `unlocked_until = now()+30 min`) and adds to `spent_units`.
- If funds/facilitator fail: records `status:'simulated'` with `error`, unlocks, and returns `status:"simulated"` so the UI labels it. Never returns `settled` without a tx hash from the facilitator.
- `GET /functions/v1/ax-agent-pay` → `BudgetView` (budget, cap, spent, remaining, expires_at, payments[]).
- Explorer: `https://testnet.kitescan.ai/tx/<hash>`.

## Env vars (Supabase secrets; never committed)
`SERV_API_KEY`, `SERV_COMPILE_MODEL`, `SERV_CHAT_MODEL`, `REPPO_API_KEY`, `KITE_AGENT_PRIVATE_KEY`, `KITE_AGENT_ADDRESS`, `KITE_PAYTO_ADDRESS`, `KITE_RPC_URL=https://rpc-testnet.gokite.ai/`, `KITE_ASSET_ADDRESS` (pieUSD, `0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A` [VERIFY]), `KITE_FACILITATOR_URL=https://facilitator.pieverse.io/v2`.
Web (`apps/web/.env.local`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Verified facts
- 2026-11-15: SERV `gpt-5.4-nano` answered in 2.8 s; requires `max_completion_tokens`.
- 2026-11-15 (A2, partial): facilitator `/v2/supported` lists x402Version 2, scheme `exact`, network `eip155:2368` (also 2366, 56, 97, 8453, 143, 196, 1952); no `gokite-aa`/v1 shape. pieUSD at 0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A confirmed on chain: name() = "pieUSD", decimals 18, contract has code. Seller/buyer implemented as v2 (402 + `PAYMENT-REQUIRED` header; retry with `PAYMENT-SIGNATURE` base64 JSON `{x402Version:2, resource, accepted, payload:{signature, authorization{from,to,value,validAfter,validBefore,nonce}}}`; facilitator /verify and /settle body `{x402Version:2, paymentPayload, paymentRequirements}`). Live deploy test 15:02 UTC: facilitator /verify accepted the payload shape and returned {isValid:false, invalidReason:"insufficient_funds"} because the agent wallet holds 0 pieUSD and 0 KITE. Real settle still [VERIFY].
