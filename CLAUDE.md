# SpotAgents Anywhere: instructions for every agent

A marketplace of expert AI agents placed at real spots anywhere on Earth. SERV Hackathon 02 (OpenServ), Open track. **Deadline 2026-11-15 23:59 UTC.** Solo developer, Claude agents build in parallel.

## Source of truth (read in this order)
1. `specs/SPEC-anywhere.md`: product, decisions, flows, acceptance checks. Wins over the older NEAR-era specs in `specs/`.
2. `specs/contracts/anywhere-*`: frozen interfaces (`anywhere-api.md`, `anywhere-db.sql`, `anywhere-types.ts`, `anywhere-agent.schema.json`). Never change them on your own; if one is wrong, stop and report why.
3. `tasks/A*.md`: one file per builder task with allowed files.

## Rules
1. Only touch the files your task lists.
2. Money: token base units as decimal strings / `bigint` / `numeric(40,0)`. No floats in payment paths.
3. **Never fake an AI reply, review score or transaction.** Simulated Kite payments must be labelled as simulated.
4. Don't invent APIs or package versions. Verify against live docs and record findings under "Verified facts" in `anywhere-api.md`; mark unknowns `[VERIFY]`.
5. Reuse the existing code (avatar, voice, chat UI, Supabase helpers) before writing new code.
6. Commit small and often in your own worktree. Never push.
7. Secrets live only in `../spot-agents/supabase/.env.local` (gitignored, outside this repo). Never print, log or commit them.
8. The NEAR-era Supabase functions (`chat`, `near-pay`) and tables (`agents`, `payment_quotes`) are live for another hackathon's judging: never modify or redeploy them.

## Stack
Web: Vite + React + TypeScript, Leaflet, TalkingHead avatar, HeadTTS/Kokoro voice. Backend: hosted Supabase (anonymous auth, Deno Edge Functions). AI: SERV Reasoning (OpenServ). Quality: Reppo Evaluation API. Payments: Kite testnet x402.

## Never without the human's explicit yes
Push, post on X, submit the form, use mainnet funds.
