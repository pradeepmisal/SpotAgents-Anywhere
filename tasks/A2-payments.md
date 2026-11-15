# A2 Payments: Kite x402 seller + tour agent
Owner: builder-payments. Status: ready. Spec: SPEC-anywhere.md flow 5; contract: anywhere-api.md §5.
Allowed files: supabase/functions/ax-pay/**, supabase/functions/ax-agent-pay/**, supabase/functions/_shared/kite.ts, this task file, and the "Verified facts" section of anywhere-api.md (append only).
Env (in ../spot-agents/supabase/.env.local, never print): KITE_AGENT_PRIVATE_KEY, KITE_AGENT_ADDRESS, KITE_PAYTO_ADDRESS. Tables ax_budgets, ax_payments already exist.
Do:
1. Spike first (≤30 min): check the agent wallet's balances on Kite testnet (RPC https://rpc-testnet.gokite.ai/, chain 2368) for KITE and the x402 asset; call the facilitator https://facilitator.pieverse.io/v2/supported and record the real scheme/network/asset/version. Read the sample repos (BrKDDD/kite-x402-hono, tianzeshi-study/kite-x402-axum incl. its python client, CarryWang/kite-x402-explorer src/lib) for the exact payload. Record verified facts.
2. ax-pay (seller) and ax-agent-pay (buyer with budget/cap) per contract. EIP-712 signing in Deno: use `npm:viem@2.21.54` (accounts + signTypedData) via npm specifier; no other new deps unless essential (state why in this file).
3. Simulated fallback exactly as the contract says (labelled, never "settled" without a facilitator tx hash).
4. Deploy only ax-pay and ax-agent-pay (`--use-api --project-ref jqcsktuvkcohdegacbmd`), set secrets KITE_* without printing values. Never touch chat or near-pay.
5. Test: refused (over cap), real settle if funds exist (report tx + kitescan link), else simulated.
Report: real or simulated, tx hash if any, blockers (e.g. faucet token mismatch) with exact error text.
