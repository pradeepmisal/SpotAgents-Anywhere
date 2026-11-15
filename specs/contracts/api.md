# API contract

Status: Approved (2026-11-14). FROZEN once approved. Types are in `types.ts`.

All calls go to the hosted Supabase project and send `Authorization: Bearer <anon session JWT>`. The web app signs in with `supabase.auth.signInAnonymously()` on first load. Errors come back as JSON `{ "error": string }` with a 4xx or 5xx status.

## 1. `rpc('nearby_agents', { p_lat, p_lng, p_km })` → `NearbyAgent[]`
- Defined in `db.sql`. `p_km` defaults to 1 and is capped at 50. Results are sorted by distance, at most 100.

## 2. `POST /functions/v1/chat` (owner: chat-voice)
Request `ChatRequest`.
- **Free agent:** streams `text/event-stream`. The first event is `data: {"premium":false}`, then `data: {"text":"…"}` chunks, then `data: [DONE]`.
- **Paid agent with an unexpired unlock:** a row in `payment_quotes` where `user_id` is the caller, `agent_id` matches, `status` is `paid` and `unlocked_until > now()`. Same stream, but the first event is `{"premium":true}`, and the system prompt adds `premium_context`.
- **Paid agent, not unlocked:** the first user turn still gets a free reply, using only `context` (a teaser). Any later turn returns HTTP **402** with `PaymentRequired`.
- **Upstream AI error:** `data: {"error":"…"}` and then `[DONE]`. Never a made-up reply.
- **Other errors:** 400 for a bad body, 401 when there's no session, 404 for an unknown agent.
- Model: `agents.model`, or the `NEARAI_MODEL` env var. Base URL `https://cloud-api.near.ai/v1/chat/completions`, using the `NEARAI_API_KEY` env var.

## 3. `POST /functions/v1/near-pay/quote` (owner: near-pay)
Request `QuoteRequest` → `Quote`.
- 404 if the agent is unknown. 400 if the agent is free.
- Checks `creator_account` exists through NEAR RPC `view_account` (otherwise 409 `creator account not found`).
- `quote_id` is `q_` followed by 20 random URL-safe characters. `expires_at` is now plus 10 minutes. Inserts a `payment_quotes` row with status `pending`.
- `contract_id` and `fee_bps` come from the `SPOTPAY_CONTRACT_ID` env var and the contract's `get_config`.

## 4. `POST /functions/v1/near-pay/verify` (owner: near-pay)
Request `VerifyRequest` → `VerifyResult`.
- Loads the quote. It must belong to the caller, or the call returns 404.
- Calls the contract view `get_payment({quote_id})` through RPC (`query` / `call_function`, finality `final`).
- **No record:** `pending` if the quote hasn't expired, `expired` if it has.
- **A record exists:** checks `creator == quote.creator_account`, `agent_id == quote.agent_id` and `BigInt(amount) >= BigInt(quote.amount_yocto)`. Any mismatch gives `invalid` with a `reason`. Otherwise it sets `status='paid'`, `payer_account`, `tx_hash`, and `unlocked_until = now() + 30 min`, then returns `paid`.
- Idempotent: verifying an already-paid quote returns the same result.
- `explorer_url` is `https://testnet.nearblocks.io/txns/<tx_hash>` when `tx_hash` is given `[VERIFY explorer URL format]`.

## 5. Web → wallet (owner: near-pay, inside `apps/web/src/near/`)
- `connect()`, `accountId()`, and `payQuote(q: Quote): Promise<{ tx_hash: string }>`.
- `payQuote` calls `spot_pay.pay({quote_id, agent_id, creator: creator_account})` with deposit `amount_yocto` and gas `30 Tgas` `[VERIFY gas]`.
- On wallet redirect flows, `tx_hash` is read back from the return URL `[VERIFY]`.

## Env vars (Supabase secrets; never committed)
`NEARAI_API_KEY`, `NEARAI_MODEL`, `NEAR_RPC_URL` (testnet RPC `[VERIFY]`), `SPOTPAY_CONTRACT_ID`.
Web (`apps/web/.env.local`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SPOTPAY_CONTRACT_ID`, `VITE_NEAR_NETWORK=testnet`.
