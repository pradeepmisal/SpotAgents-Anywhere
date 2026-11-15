# SPEC: geo-agents

Status: Approved (2026-11-14) · Owner: builder-backend · Contracts: `contracts/db.sql` Part 1, `contracts/api.md` §1

## Objective
Agents exist at real coordinates, and anyone signed in anonymously can find the ones near them.

## Scope
- `supabase/` project config, and migration `0001_agents.sql` copied from `contracts/db.sql` Part 1.
- **Two seed sets.** Both have 5 agents, at least 2 of them paid at 0.1 NEAR = `100000000000000000000000` yocto, with `creator_account` set to the human's testnet account. Every agent has a distinct name, greeting, context and premium_context.
  - `supabase/seed.sql` (**committed**, public): "Demo City", at a public landmark: Shaniwar Wada, Pune, approx. `18.5195, 73.8553` `[VERIFY coords]`. Example agents: fort historian, street-food guide, Peshwa-era storyteller, rickshaw route helper, souvenir shop. Judges anywhere use it through the app's "Demo City" switch.
  - `supabase/seed.local.sql` (**gitignored, never committed**): "Home spots", within 15 m of the human's filming location. The coordinates are given to the builder in the task prompt only. Never write them in any tracked file, log or commit message. Example agents placed around a home: kitchen chef, bookshelf librarian, balcony plant doctor, desk productivity coach, front-door concierge.
- `supabase/functions/_shared/common.ts` copied from upstream unchanged (cors, json, admin, caller), and `_shared/types.ts` copied from `contracts/types.ts`.
- Anonymous sign-ins enabled in the project (a dashboard step for the human, documented in `docs/SETUP.md`).

## Out of scope
The create-agent form (cut line 1; only if time is left), editing agents, private agents, the map view.

## Acceptance criteria
1. `npx supabase db push` applies cleanly to an empty hosted project.
2. As an anonymous user, `rpc('nearby_agents', {p_lat, p_lng, p_km: 1})` at the seed location returns all 5 agents sorted by `distance_m`. Neither `context` nor `premium_context` appears in the response.
3. Directly running `select * from agents` as anon or as another user returns 0 rows (RLS).
4. Inserting a paid agent without `creator_account` fails the `paid_has_creator` check.
5. `price_yocto` comes back as a string.
6. `nearby_agents` never returns `lat`/`lng`, and `distance_m` is rounded to 10 m, so the home location can't be read from the API.
7. `git grep` for the home coordinates' first four digits returns nothing.

## Privacy note
After judging, delete the Home-spots agents (`delete from agents where …`). Rounding the distance doesn't stop someone who queries from many points from triangulating the agents' location.

## Verify
`docs/SETUP.md` gets a curl or `supabase-js` snippet for criteria 2, 3 and 5. Paste its output into the task file.

## Reuse
Upstream `supabase/migrations/20261106000000_agents.sql`, `20261106120000_agent_shape.sql`, `supabase/functions/_shared/common.ts`, `supabase/config.toml`.

## Verified facts (T01 spike, 2026-11-14)
- Upstream snapshot `C:\Users\Pradeep Misal\Air Agent\upstream-spatial-agents\` (commit `00d2fce`): all four reuse files exist (`supabase/migrations/20261106000000_agents.sql`, `20261106120000_agent_shape.sql`, `supabase/functions/_shared/common.ts`, `supabase/config.toml`).
- Supabase CLI via `npx supabase --version` = 3.1.0. `npx supabase db push` targets the LOCAL db by default; use `--remote[=ref]` (plus `--password`/linked project) for hosted, and `--dry-run` first. `npx supabase functions serve` is local-only, serves all functions, needs Docker (Docker 29.8.1 is installed); flags `--env-file`, `--no-verify-jwt`.
- Publishable keys (https://supabase.com/docs/guides/api/api-keys): `sb_publishable_...` is passed to `createClient` in client code; it is a short string, not a JWT; send it on the `apikey` header, not `Authorization: Bearer`. With no user it maps to Postgres role `anon`, with a signed-in user to `authenticated`.
- Anonymous sign-in (https://supabase.com/docs/guides/auth/auth-anonymous): docs example is `createClient(url, 'sb_publishable_...')` then `supabase.auth.signInAnonymously()`. Needs "Enable Anonymous Sign-Ins" in the dashboard (upstream config.toml has `enable_anonymous_sign_ins = true` for local/config). Rate limit 30 req/h per IP by default; CAPTCHA recommended. So supabase-js plus anonymous auth work with the publishable key.
- Edge Functions: the gateway `verify_jwt` check does not authenticate a caller that sends only an API key; upstream sets `verify_jwt = false` for functions and verifies the session in `_shared/common.ts` (`caller()` via JWKS). Keep that pattern. Upstream `common.ts` reads server key from `SUPABASE_SERVICE_ROLE_KEY`, else `AGENTSPHERE_SECRET_KEY`, else `SUPABASE_SECRET_KEYS`; upstream `project_id = "agentsphere"` (T02 renames).
- Coords: Shaniwar Wada is approx 18.5192 N, 73.8553 E (Wikidata 18 31'9"N 73 51'19"E; aggregator 18.51917, 73.85528; Wikipedia heritage list 18.519075, 73.85545). `DEMO_CITY` 18.5195, 73.8553 is within about 40 m: correct, no change needed. `[VERIFY coords]` resolved.
