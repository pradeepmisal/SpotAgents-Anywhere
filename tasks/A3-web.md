# A3 Web: Anywhere app
Owner: builder-web. Status: ready. Spec: SPEC-anywhere.md flows 1–6; contracts: anywhere-api.md, anywhere-types.ts (copied at apps/web/src/anywhere/types.ts, do not edit).
Allowed files: apps/web/** (except src/anywhere/types.ts), this task file.
Build (mobile-first, same visual language as the current app: green #1f884a, white cards, rounded):
1. Replace the Pune/NEAR flow as the default experience with Anywhere: Explore (Leaflet world map of agents from GET ax-agents + list sorted by distance; location button; city picker from CITIES), Agent page (name, title, place, sample/demo labels, Reppo score badge or "In review by Reppo" with polling ax-review every 30 s, facts, story titles, price), Studio (pin on map / my location, name, title, place name suggested via OpenStreetMap Nominatim reverse geocoding with a proper User-Agent-free fetch and 1 req/s, notes, price slider $0.01–$0.10, "Compile with SERV Reasoning" → shows compiled result and review status), Talk (reuse Experience/AvatarStage/ChatPanel/voice; chat endpoint ax-chat; "Visit virtually" labelled when not within radius), Paywall (price, tour agent budget meter, "Let my tour agent pay" → ax-agent-pay; show settled with kitescan link, or the simulated label, or refused reason), Wallet tab (BudgetView + payments).
2. Remove NEAR wallet UI from navigation (keep files if simplest, but no NEAR imports on the main path; drop @hot-labs/near-connect and near-api-js from package.json if nothing imports them).
3. AR finder (stretch, do last): camera background + markers by GPS bearing vs compass heading (DeviceOrientationEvent, iOS requestPermission), distance labels, tap to open; fallback list.
4. Until the backend is deployed, use a mock layer behind `?mock=1` with clearly labelled sample data; real calls otherwise.
5. `npm run build` must pass. Commit in your worktree.
Report: screens done, screenshots (Playwright, 390x844) saved under apps/web/docs-shots/, anything not done.
