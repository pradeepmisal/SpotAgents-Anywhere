# SPEC: SpotAgents Anywhere

Status: Approved (2026-11-15). Hackathon: SERV Hackathon 02 (OpenServ), Open track. Deadline 2026-11-15 23:59 UTC.
Earlier specs in this folder (`SPEC-geo-agents`, `SPEC-chat-voice`, `SPEC-ar-avatar`, `SPEC-near-pay`) describe the NEAR/Pune version and are background only. Where they differ, this spec wins.

## Product (one paragraph)
A marketplace of **expert AI agents placed at real spots, anywhere on Earth**. A local expert drops a pin and pastes (or speaks) what only they know. **SERV Reasoning** compiles the notes into a validated agent. **Reppo** scores it 0–100 as a quality gate, and low scores send the critique back to SERV for a rebuild. Visitors find agents on a world map or by holding up the phone (location AR), talk to the 3D avatar by voice (first question free), and their **tour agent** pays for a full session through **Kite x402** on Kite testnet, within a budget and per-payment cap.

## Decisions (made with the human, 2026-11-15)
| Topic | Decision |
|---|---|
| Track | Open track. Sponsors used: SERV Reasoning (required), Reppo, Kite. No Dolphin. |
| Model | Experts only (no Wikipedia auto-guides). Showcase agents seeded in ~6 cities, labelled "Sample creator · demo". |
| Creators | Anyone can create; labelled "demo creator"; max 3 per visitor per 24 h; expire after 7 days. |
| Payments | Kite x402 on Kite testnet, paid by a server-side tour-agent wallet with per-visitor budget ($1.00) and per-payment cap ($0.10). Passport-style limits enforced by the app (said so in the UI). If Kite test funds or the facilitator fail: a **clearly labelled simulated** payment, never a fake "settled". NEAR is not used. |
| Demo | Public link with limits. 3D avatar + neural voice kept. Camera overlay + location-based AR markers (stretch, first to cut). |
| Repo | New public repo `SpotAgents-Anywhere`. Same Supabase project, new `ax_` tables and `ax-` functions only; NEAR functions/tables untouched. |

## User flows and acceptance checks
1. **Create.** Studio: drop a pin (or use my location), optional place name (suggested from OpenStreetMap), agent name, title, notes (20–4000 chars), price $0.01–$0.10. Submit → `ax-compile`. ✔ Within ~15 s an agent appears with status `in_review`, persona, greeting, 3–6 facts, 1–3 stories, teaser, premium content, 3 suggested questions. ✔ Output always matches `contracts/anywhere-agent.schema.json` (validated server-side; one retry on invalid; then 502).
2. **Review (Reppo).** On compile the agent is submitted to Reppo. ✔ Agent page shows "In review by Reppo". ✔ When the result arrives (`ax-review`), status becomes `listed` (decision accept, or score ≥ 70) or the critique is sent to SERV for a rebuild (version + 1, max 3 versions) and resubmitted. ✔ Score, decision and critique are shown. If Reppo is unavailable or out of free evaluations: status `listed_unreviewed`, labelled "Not yet reviewed".
3. **Discover.** World map of agents (listed + listed_unreviewed + caller's own in_review), list sorted by distance from the visitor (or from a picked city). ✔ Works with location denied (city picker: Pune, Rome, Paris, New York, Tokyo, London + "where I am").
4. **Talk.** Open an agent: "Visit" (at the spot, within radius) or "Visit virtually" (labelled). 3D avatar, voice, captions. ✔ First user question free (teaser + facts only). ✔ Next question returns 402 → paywall.
5. **Pay (Kite).** Paywall shows price, tour-agent budget meter (spent/remaining, cap), "Let my tour agent pay". ✔ Real path: `ax-agent-pay` → 402 from seller → signed EIP-3009 → facilitator verify+settle → tx hash with `https://testnet.kitescan.ai/tx/<hash>`. ✔ Over budget or over cap → refused with reason. ✔ Simulated path labelled "Simulated payment (Kite testnet unavailable)". ✔ After paying, premium answers for 30 min.
6. **AR finder (stretch).** Camera + markers placed by GPS bearing and compass heading, name + distance, tap opens the agent. Falls back to a list if motion permission is denied.

## Non-goals today
Real Kite Passport per judge, creator payouts on chain (creator share is shown as a ledger line), moderation beyond limits, mainnet.

## Honesty rules
No fake AI replies, scores or transactions. Seeded agents say "Sample creator · demo". Simulated payments say so. Virtual visits say so.
