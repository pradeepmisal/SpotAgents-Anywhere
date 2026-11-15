// Compile an expert's notes into a validated agent with SERV, store it, submit it to Reppo.
import { admin, caller, cors, json } from "../_shared/common.ts";
import { compileAgent } from "../_shared/serv.ts";
import { evalInput, reppoConfigured, submitEval } from "../_shared/reppo.ts";
import { priceUnits, validateCompileRequest } from "../_shared/validate.ts";
import type { AgentDetail } from "../_shared/anywhere-types.ts";

const SEED_OWNER = "00000000-0000-0000-0000-00000000d3a0"; // existing fixed seed user (auth.users row)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const clean = validateCompileRequest(body);
  if (typeof clean === "string") return json({ error: clean }, 400);

  const db = admin();

  // Seeding path: a shared secret lets the seed script create sample agents (no limits, no expiry).
  const seedKey = Deno.env.get("SEED_KEY");
  const isSeed = !!seedKey && req.headers.get("x-seed-key") === seedKey;

  let uid: string | null = isSeed ? SEED_OWNER : await caller(req, db);
  if (!uid) return json({ error: "Sign in first" }, 401);

  if (!isSeed) {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count, error } = await db.from("ax_agents").select("id", { count: "exact", head: true })
      .eq("owner_id", uid).gte("created_at", since);
    if (error) return json({ error: error.message }, 500);
    if ((count ?? 0) >= 3) return json({ error: "limit" }, 429);
  }

  let compiled;
  try {
    compiled = await compileAgent(clean);
  } catch (e) {
    console.error("compile failed", String(e));
    return json({ error: "The compiler couldn't produce a valid agent. Try again." }, 502);
  }

  // Reppo review: if not configured or the submit fails, list without review.
  let status: "in_review" | "listed_unreviewed" = "listed_unreviewed";
  let evalId: string | null = null;
  if (reppoConfigured()) {
    try {
      evalId = await submitEval(evalInput(compiled, clean.notes, clean.name, clean.place_name));
      status = "in_review";
    } catch (e) {
      console.error("reppo submit failed", String(e));
    }
  }

  const price = priceUnits(clean.price_usd);
  const { data, error } = await db.from("ax_agents").insert({
    owner_id: uid,
    name: clean.name,
    title: clean.title,
    place_name: clean.place_name,
    city: clean.city,
    lat: clean.lat,
    lng: clean.lng,
    radius_m: clean.radius_m,
    price_units: price.units,
    price_usd: price.usd,
    compiled,
    source_notes: clean.notes,
    status,
    reppo_eval_id: evalId,
    sample: isSeed,
    expires_at: isSeed ? null : new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  }).select("*").single();
  if (error || !data) return json({ error: error?.message ?? "Insert failed" }, 500);

  const detail: AgentDetail = {
    id: data.id, name: data.name, title: data.title, place_name: data.place_name, city: data.city,
    lat: data.lat, lng: data.lng, radius_m: data.radius_m, avatar: data.avatar, color: data.color,
    price_units: String(data.price_units), price_usd: Number(data.price_usd), status: data.status,
    quality_score: data.quality_score, sample: data.sample, is_mine: !isSeed, distance_m: null,
    created_at: data.created_at,
    greeting: compiled.greeting, facts: compiled.facts,
    stories: compiled.stories.map((s) => ({ title: s.title, kind: s.kind })),
    teaser: compiled.teaser, suggested_questions: compiled.suggested_questions, languages: compiled.languages,
    version: data.version, quality_decision: data.quality_decision, quality_critique: data.quality_critique,
    review_history: data.review_history ?? [],
  };
  return json(detail, 201);
});
