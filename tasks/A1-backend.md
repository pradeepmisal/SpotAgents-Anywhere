# A1 Backend: compile, discover, chat, review (SERV + Reppo)
Owner: builder-backend. Status: ready. Spec: specs/SPEC-anywhere.md flows 1–4; contract: specs/contracts/anywhere-api.md §1–4.
Allowed files: supabase/functions/ax-compile/**, ax-agents/**, ax-chat/**, ax-review/**, supabase/functions/_shared/serv.ts, _shared/reppo.ts, _shared/validate.ts, scripts/seed-anywhere.mjs, scripts/seed-anywhere.json, this task file.
Read-only: supabase/functions/_shared/common.ts, anywhere-types.ts, anywhere-agent.schema.json, the NEAR-era chat function (copy patterns from supabase/functions/chat/).
Do:
1. SERV client (_shared/serv.ts): JSON compile + streaming chat. Verify on first real call; record facts in anywhere-api.md "Verified facts" (append only that section).
2. ax-compile, ax-agents, ax-chat, ax-review per contract. Reppo submit/poll per contract; verify the real request/response shape with one call and record it.
3. Deploy only the ax-compile, ax-agents, ax-chat, ax-review functions: `npx supabase functions deploy <name> --use-api --project-ref jqcsktuvkcohdegacbmd` (SUPABASE_ACCESS_TOKEN from ../spot-agents/supabase/.env.local). Set secrets SERV_API_KEY, SERV_COMPILE_MODEL, SERV_CHAT_MODEL, REPPO_API_KEY with `npx supabase secrets set --project-ref ...` reading values from that env file without printing them. Never deploy or touch `chat` or `near-pay`.
4. Seed script: creates ~10 showcase agents (2 in Pune at Shaniwar Wada reusing the existing guides' facts from supabase/seed.sql, and 1–2 each in Rome, Paris, New York, Tokyo, London) through the deployed ax-compile flow logic, with sample=true, expires_at null, labelled "Sample creator · demo". Notes must be plausible local-expert notes written as clearly sample content, no real person's name. Spend Reppo's 10 free evaluations on these.
5. Test end to end with curl (anon session): compile → agents list → chat (first turn free, second 402) → review.
Report: what works (with real outputs), Verified facts recorded, anything [VERIFY] left.
