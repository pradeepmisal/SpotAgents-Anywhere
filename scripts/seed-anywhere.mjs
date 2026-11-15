// Seed ~10 sample showcase agents through the deployed ax-compile (x-seed-key path), then poll ax-review until Reppo scores them.
// Env (from gitignored env files, never printed): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SEED_KEY.
// Usage: node scripts/seed-anywhere.mjs        (compile all, then poll)
//        node scripts/seed-anywhere.mjs review (only poll the ids saved by the last run)
import fs from "node:fs";
const { VITE_SUPABASE_URL: BASE, VITE_SUPABASE_ANON_KEY: ANON, SEED_KEY } = process.env;
if (!BASE || !ANON || !SEED_KEY) throw new Error("set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SEED_KEY");
const list = JSON.parse(fs.readFileSync(new URL("./seed-anywhere.json", import.meta.url), "utf8"));
const reviewOnly = process.argv[2] === "review";
const idsFile = new URL("./.seed-ids.json", import.meta.url);

const su = await (await fetch(`${BASE}/auth/v1/signup`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: "{}" })).json();
const hdr = { apikey: ANON, Authorization: `Bearer ${su.access_token}`, "Content-Type": "application/json" };
const fn = (n, init) => fetch(`${BASE}/functions/v1/${n}`, init);

let ids = reviewOnly ? JSON.parse(fs.readFileSync(idsFile, "utf8")) : [];
if (!reviewOnly) {
  for (const a of list) {
    let j, res;
    for (let t = 0; t < 3; t++) {
      res = await fn("ax-compile", { method: "POST", headers: { ...hdr, "x-seed-key": SEED_KEY }, body: JSON.stringify(a) });
      j = await res.json();
      if (res.status === 201) break;
    }
    console.log(res.status, a.city, a.name, j.status ?? j.error);
    if (res.status === 201) ids.push({ id: j.id, name: a.name, city: a.city });
  }
  fs.writeFileSync(idsFile, JSON.stringify(ids, null, 1));
}
const done = new Set();
for (let round = 0; round < 60 && done.size < ids.length; round++) {
  for (const a of ids) {
    if (done.has(a.id)) continue;
    const r = await (await fn("ax-review", { method: "POST", headers: hdr, body: JSON.stringify({ agent_id: a.id }) })).json();
    if (r.status && r.status !== "in_review") {
      done.add(a.id);
      console.log("scored", a.city, a.name, r.status, "v" + r.version, "score", r.quality_score, r.quality_decision);
    }
  }
  if (done.size < ids.length) await new Promise((r) => setTimeout(r, 20000));
}
console.log(`done ${done.size}/${ids.length}`);
